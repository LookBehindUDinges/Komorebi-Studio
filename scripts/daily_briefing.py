#!/usr/bin/env python3
"""Fetch RSS feeds, summarize each article with a local Ollama model, and save
a daily briefing JSON that the Komorebi site's /briefing page displays.

Run manually with:
    python scripts/daily_briefing.py

Requires Ollama running locally (ollama serve) with the model pulled:
    ollama pull qwen3:14b
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import requests

OLLAMA_HOST = "http://localhost:11434"
MODEL = "qwen3:14b"
MAX_ARTICLES_PER_FEED = 3
REQUEST_TIMEOUT = 180  # local LLM calls can be slow, especially on first load
SUMMARIZE_RETRIES = 2
FEED_FETCH_TIMEOUT = 20
MIN_DESCRIPTION_LENGTH = 40  # some feed entries (e.g. OpenAI's) ship with no body text at all;
                             # there's not enough there to summarize, so skip rather than send
                             # the model an almost-empty prompt and get back malformed JSON

FEEDS = [
    {"name": "NHK News", "category": "Japan News", "url": "https://www3.nhk.or.jp/rss/news/cat0.xml"},
    {"name": "New York Times", "category": "US News", "url": "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"},
    {"name": "BBC World", "category": "World News", "url": "http://feeds.bbci.co.uk/news/world/rss.xml"},
    {"name": "BBC Business", "category": "Economic News", "url": "http://feeds.bbci.co.uk/news/business/rss.xml"},
    {"name": "BBC Entertainment & Arts", "category": "Music / Entertainment", "url": "http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"},
    {"name": "BBC Sport", "category": "Sports", "url": "http://feeds.bbci.co.uk/sport/rss.xml"},
    {"name": "OpenAI News", "category": "Tech", "url": "https://openai.com/news/rss.xml"},
    {"name": "Hugging Face Blog", "category": "Tech", "url": "https://huggingface.co/blog/feed.xml"},
]

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "briefing" / "latest.json"

FURIGANA_RULES = """Furigana formatting rules (apply to both japanese_title and japanese_summary):
- Break the text into separate words or compounds, and add a reading immediately after EACH one individually.
  Correct example: この天気(てんき)は変(へん)ですね。
  WRONG (never do this): この天気は変ですね(このてんきはへんですね)  <- do not wrap a whole phrase or title in one single reading.
- Use half-width parentheses ( ) only. Never use full-width （）.
- Do not add parentheses after katakana, hiragana-only words, numbers, or non-Japanese text (e.g. FIFA, GPT stay unannotated)."""

PROMPT_TEMPLATE = """You are a bilingual news assistant helping a Japanese-language learner stay current with tech and Japan news.

Given this article, respond with ONLY a JSON object (no other text, no markdown fences) matching this exact shape:
{{
  "japanese_title": "The article title in Japanese. If the source title is already in Japanese, keep its wording as close to the original as possible. If the source title is in English, translate it naturally into Japanese. Follow the furigana formatting rules below.",
  "english_summary": "2-3 sentence summary in English",
  "japanese_summary": "3-5 sentence summary in simple Japanese suitable for an intermediate learner. Follow the furigana formatting rules below.",
  "vocabulary": [
    {{"word": "kanji or word", "reading": "hiragana reading", "meaning": "English meaning"}}
  ],
  "why_it_matters": "One sentence in English explaining why this story is worth knowing about."
}}

{furigana_rules}

Include 5 to 8 entries in "vocabulary", drawn from words actually used in your japanese_summary.

Article title: {title}
Article description: {description}
Source: {source}
"""


def strip_think_tags(text):
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def extract_json(text):
    text = strip_think_tags(text)
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")
    return json.loads(text[start:end + 1])


def validate_summary(summary):
    for field in ("japanese_title", "english_summary", "japanese_summary", "why_it_matters"):
        if not summary.get(field, "").strip():
            raise ValueError(f"Model response is missing or empty '{field}'")
    if not isinstance(summary.get("vocabulary"), list) or not summary["vocabulary"]:
        raise ValueError("Model response is missing or empty 'vocabulary'")
    return summary


def normalize_furigana_parens(summary):
    # Defensive fallback: the model occasionally uses full-width parentheses,
    # which the site's furigana regex (half-width only) won't recognize.
    for field in ("japanese_title", "japanese_summary"):
        if field in summary and isinstance(summary[field], str):
            summary[field] = summary[field].replace("（", "(").replace("）", ")")
    return summary


def summarize(title, description, source):
    prompt = PROMPT_TEMPLATE.format(title=title, description=(description or "")[:2000], source=source, furigana_rules=FURIGANA_RULES)
    last_error = None
    for attempt in range(1, SUMMARIZE_RETRIES + 1):
        try:
            response = requests.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "format": "json"},
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            raw = response.json().get("response", "")
            return validate_summary(normalize_furigana_parens(extract_json(raw)))
        except Exception as error:
            last_error = error
            if attempt < SUMMARIZE_RETRIES:
                print(f"    Attempt {attempt} failed ({error}), retrying...")
                time.sleep(2)
    raise last_error


def fetch_feed(feed):
    # feedparser's own urllib-based fetcher can fail to verify TLS certs on some
    # Windows Python installs, so download the raw feed with requests (which
    # uses certifi's CA bundle) and hand feedparser the bytes to parse instead.
    try:
        response = requests.get(feed["url"], timeout=FEED_FETCH_TIMEOUT, headers={"User-Agent": "Komorebi-Briefing/1.0"})
        response.raise_for_status()
    except requests.exceptions.RequestException as error:
        print(f"  Warning: could not fetch {feed['name']} ({error})")
        return []
    parsed = feedparser.parse(response.content)
    if parsed.bozo and not parsed.entries:
        print(f"  Warning: could not parse {feed['name']} ({parsed.bozo_exception})")
        return []
    return parsed.entries[:MAX_ARTICLES_PER_FEED]


def check_ollama():
    try:
        requests.get(OLLAMA_HOST, timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"Could not reach Ollama at {OLLAMA_HOST}. Is it running? Try: ollama serve")
        sys.exit(1)


def main():
    # Windows terminals often default to a legacy codepage that can't print
    # Japanese titles/summaries; force UTF-8 on stdout regardless of terminal config.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    print(f"Checking Ollama at {OLLAMA_HOST} ...")
    check_ollama()

    articles = []
    for feed in FEEDS:
        print(f"Fetching {feed['name']}...")
        entries = fetch_feed(feed)
        print(f"  {len(entries)} article(s) found")
        for entry in entries:
            title = entry.get("title", "Untitled")
            description = entry.get("summary", entry.get("description", ""))
            link = entry.get("link", "")
            if len(description.strip()) < MIN_DESCRIPTION_LENGTH:
                print(f"  Skipping (no article text available): {title[:60]}")
                continue
            print(f"  Summarizing: {title[:60]}")
            try:
                summary = summarize(title, description, feed["name"])
            except Exception as error:
                print(f"    Failed: {error}")
                continue
            articles.append({
                "source": feed["name"],
                "category": feed["category"],
                "title": title,
                "link": link,
                "published": entry.get("published", ""),
                **summary,
            })

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    briefing = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "articles": articles,
    }
    OUTPUT_PATH.write_text(json.dumps(briefing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved {len(articles)} article(s) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
