"""新着メモの Atom フィード（dist/feed.xml）の生成。

フィードリーダーで新しいメモを追えるように、build が一覧（memos.json と同じ並び）から作る。
各メモの日付は日単位なので、memo.config.json のタイムゾーンのその日 0 時を published・updated にする。
フィードの updated は最も新しいメモの日付（実行した時刻は使わない。何度 build しても同じ中身にするため）。
Atom の id には絶対 URL が要るので、公開 URL（config.SITE_URL）が決まらないときは作らない。
"""
from __future__ import annotations

import datetime as dt
import html
from xml.sax.saxutils import escape, quoteattr

from .config import CONFIG, DIST, SITE_NAME, SITE_URL, TZ

FEED_XML = DIST / "feed.xml"
FEED_NAME = FEED_XML.name
FEED_LIMIT = 50  # フィードに載せるメモの数（新しい順）
# 各ページの memo:head に入れる自動検出用のタグ（ブラウザやフィードリーダーがフィードを見つける）
FEED_LINK_TAG = (f'<link rel="alternate" type="application/atom+xml" '
                 f'title="{html.escape(SITE_NAME, quote=True)}" href="{FEED_NAME}">')
_EPOCH = "1970-01-01T00:00:00Z"  # メモが 1 本もないときのフィードの updated


def feed_enabled() -> bool:
    """フィードを作るか（公開 URL が決まるときだけ）。"""
    return bool(SITE_URL)


def _timestamp(date: str) -> str:
    """YYYY-MM-DD を、設定のタイムゾーンのその日 0 時の RFC 3339 にする。読めなければ空文字。"""
    try:
        d = dt.date.fromisoformat(date)
    except (TypeError, ValueError):
        return ""
    return dt.datetime(d.year, d.month, d.day, tzinfo=TZ).isoformat()


def atom_feed(memos: list[dict]) -> str:
    """memos（日付の新しい順）から Atom 1.0 のフィードを作る。日付のないメモは載せない。"""
    entries = [(m, _timestamp(m["date"])) for m in memos]
    entries = [(m, ts) for m, ts in entries if ts][:FEED_LIMIT]
    updated = max((ts for _, ts in entries), default=_EPOCH)
    t = escape
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">',
        f"  <title>{t(SITE_NAME)}</title>",
    ]
    if CONFIG["description"]:
        lines.append(f"  <subtitle>{t(CONFIG['description'])}</subtitle>")
    lines += [
        f"  <id>{t(SITE_URL)}</id>",
        f"  <link rel=\"alternate\" type=\"text/html\" href={quoteattr(SITE_URL)}/>",
        f"  <link rel=\"self\" type=\"application/atom+xml\" href={quoteattr(SITE_URL + FEED_NAME)}/>",
        f"  <updated>{updated}</updated>",
        f"  <author><name>{t(SITE_NAME)}</name></author>",
        f"  <icon>{t(SITE_URL)}assets/icon-192.png</icon>",
    ]
    for m, ts in entries:
        url = SITE_URL + m["file"]
        lines += [
            "  <entry>",
            f"    <title>{t(m['title'])}</title>",
            f"    <id>{t(url)}</id>",
            f"    <link rel=\"alternate\" type=\"text/html\" href={quoteattr(url)}/>",
            f"    <published>{ts}</published>",
            f"    <updated>{ts}</updated>",
        ]
        if m["desc"]:
            lines.append(f"    <summary>{t(m['desc'])}</summary>")
        lines += [f"    <category term={quoteattr(tag)}/>" for tag in m["tags"]]
        lines.append("  </entry>")
    lines.append("</feed>")
    return "\n".join(lines) + "\n"
