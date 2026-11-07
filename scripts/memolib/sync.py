"""memo-kit（テンプレート元）の仕組みを、テンプレートから作ったリポジトリに取り込む（memo.py sync）。

テンプレートから作ったリポジトリは memo-kit と git の履歴を共有しないので、更新を merge では取り込めない。
そこで、ファイルを 3 つに分けて扱う。

- SHARED: どのサイトでも同じ中身にする仕組みのファイル。sync が memo-kit の中身で上書きする
- REVIEW: 仕組みだがサイトごとに書き換えるファイル（スキル・トップなどのページ）。sync は知らせるだけで、
  取り込むかは人が memo-kit の差分を見て決める
- それ以外（memo.config.json・README.md・メモ・画像・CNAME など）: サイトのもの。触らない

取り込んだときの memo-kit のコミットを BASE_FILE に残す。これを基準に、
- SHARED の中で消すのは「基準の時点では memo-kit にあって、今は無いファイル」だけ（サイトだけにあるファイルは残す）
- REVIEW は、基準以降に memo-kit で変わったファイルだけを知らせる（記録がなければ、memo-kit と違うものを全部）
"""
from __future__ import annotations

import filecmp
import json
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from .config import ROOT

SHARED_DIRS = ("scripts", "tests", ".github/workflows")
SHARED_FILES = (
    "memo-detail.md", "CLAUDE.md", ".gitignore",
    "src/.nojekyll", "src/assets/memo-quiz.css", "src/assets/memo-quiz.js",
    "branding/render.py", "branding/og.html", "branding/icon.html", "branding/leaf.css",
)
REVIEW_DIRS = (".claude/skills",)
REVIEW_FILES = ("src/index.html", "src/quiz.html", "src/settings.html", "src/roadmap.html")
BASE_FILE = ".memo-kit-sync"  # 前回取り込んだ memo-kit のコミット（1 行）
KIT_REPOSITORIES = {"repo/sample", "owner/repo", ""}  # memo-kit の memo.config.json の repository（テンプレートの値）


def _git(cwd: Path, *args: str) -> str | None:
    p = subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else None


def _under(path: str, dirs: tuple[str, ...]) -> bool:
    return any(path == d or path.startswith(d + "/") for d in dirs)


def is_shared(path: str) -> bool:
    return _under(path, SHARED_DIRS) or path in SHARED_FILES


def is_review(path: str) -> bool:
    return _under(path, REVIEW_DIRS) or path in REVIEW_FILES


def _tracked(root: Path) -> set[str]:
    out = _git(root, "ls-files", "-z")
    return {f for f in (out or "").split("\0") if f and (root / f).is_file()}


def read_base(root: Path = ROOT) -> str:
    f = root / BASE_FILE
    return f.read_text(encoding="utf-8").strip() if f.is_file() else ""


def kit_problems(kit: Path, root: Path = ROOT, force: bool = False) -> list[str]:
    """取り込む前に止めるべき理由（空なら続けてよい）。force で「memo-kit らしくない」「古い」だけは無視する。"""
    if not (kit / "scripts" / "memo.py").is_file():
        return [f"memo-kit のフォルダではありません（scripts/memo.py が無い）: {kit}"]
    if kit.resolve() == root.resolve():
        return ["このリポジトリ自身は指定できません（memo-kit を別のフォルダに clone して渡す）"]
    if _git(kit, "rev-parse", "HEAD") is None:
        return [f"memo-kit が git のリポジトリではありません（git clone したフォルダを渡す）: {kit}"]
    probs = []
    if _git(kit, "status", "--porcelain"):
        probs.append("memo-kit 側に未コミットの変更があります（コミットしてから、または clone し直してから渡す）")
    if not force:
        try:
            repo = json.loads((kit / "memo.config.json").read_text(encoding="utf-8")).get("repository", "")
        except (OSError, ValueError):
            repo = ""
        if repo.strip().lower() not in KIT_REPOSITORIES:
            probs.append(f"渡したフォルダは memo-kit ではなく、ほかのサイト（{repo}）のようです（違うなら --force）")
        base = read_base(root)
        if base and _git(kit, "cat-file", "-e", f"{base}^{{commit}}") is None:
            probs.append(f"前回取り込んだコミット（{base[:7]}）が、渡した memo-kit の履歴にありません（浅い clone など）。"
                         "履歴ごと clone し直す（git clone --filter=blob:none ...）。わざとなら --force")
        elif base and _git(kit, "merge-base", "--is-ancestor", base, "HEAD") is None:
            probs.append(f"渡した memo-kit は、前回取り込んだコミット（{base[:7]}）より古いか別のブランチです"
                         "（最新の既定ブランチを clone し直す。わざとなら --force）")
    return probs


def own_problems(root: Path = ROOT) -> list[str]:
    """このリポジトリの、上書きするファイルに未コミットの変更があれば止める（黙って消さないため）。"""
    p = subprocess.run(["git", "-C", str(root), "status", "--porcelain", "--", *SHARED_DIRS, *SHARED_FILES],
                       capture_output=True, text=True)
    out = p.stdout.rstrip("\n") if p.returncode == 0 else ""  # 先頭の空白も状態の一部なので strip しない
    if out:
        return ["上書きするファイルに未コミットの変更があります（コミットするか戻してから実行する）:\n" + out]
    return []


@dataclass
class Plan:
    kit_head: str
    kit_branch: str
    base: str                      # 前回取り込んだコミット（記録が無い・履歴に無いときは空）
    added: list[str] = field(default_factory=list)
    changed: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    site_only: list[str] = field(default_factory=list)  # 上書きする場所にあるが、サイトだけにある（残す）
    review: list[str] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.added) + len(self.changed) + len(self.removed)


def plan(kit: Path, root: Path = ROOT) -> Plan:
    kit_files, own_files = _tracked(kit), _tracked(root)
    base = read_base(root)
    base_files: set[str] | None = None
    if base:
        out = _git(kit, "ls-tree", "-r", "--name-only", base)
        if out is None:
            base = ""  # 浅い clone などで履歴に無い
        else:
            base_files = set(out.splitlines())
    p = Plan(kit_head=_git(kit, "rev-parse", "HEAD") or "",
             kit_branch=_git(kit, "branch", "--show-current") or "", base=base)
    shared_kit = {f for f in kit_files if is_shared(f)}
    p.added = sorted(f for f in shared_kit if not (root / f).is_file())
    p.changed = sorted(f for f in shared_kit
                       if (root / f).is_file() and not filecmp.cmp(kit / f, root / f, shallow=False))
    gone = {f for f in own_files if is_shared(f) and f not in kit_files}
    p.removed = sorted(f for f in gone if base_files is not None and f in base_files)
    p.site_only = sorted(gone - set(p.removed))
    if base:
        since = _git(kit, "diff", "--name-only", f"{base}..HEAD") or ""
        p.review = sorted(f for f in since.splitlines() if f and is_review(f))
    else:
        candidates = {f for f in kit_files if is_review(f)} | {f for f in own_files if _under(f, REVIEW_DIRS)}
        p.review = sorted(f for f in candidates if not ((kit / f).is_file() and (root / f).is_file()
                                                        and filecmp.cmp(kit / f, root / f, shallow=False)))
    return p


def apply(kit: Path, p: Plan, root: Path = ROOT) -> None:
    """SHARED を memo-kit の中身にそろえ、取り込んだ memo-kit のコミットを BASE_FILE に残す。"""
    for f in p.added + p.changed:
        (root / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(kit / f, root / f)
    for f in p.removed:
        (root / f).unlink()
    if p.kit_head:
        (root / BASE_FILE).write_text(p.kit_head + "\n", encoding="utf-8")
