---
name: "sample"
description: "repo/sample（MemoKit）に関する依頼の入口。HTMLで図解してまとめる、MemoKitに保存、ファクトチェックなど。手順はGitHubのリポジトリから取得して従う。"
---
<!-- scripts/memo.py build が memo.config.json から自動生成。手で編集しない -->

# sample（入口スキル）

このスキルには手順もデザイン規約も書かない。**信頼できる唯一の情報源は GitHub の `repo/sample` リポジトリ**。毎回そこから最新版を取得し、そこに書かれたスキルに従う。

## 使う場面

次のような依頼（言い回しは毎回違う）:

- 「〇〇を HTML で（図とともに）まとめて」「〇〇の図解ページにして」「〇〇のメモを作って」
- 「保存して」「MemoKit に入れて」「メモに追加」
- 「さっきの説明を MemoKit にして」
- 「〇〇をファクトチェックして」「最近のメモを事実確認して」
- そのほか MemoKit リポジトリのページや一覧に関する作業

## 手順

### 1. リポジトリを取得する

作業用ディレクトリに `master` ブランチを浅くクローンする。

```bash
git clone --depth 1 -b master https://github.com/repo/sample.git sample
```

`sample` がすでにあるとき（前の作業の続きなど）は、先に残っている作業を確かめる。

```bash
git -C sample status --porcelain                       # 未コミットの変更
git -C sample log --oneline origin/master..HEAD 2>/dev/null  # push していないコミット
```

どちらかに何か出たら、前の作業が残っている。消さずに、そのことをユーザーに伝えて、続けるか捨てるかを確認する。何も出なければ最新にそろえる。

```bash
git -C sample fetch -q --depth 1 origin master && git -C sample checkout -q -B master FETCH_HEAD
```

クローンも更新もできないとき（エラーはそのまま読む）は、raw URL を WebFetch で読む（振り分けの表 → 必要なスキルの順）。

- https://raw.githubusercontent.com/repo/sample/master/.claude/skills/ROUTING.md
- https://raw.githubusercontent.com/repo/sample/master/.claude/skills/<スキル名>/SKILL.md

WebFetch で読めるのは手順だけで、`scripts/memo.py` は動かせない。そのときにできるのは、既存のメモの内容を答えることと、保存しない下書きを作ることまで。登録・修正・ファクトチェックの反映など `memo.py` や push が要る作業は、クローンできないので進められないと伝えて止まる。どちらも取得できなかったら、作り始める前にその旨を伝えて止まる。**記憶で手順や規約を再現しない。**

### 2. どのスキルを使うか決める

リポジトリの `.claude/skills/ROUTING.md` を読み、「アプリ（claude.ai）の入口スキルから使うとき」の表で依頼に合うスキルを選ぶ。表に無い依頼なら `.claude/skills/` の各 SKILL.md の description を見て選ぶ。それでも合うものが無ければ、その旨を伝えて普通に対応する。

### 3. スキルに従う

選んだスキルの `SKILL.md` を最後まで読み、その手順どおりに進める。保存するかどうか・いつ保存するかも `ROUTING.md` とスキルの記述に従う（このスキル側では決めない）。

リポジトリに書き込む手順（登録・修正・push）に進むときは、`repo/sample` を push 権限付きでセッションに追加してから行う。
