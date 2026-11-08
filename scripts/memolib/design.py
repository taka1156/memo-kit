"""メモの見た目の決まり（memo-style の「共通部品」「色のルール」）のチェック。lint から呼ぶ。

- 共通部品（src/assets/memo-parts.css）の形: ざっくり言うと・よくある誤解
- アクセント色を付けてよい場所（h1・h2 の左線・段落のリンク・ボタンやタブの操作状態）以外で var(--accent) を使っていないか
- 共通部品が決める色（--c-ok など）をページで上書きしていないか、飾り用の色やアクセント色に近い色を使っていないか

problems（[要対応]）と notes（[注意]。失敗にはしない）を返す。
"""
from __future__ import annotations

import html
import re

from .config import accents

# トップページと揃えるトークン（memo-style の「デザイントークン」）。--accent の値は build が上書きする
TOKENS = {"--bg", "--surface", "--fg", "--fg-2", "--line", "--accent", "--chip"}
# 共通部品（memo-parts.css）が値を決める解説用の色。ページでは定義しない
PARTS_VARS = {"--c-ok", "--c-ng", "--c-warn", "--c-hl"}
NEAR_ACCENT = 48           # RGB の距離がこれ未満の色は「アクセント色に見える」とみなす
SUMMARY_ITEMS = 3          # ざっくり言うと の項目数
SUMMARY_MAX_CHARS = 100    # ざっくり言うと の 1 項目の目安（超えたら [注意]）

STYLE_RE = re.compile(r"<style\b[^>]*>(.*?)</style>", re.S | re.I)
SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)
RULE_RE = re.compile(r"([^{}]+)\{([^{}]*)\}")
DECL_RE = re.compile(r"([\w-]+)\s*:\s*([^;]+)")
HEX_RE = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
TAG_RE = re.compile(r"<[^>]+>")
CODE_RE = re.compile(r"<pre\b.*?</pre>|<code\b.*?</code>", re.S | re.I)

# 共通部品のセレクタ（ページの CSS で書き直さない）。番号付きの手順は基本形だけ（中に置く独自の要素の装飾はよい）
PARTS_SELECTOR_RE = re.compile(r"\.summary\b|\.myth\b|ol\.steps(\s*>?\s*li(::?before)?|\s+b)?\s*$")
# 操作の状態（ここに付くアクセント色は「操作できる」目印として許す）
STATE_RE = re.compile(r":(hover|focus|focus-visible|focus-within|active|checked)\b"
                      r"|\[aria-(selected|pressed|current|expanded)\b|\.(on|active|is-active|selected|current)\b")
# 操作できる部品（ボタン・タブ・フォーム）
CONTROL_RE = re.compile(r"^(button|input|select|textarea)\b|\.(btn|tab)\b")
ALWAYS_OK_PROPS = {"accent-color", "caret-color"}


# ---------------------------------------------------------------- 色

def _rgb(hex_: str) -> tuple[int, int, int]:
    h = hex_.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _distance(a: str, b: str) -> float:
    return sum((x - y) ** 2 for x, y in zip(_rgb(a), _rgb(b))) ** 0.5


def accent_like(hex_: str) -> bool:
    """サイトのアクセント色（memo.config.json の branding。ライト・ダーク）に近い色か。"""
    return any(_distance(hex_, a) < NEAR_ACCENT for a in accents())


# ---------------------------------------------------------------- CSS

def _compound(selector: str) -> str:
    """セレクタの最後の部分（a > b c なら c）。"""
    parts = [p for p in re.split(r"\s*[>+~]\s*|\s+", selector.strip()) if p]
    return parts[-1] if parts else ""


def accent_allowed(selector: str, prop: str) -> bool:
    """この宣言で var(--accent) を使ってよいか。"""
    if prop in ALWAYS_OK_PROPS:
        return True
    for sel in selector.split(","):
        sel = sel.strip()
        last = _compound(sel)
        if STATE_RE.search(sel):
            continue
        if re.match(r"h1\b", last):
            continue
        if re.match(r"h2\b", last) and "::" not in last and prop.startswith("border"):
            continue
        if re.match(r"a\b", last) and "::" not in last and prop in ("color", "text-decoration-color"):
            continue
        if CONTROL_RE.search(last) and "::" not in last:
            continue
        return False
    return True


def _rules(text: str):
    for css in STYLE_RE.findall(text):
        for sel, body in RULE_RE.findall(COMMENT_RE.sub("", css)):
            sel = " ".join(sel.split())
            if sel.startswith("@"):
                continue
            yield sel, body


def css_problems(text: str) -> list[str]:
    probs: list[str] = []
    accent_bad, parts_rules, parts_vars, odd_vars, near = [], [], set(), set(), set()
    for sel, body in _rules(text):
        if any(PARTS_SELECTOR_RE.search(s.strip()) for s in sel.split(",")):
            parts_rules.append(sel)
        for prop, value in DECL_RE.findall(body):
            prop = prop.strip().lower()
            if prop.startswith("--"):
                if prop in PARTS_VARS:
                    parts_vars.add(prop)
                elif re.search(r"brand", prop):  # 名前に accent を含む変数は、デザイントークンの解説などで題材になるので見ない
                    odd_vars.add(prop)
                if prop == "--accent":
                    continue
            if "var(--accent)" in value and not accent_allowed(sel, prop):
                accent_bad.append(f"{sel} {{ {prop} }}")
            for h in HEX_RE.findall(value):
                if accent_like("#" + h):
                    near.add(f"{prop}: #{h}")
    if parts_rules:
        probs.append("共通部品（ざっくり言うと・よくある誤解・番号付きの手順）の CSS をページで書いている。"
                     "memo-parts.css に任せて消す: " + "・".join(dict.fromkeys(parts_rules)))
    if parts_vars:
        probs.append("共通部品が決める色をページで定義している（消す。値は memo-parts.css）: " + ", ".join(sorted(parts_vars)))
    if odd_vars:
        probs.append("飾り用の色の変数がある（ブランド色で箱を塗らない。解説の色分けは意味ごとの --c-* にし、凡例やラベルを付ける）: "
                     + ", ".join(sorted(odd_vars)))
    if accent_bad:
        probs.append("アクセント色を付けてよい場所（h1・h2 の左線・段落のリンク・ボタンやタブの操作状態）以外で "
                     "var(--accent) を使っている。箱・図・解説の文字・番号の丸は普通の色か --c-*: "
                     + "・".join(dict.fromkeys(accent_bad)))
    if near:
        probs.append("アクセント色に近い色を使っている（アクセント色に見えるので、はっきり違う色にする）: "
                     + ", ".join(sorted(near)))
    return probs


def markup_problems(text: str) -> list[str]:
    """CSS 以外（JS・SVG・style 属性）での var(--accent) とアクセント色に近い色。"""
    body = CODE_RE.sub("", STYLE_RE.sub("", text))  # コード例の中の var(--accent) は本文
    count, near = 0, set()
    for attrs, js in SCRIPT_RE.findall(body):
        if "application/json" in attrs or "application/ld+json" in attrs:
            continue
        count += js.count("var(--accent)")
    rest = SCRIPT_RE.sub("", body)
    count += rest.count("var(--accent)")
    for h in HEX_RE.findall(rest):
        if accent_like("#" + h):
            near.add("#" + h)
    probs = []
    if count:
        probs.append(f"図・JS・style 属性で var(--accent) を使っている（{count} か所）。図の強調は var(--c-hl)、"
                     "意味のある色分けは --c-* にする")
    if near:
        probs.append("図や style 属性でアクセント色に近い色を使っている: " + ", ".join(sorted(near)))
    return probs


# ---------------------------------------------------------------- 共通部品の形

def _plain(fragment: str) -> str:
    return " ".join(html.unescape(TAG_RE.sub("", fragment)).split())


def summary_problems(text: str) -> tuple[list[str], list[str]]:
    boxes = []
    for m in re.finditer(r"<div\b[^>]*\bclass=\"([^\"]*)\"[^>]*>", text):
        if {"card", "summary"} <= set(m.group(1).split()):
            end = text.find("</div>", m.end())
            boxes.append(text[m.end(): end if end >= 0 else len(text)])
    if not boxes:
        return ["「ざっくり言うと」がない（<div class=\"card summary\"><strong>ざっくり言うと</strong><ul>…）"], []
    probs, notes = [], []
    if len(boxes) > 1:
        probs.append("「ざっくり言うと」が 2 つ以上ある")
    inner = boxes[0]
    if not re.match(r"\s*<strong>\s*ざっくり言うと\s*</strong>\s*<ul\b", inner):
        probs.append("「ざっくり言うと」の形が違う（<strong>ざっくり言うと</strong> のすぐ後に <ul>）")
    items = re.findall(r"<li\b[^>]*>(.*?)</li>", inner, re.S)
    if len(items) != SUMMARY_ITEMS:
        probs.append(f"「ざっくり言うと」は {SUMMARY_ITEMS} 項目にする（今は {len(items)} 項目）")
    long = [i for i, li in enumerate(items, 1) if len(_plain(li)) > SUMMARY_MAX_CHARS]
    if long:
        notes.append(f"「ざっくり言うと」の {', '.join(map(str, long))} 項目目が {SUMMARY_MAX_CHARS} 字を超えている。1 文に縮める")
    return probs, notes


MYTH_HEADING_RE = re.compile(r"<h2\b[^>]*>(?:(?!</h2>).)*誤解(?:(?!</h2>).)*</h2>", re.S)
SECTION_END_RE = re.compile(r"<h2\b|<footer\b|<script\b", re.I)
DETAILS_RE = re.compile(r"<details\b([^>]*)>(.*?)</details>", re.S)


def myth_problems(text: str) -> list[str]:
    probs = []
    for m in re.finditer(r"<(\w+)\b[^>]*\bclass=\"([^\"]*)\"", text):
        if "myth" in m.group(2).split() and m.group(1).lower() != "details":
            probs.append(f"class=\"myth\" は <details> にだけ付ける（今は <{m.group(1)}>）")
            break
    h = MYTH_HEADING_RE.search(text)
    if not h:
        return probs
    end = SECTION_END_RE.search(text, h.end())
    section = text[h.end(): end.start() if end else len(text)]
    items = [(a, inner) for a, inner in DETAILS_RE.findall(section)]
    myths = [(a, inner) for a, inner in items if re.search(r"\bclass=\"[^\"]*\bmyth\b", a)]
    if not myths:
        probs.append("「よくある誤解」は <details class=\"myth\"><summary>誤解</summary><p>正しい説明</p></details> を並べる")
        return probs
    first = DETAILS_RE.search(section)
    if first and _plain(section[: first.start()]):
        probs.append("「よくある誤解」の見出しのすぐ下は <details class=\"myth\"> にする（前置きの文は見出しの前か後ろへ）")
    for i, (_a, inner) in enumerate(myths, 1):
        mm = re.match(r"\s*<summary\b[^>]*>(.*?)</summary>\s*<p\b[^>]*>(.*?)</p>", inner, re.S)
        if not mm:
            probs.append(f"よくある誤解 {i} 個目: <summary>（誤解）のすぐ後に <p>（正しい説明）を置く")
            continue
        q, a = _plain(mm.group(1)), _plain(mm.group(2))
        if re.match(r"[✗✕×❌]", q) or re.fullmatch(r"「[^「」]*」", q):
            probs.append(f"よくある誤解 {i} 個目: 誤解の文に ✗ や「」を書かない（✗ は CSS で付く）")
        if re.match(r"[✓✔○→]", a):
            probs.append(f"よくある誤解 {i} 個目: 説明の頭に ✓ や → を書かない（✓ は CSS で付く）")
    return probs


def design_check(text: str) -> tuple[list[str], list[str]]:
    """(problems, notes)。"""
    s_probs, notes = summary_problems(text)
    return s_probs + myth_problems(text) + css_problems(text) + markup_problems(text), notes
