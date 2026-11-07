"""build の出力（dist/）の中身を組み立てて、dist/ に書き出す。

原本（src/）は読むだけで書き換えない。dist/ は公開するサイト一式で、
src/ のファイルのコピーに、次の生成物を加えたものになる。

- 各ページ（メモ・トップ・クイズ・設定）: 自動生成ブロック（memo:head・memo:quiz）とサイト設定を差し込んだもの
- memos.json・quizzes.json（一覧と全問題。quizzes.json は memo.config.json の quiz が true のときだけ）
- md/NAME.md・llms.txt（AI 向けの Markdown 版）
- entry-skill/SKILL.md（アプリ側に置く入口スキル）

dist/ は .gitignore 済み。Actions がこの中身をそのまま dist ブランチ（memo.config.json の deploy_branch）に
コミットし、GitHub Pages はそのブランチから公開する。
"""
from __future__ import annotations

import sys
from pathlib import Path

from .blocks import QUIZ_CSS, QUIZ_JS, apply_generated
from .config import CONFIG, DIST, SRC, ENTRY_SKILL, SPECIAL_NAMES, page_enabled, read_text
from .entry import entry_skill
from .markdown import LLMS_TXT, MD_DIR, markdown_outputs
from .meta import memo_files
from .site import MEMOS_JSON, QUIZZES_JSON, memos_json, quizzes_json, site_data

# src/ にあってもコピーしないもの（どれも build が作る。昔のリポジトリの生成物が残っていても公開しない）
_GENERATED_NAMES = {MEMOS_JSON.name, QUIZZES_JSON.name, LLMS_TXT.name}
_GENERATED_DIRS = {MD_DIR.name}


_TOP_FILES = {"CNAME", ".nojekyll"}  # src/ 直下でそのまま公開するファイル（ページ以外）
_ASSET_DIR = "assets"                 # この下のファイルはそのまま公開する（ドットファイルとバックアップは除く）
_BACKUP_SUFFIXES = (".bak", ".orig", ".tmp", ".swp", "~")


def _publishable(p: Path, rel: Path) -> bool:
    """そのまま公開してよいファイルか（許可リスト）。下書き・.env・バックアップなどを公開しないため。
    シンボリックリンクは、リンク先（src/ の外のこともある）を公開してしまうので許可しない。"""
    if p.is_symlink() or any(parent.is_symlink() for parent in p.parents if parent != SRC and SRC in parent.parents):
        return False
    if len(rel.parts) == 1:
        return rel.name in _TOP_FILES
    return (rel.parts[0] == _ASSET_DIR and not any(part.startswith(".") for part in rel.parts)
            and not rel.name.lower().endswith(_BACKUP_SUFFIXES))


def _copied_files(problems: list[str] | None = None) -> list[Path]:
    """src/ のうち、そのままコピーするファイル（ページと生成物以外）。
    許可リスト（直下の CNAME・.nojekyll と assets/ の下）にないものは公開せず、problems に足して警告する。"""
    out, skipped = [], []
    for p in sorted(SRC.rglob("*")):
        if not p.is_file() or "__pycache__" in p.parts:
            continue
        rel = p.relative_to(SRC)
        if len(rel.parts) == 1 and (rel.suffix == ".html" or rel.name in _GENERATED_NAMES):
            continue  # ページは自動生成ブロックを入れて書き出す
        if rel.parts[0] in _GENERATED_DIRS:
            continue
        if not CONFIG["quiz"] and p in (QUIZ_CSS, QUIZ_JS):
            continue  # クイズがオフなら表示の CSS / JS も出さない
        if _publishable(p, rel):
            out.append(p)
        else:
            skipped.append(rel.as_posix())
    if skipped:
        msg = ("公開しないファイル（src/ 直下の CNAME・.nojekyll と assets/ の下だけを公開する）: "
               + ", ".join(skipped))
        print(msg, file=sys.stderr)
        if problems is not None:
            problems.append(msg)
    return out


def dist_outputs(problems: list[str] | None = None) -> tuple[dict[Path, bytes], int, int]:
    """dist/ に置くべき全ファイル（{dist/ 内のパス: 中身}）と、メモの件数・問題の数。
    problems を渡すと、公開しないファイルやクイズの崩れの警告文をそこに足す（build --strict が使う）。"""
    want: dict[Path, bytes] = {}
    for p in _copied_files(problems):
        want[DIST / p.relative_to(SRC)] = p.read_bytes()
    # オプションのページ（ロードマップなど）は memo.config.json でオンのときだけ出す
    pages = memo_files() + sorted(SRC / n for n in SPECIAL_NAMES if (SRC / n).is_file() and page_enabled(n))
    for p in pages:
        want[DIST / p.name] = apply_generated(read_text(p), p.name).encode("utf-8")
    memos, quizzes = site_data(problems)
    want[MEMOS_JSON] = memos_json(memos, quizzes).encode("utf-8")
    if CONFIG["quiz"]:  # クイズがオフなら全問題のファイルも作らない
        want[QUIZZES_JSON] = quizzes_json(quizzes).encode("utf-8")
    for path, text in markdown_outputs(memos).items():
        want[path] = text.encode("utf-8")
    want[ENTRY_SKILL] = entry_skill().encode("utf-8")
    return want, len(memos), len(quizzes)


def _existing() -> dict[Path, bytes]:
    if not DIST.is_dir():
        return {}
    return {p: p.read_bytes() for p in DIST.rglob("*") if p.is_file()}


def sync_dist(want: dict[Path, bytes], check: bool) -> tuple[list[str], list[str], list[str]]:
    """dist/ を want と同じ中身にする（check なら何も書かず、違いだけ返す）。
    返り値は (追加, 変更, 削除) のファイル名（dist/ からの相対パス）。"""
    have = _existing()
    rel = lambda p: p.relative_to(DIST).as_posix()
    added = sorted(rel(p) for p in want if p not in have)
    changed = sorted(rel(p) for p in want if p in have and have[p] != want[p])
    removed = sorted(rel(p) for p in have if p not in want)
    if check:
        return added, changed, removed
    for p, body in want.items():
        if have.get(p) != body:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(body)
    for name in removed:
        (DIST / name).unlink()
    # 空になったフォルダを消す（深いものから）
    for d in sorted((d for d in DIST.rglob("*") if d.is_dir()), key=lambda d: len(d.parts), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    return added, changed, removed
