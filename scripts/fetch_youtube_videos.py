#!/usr/bin/env python3
"""Fetch the latest uploads from a YouTube channel's public RSS feed and save
them as JSON for the Komorebi site's /videos page to display.

Run manually with:
    python scripts/fetch_youtube_videos.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import requests

CHANNEL_ID = "UCfiYzG_QoEXQpaTNsrIfdDg"  # Ben's 日本語の Channel
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
FEED_FETCH_TIMEOUT = 20
MAX_VIDEOS = 24

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "videos" / "latest.json"


def fetch_videos():
    response = requests.get(FEED_URL, timeout=FEED_FETCH_TIMEOUT, headers={"User-Agent": "Komorebi-Videos/1.0"})
    response.raise_for_status()
    parsed = feedparser.parse(response.content)
    if parsed.bozo and not parsed.entries:
        raise RuntimeError(f"Could not parse channel feed: {parsed.bozo_exception}")

    videos = []
    for entry in parsed.entries[:MAX_VIDEOS]:
        video_id = entry.get("yt_videoid", "")
        thumbnail = ""
        media_thumbnail = entry.get("media_thumbnail")
        if media_thumbnail:
            thumbnail = media_thumbnail[0].get("url", "")
        description = ""
        media_group = entry.get("media_group") or entry.get("media_content")
        if entry.get("summary"):
            description = entry["summary"]
        videos.append({
            "id": video_id,
            "title": entry.get("title", "Untitled"),
            "published": entry.get("published", ""),
            "thumbnail": thumbnail or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "description": description,
        })

    channel_title = parsed.feed.get("title", "")
    channel_url = f"https://www.youtube.com/channel/{CHANNEL_ID}"
    return channel_title, channel_url, videos


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    print(f"Fetching videos for channel {CHANNEL_ID} ...")
    try:
        channel_title, channel_url, videos = fetch_videos()
    except Exception as error:
        print(f"Failed to fetch channel feed: {error}")
        sys.exit(1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "channel_title": channel_title,
        "channel_url": channel_url,
        "videos": videos,
    }
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(videos)} video(s) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
