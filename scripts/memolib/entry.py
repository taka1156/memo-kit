"""claude.ai のアプリ側に置く入口スキル（entry-skill/SKILL.md）の中身。

入口スキルは「このリポジトリを取ってきて、ここのスキルに従う」だけのもので、手順は書かない。
リポジトリ名とブランチだけはアプリ側で知っている必要があるので、memo.config.json から作る。
build が生成するので手で編集しない（変えたいときはここを直す）。
"""
from __future__ import annotations

import re

from .config import BRANCH, REPOSITORY, SITE_NAME

SKILL_NAME_MAX = 64  # スキル名の長さの上限

ENTRY_NOTE = "<!-- scripts/memo.py build が memo.config.json から自動生成。手で編集しない -->"
# 入口スキルが読む振り分けの表。アプリ側の入口スキルは貼り付けたままの古いコピーなので、
# パスや見出しを変えるとアプリ側が黙って壊れる（tests が ROUTING.md に実在するかを確かめる）
ROUTING_PATH = ".claude/skills/ROUTING.md"
ROUTING_HEADING = "アプリ（claude.ai）の入口スキルから使うとき"


def skill_name(repository: str) -> str:
    """リポジトリ名からスキル名を作る。スキル名に使えるのは小文字・数字・ハイフンだけなので、
    大文字は小文字にし、それ以外の文字（. _ など）はハイフンにまとめる（例: Alice/My.Notes → my-notes）。"""
    name = re.sub(r"[^a-z0-9]+", "-", repository.split("/")[-1].lower()).strip("-")
    return name[:SKILL_NAME_MAX].rstrip("-") or "memo"


def entry_skill() -> str:
    repo = REPOSITORY or "OWNER/REPO"
    folder = repo.split("/")[-1]  # clone 先のフォルダ名（git clone の既定と同じ）
    name = skill_name(repo)
    raw = f"https://raw.githubusercontent.com/{repo}/{BRANCH}"
    branch = BRANCH
    return f"""---
name: "{name}"
description: "{repo}（{SITE_NAME}）に関する依頼の入口。HTMLで図解してまとめる、{SITE_NAME}に保存、ファクトチェックなど。手順はGitHubのリポジトリから取得して従う。"
---
{ENTRY_NOTE}

# {name}（入口スキル）

このスキルには手順もデザイン規約も書かない。**信頼できる唯一の情報源は GitHub の `{repo}` リポジトリ**。毎回そこから最新版を取得し、そこに書かれたスキルに従う。

## 使う場面

次のような依頼（言い回しは毎回違う）:

- 「〇〇を HTML で（図とともに）まとめて」「〇〇の図解ページにして」「〇〇のメモを作って」
- 「保存して」「{SITE_NAME} に入れて」「メモに追加」
- 「さっきの説明を {SITE_NAME} にして」
- 「〇〇をファクトチェックして」「最近のメモを事実確認して」
- そのほか {SITE_NAME} リポジトリのページや一覧に関する作業

## 手順

### 1. リポジトリを取得する

作業用ディレクトリに `{branch}` ブランチを浅くクローンする。

```bash
git clone --depth 1 -b {branch} https://github.com/{repo}.git {folder}
```

`{folder}` がすでにあるとき（前の作業の続きなど）は、先に残っている作業を確かめる。

```bash
git -C {folder} status --porcelain                       # 未コミットの変更
git -C {folder} log --oneline origin/{branch}..HEAD     # push していないコミット
```

どちらかに何か出たら（エラーが出たときも。`origin/{branch}` が無い・別のブランチで clone したフォルダなど）、前の作業が残っているかもしれない。消さずに、そのことをユーザーに伝えて、続けるか捨てるかを確認する。どちらも何も出なければ最新にそろえる。

```bash
git -C {folder} fetch -q --depth 1 origin {branch} && git -C {folder} checkout -q -B {branch} FETCH_HEAD
```

クローンも更新もできないとき（エラーはそのまま読む）は、raw URL を WebFetch で読む（振り分けの表 → 必要なスキルの順）。

- {raw}/{ROUTING_PATH}
- {raw}/.claude/skills/<スキル名>/SKILL.md

WebFetch で読めるのは手順だけで、`scripts/memo.py` は動かせない。そのときにできるのは、既存のメモの内容を答えることと、保存しない下書きを作ることまで。登録・修正・ファクトチェックの反映など `memo.py` や push が要る作業は、クローンできないので進められないと伝えて止まる。どちらも取得できなかったら、作り始める前にその旨を伝えて止まる。**記憶で手順や規約を再現しない。**

### 2. どのスキルを使うか決める

リポジトリの `{ROUTING_PATH}` を読み、「{ROUTING_HEADING}」の表で依頼に合うスキルを選ぶ。表に無い依頼なら `.claude/skills/` の各 SKILL.md の description を見て選ぶ。それでも合うものが無ければ、その旨を伝えて普通に対応する。

### 3. スキルに従う

選んだスキルの `SKILL.md` を最後まで読み、その手順どおりに進める。保存するかどうか・いつ保存するかも `ROUTING.md` とスキルの記述に従う（このスキル側では決めない）。

リポジトリに書き込む手順（登録・修正・push）に進むときは、`{repo}` を push 権限付きでセッションに追加してから行う。
"""
