#!/usr/bin/env python3
"""Serves the mini tutor chat page, proxies /api/* to Ollama, and stores saved
chats/projects in a local JSON file under /tutor-api/*. Everything lives on
one origin, so the browser session Cloudflare Access sets up isn't split
across two different hostnames (which it refuses to honor for cross-origin
fetches).

Run with:
    python scripts/tutor_server.py
"""

import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import http.server
import socketserver

import requests

PORT = 8899
OLLAMA_HOST = "http://localhost:11434"
STATIC_DIR = Path(__file__).resolve().parent.parent / "tutor-app"
DATA_PATH = Path(__file__).resolve().parent / "tutor_data.json"

_lock = threading.Lock()

CHAT_ROOT = re.compile(r"^/tutor-api/chats/?$")
CHAT_ITEM = re.compile(r"^/tutor-api/chats/([a-f0-9]+)/?$")
PROJECT_ROOT = re.compile(r"^/tutor-api/projects/?$")
PROJECT_ITEM = re.compile(r"^/tutor-api/projects/([a-f0-9]+)/?$")


def _now():
    return datetime.now(timezone.utc).isoformat()


def _load_data():
    if not DATA_PATH.exists():
        return {"projects": [], "chats": []}
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def _save_data(data):
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _chat_summary(chat):
    return {
        "id": chat["id"],
        "title": chat["title"],
        "projectId": chat["projectId"],
        "model": chat["model"],
        "updatedAt": chat["updatedAt"],
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    # ---- Ollama passthrough ----

    def _proxy(self):
        url = OLLAMA_HOST + self.path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        try:
            response = requests.request(self.command, url, data=body, timeout=180)
        except requests.exceptions.RequestException as error:
            self._send_json({"error": f"Could not reach Ollama: {error}"}, status=502)
            return
        self.send_response(response.status_code)
        self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
        self.send_header("Content-Length", str(len(response.content)))
        self.end_headers()
        self.wfile.write(response.content)

    # ---- helpers ----

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    # ---- chat/project storage ----

    def _handle_chats_root(self):
        with _lock:
            data = _load_data()
            if self.command == "GET":
                summaries = sorted((_chat_summary(c) for c in data["chats"]), key=lambda c: c["updatedAt"], reverse=True)
                self._send_json(summaries)
                return
            if self.command == "POST":
                body = self._read_json_body()
                chat = {
                    "id": uuid.uuid4().hex[:12],
                    "title": body.get("title") or "",
                    "projectId": body.get("projectId"),
                    "model": body.get("model") or "qwen3:8b",
                    "messages": body.get("messages") or [],
                    "createdAt": _now(),
                    "updatedAt": _now(),
                }
                data["chats"].append(chat)
                _save_data(data)
                self._send_json(chat, status=201)
                return
        self.send_error(405)

    def _handle_chat_item(self, chat_id):
        with _lock:
            data = _load_data()
            chat = next((c for c in data["chats"] if c["id"] == chat_id), None)
            if self.command == "GET":
                if not chat:
                    self._send_json({"error": "not found"}, status=404)
                    return
                self._send_json(chat)
                return
            if self.command == "PUT":
                if not chat:
                    self._send_json({"error": "not found"}, status=404)
                    return
                body = self._read_json_body()
                for field in ("title", "projectId", "model", "messages"):
                    if field in body:
                        chat[field] = body[field]
                chat["updatedAt"] = _now()
                _save_data(data)
                self._send_json(chat)
                return
            if self.command == "DELETE":
                if not chat:
                    self._send_json({"error": "not found"}, status=404)
                    return
                data["chats"] = [c for c in data["chats"] if c["id"] != chat_id]
                _save_data(data)
                self._send_json({"ok": True})
                return
        self.send_error(405)

    def _handle_projects_root(self):
        with _lock:
            data = _load_data()
            if self.command == "GET":
                projects = sorted(data["projects"], key=lambda p: p["name"].lower())
                self._send_json(projects)
                return
            if self.command == "POST":
                body = self._read_json_body()
                name = (body.get("name") or "").strip()
                if not name:
                    self._send_json({"error": "name is required"}, status=400)
                    return
                project = {"id": uuid.uuid4().hex[:12], "name": name, "createdAt": _now()}
                data["projects"].append(project)
                _save_data(data)
                self._send_json(project, status=201)
                return
        self.send_error(405)

    def _handle_project_item(self, project_id):
        with _lock:
            data = _load_data()
            if self.command == "DELETE":
                data["projects"] = [p for p in data["projects"] if p["id"] != project_id]
                for chat in data["chats"]:
                    if chat["projectId"] == project_id:
                        chat["projectId"] = None
                _save_data(data)
                self._send_json({"ok": True})
                return
        self.send_error(405)

    # ---- routing ----

    def _route(self):
        if self.path.startswith("/api/"):
            self._proxy()
            return True
        if CHAT_ROOT.match(self.path):
            self._handle_chats_root()
            return True
        match = CHAT_ITEM.match(self.path)
        if match:
            self._handle_chat_item(match.group(1))
            return True
        if PROJECT_ROOT.match(self.path):
            self._handle_projects_root()
            return True
        match = PROJECT_ITEM.match(self.path)
        if match:
            self._handle_project_item(match.group(1))
            return True
        return False

    def do_GET(self):
        if not self._route():
            super().do_GET()

    def do_POST(self):
        if not self._route():
            self.send_error(404)

    def do_PUT(self):
        if not self._route():
            self.send_error(404)

    def do_DELETE(self):
        if not self._route():
            self.send_error(404)

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Tutor server running at http://127.0.0.1:{PORT} (static: {STATIC_DIR}, data: {DATA_PATH})")
        httpd.serve_forever()
