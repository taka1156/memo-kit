---
name: memo-maintain
description: MEMO リポジトリの Python スクリプト（scripts/memo.py・scripts/memolib/・tests/）やクイズの共通 JS/CSS、トップ・クイズページの JS、GitHub Actions を直すときの手順。「memo.py を直して」「コマンドを追加して」「リファクタして」「テストを足して」などで使う。メモの作成・登録・参照には使わない（memo-style / memo-publish / memo-reference）。
---

# memo-maintain

MEMO の仕組みそのもの（スクリプト・共通ファイル・ワークフロー）を変えるときの手順。
仕組みの説明は `.claude/skills/mechanism/`（索引は `INDEX.md`）にある。**始める前に索引から変更に関係するファイルだけを読み、最後にそこを更新する**。人向けの `memo-detail.md` は、人から見える使い方が変わったときだけ更新する。

## 守ること

- **依存してよいのは memo-kit だけ。** ほかのサイト（同じ memo-kit から作った姉妹サイトなど）の URL・`llms.txt`・リポジトリを、スキル・スクリプト・ワークフロー・ページから参照しない。サイトが増えるたびに全サイトを直すことになる。
- **標準ライブラリだけ。** pip で何かを入れないと動かない形にしない（BeautifulSoup・pytest なども使わない。テストは `unittest`）。仕組みのページの JS のテストだけは Node の vitest を使う（`npm test`。`memo.py` は Node に依存しない）。共通部品の見た目の比較と、描画しての表示・色のチェック（`tests/visual/`）だけは Node の Playwright を使う。
- **入口は `python3 scripts/memo.py` のまま。** スキル・README・Actions がこの呼び方に依存している。処理の本体は `scripts/memolib/` に置き、`memo.py` はコマンドの受け付けだけにする。
- **置き場所を知っているのは `memolib/config.py` だけ。** 他のモジュールやスキルでパスを組み立てない。
- **サイトごとの値は `memo.config.json` だけ。** サイト名・リポジトリ・ブランチ・タイムゾーン・ドメイン・アクセント色を、コード・スキル・ワークフロー・`index.html`／`quiz.html`／`settings.html` に直接書かない（ページには `data-memo-site` の目印を付けて `build` に入れさせる。スキルは `memo.py config KEY` で読む）。仕組みだけを別のリポジトリに持っていけるようにするため。
- **テストは本物のメモに頼らない。** 新しいテストは `tests/fixtures/` のサンプル（`Workspace()`）で書く。本物のメモを確かめるものだけ `RepositoryTest` に置く（メモがないと飛ばされる）。
- **原本は 1 か所、それ以外は生成する。** `src/` は原本だけ。build は `src/` を読むだけで書き換えず、生成物（自動生成ブロックを入れたページ・`memos.json`・`quizzes.json`・`md/`・`llms.txt`・`entry-skill/SKILL.md`）はすべて `dist/`（`.gitignore` 済み）に書き出す。生成物を手で直さず、生成する側を直して `build` する。build 以外のコマンド（lint・meta・new・add）も `src/` に自動生成ブロックを入れない（lint --fix は見つけたら取り除く）。
- **何度実行しても同じ結果になる。** lint・build・meta を 2 回続けて実行しても 2 回目は何も変わらないこと。`dist/` を消して build し直しても同じ中身になること（テストで確かめている）。
- **自動生成ブロックの目印（`<!-- memo:head` など）と `data-memo-site` の書き方は変えない。** 既存のページがその目印で見つけられている。

## モジュールの役割

| ファイル | 役割 |
| --- | --- |
| `scripts/memo.py` | コマンドの受け付け（`cmd_*` と `main`）だけ |
| `memo.config.json` | サイトごとの値（サイト名・説明・リポジトリ・ブランチ・タイムゾーン） |
| `memolib/config.py` | 置き場所（原本の `src/`・出力の `dist/`）・`memo.config.json` の読み込みとアクセント色の書き換え（`set_accent`）・公開 URL・日付・アクセント色の計算・自動生成ブロックの目印 |
| `memolib/meta.py` | `<head>` のメタ情報の読み書き、名前からパスへの解決 |
| `memolib/blocks.py` | 自動生成ブロック（memo:head・memo:quiz）、サイト設定の差し込み（`apply_site`）、フッター、クイズの問題データの検証 |
| `memolib/entry.py` | アプリ側の入口スキル（`dist/entry-skill/SKILL.md`）の中身 |
| `src/settings.html` の JS | アクセント色の候補（`PRESETS`）と画面の動き。色の計算は `memo-site.js` |
| `src/assets/memo-site.js` | 仕組みのページ（index・quiz・settings・roadmap）で共通の処理: 読み込み・エスケープ・シャッフル・出題の条件・選択肢のボタン・色の計算（`lightAccent` は `config.light_accent` と同じ式。変えたら両方を直す。`tests/fixtures/accents.json` で突き合わせる） |
| `tests/js/` | JS のテスト（vitest。`npm ci` のあと `npm test`） |
| `memolib/lint.py` | 崩れのチェックと自動修正 |
| `memolib/design.py` | 見た目の決まり（共通部品の形・アクセント色の使い場所・解説用の色）のチェック。lint から呼ぶ |
| `src/assets/memo-parts.css` | メモの共通部品の見た目（build が memo:head から読み込む） |
| `tests/visual/` | テンプレートのスクリーンショットを撮る・比べる（`shoot.mjs`・`compare.mjs`。`visual.yml` が使う）と、1 枚のページを SP・PC × ライト・ダークで描画して崩れと色を確かめる（`check.mjs`。memo-check スキルが使う）。どれも Node の Playwright |
| `memolib/markdown.py` | AI 向けの Markdown 版 |
| `memolib/site.py` | memos.json・quizzes.json、会話内プレビュー用の 1 枚の HTML |
| `memolib/sync.py` | memo-kit から仕組みのファイルを取り込む（`memo.py sync`）。取り込まない・見比べるだけのファイルの一覧（それ以外はすべて取り込む） |
| `memolib/dist.py` | `dist/` に置く全ファイルを組み立てて書き出す（`src/` のコピー＋生成物。消えたファイルは `dist/` からも消す） |
| `tests/test_cli.py` | コマンドを外から動かす結合テスト（作りを変えても通るもの）。`RepositoryTest` だけ本物のメモを見る |
| `tests/test_units.py` | 関数ごとの単体テスト |
| `tests/snapshot.py` | 全コマンドの出力をフォルダに保存する（前後比較用。本物のメモがなければサンプルで） |
| `tests/fixtures/` | テスト用のサンプルのメモ 2 本と設定 |

モジュール同士の依存は `config ← meta ← blocks ← lint / markdown / site ← dist ← memo.py`（と `config ← entry ← dist`、`config ← design ← lint`）の一方向。逆向きの import を作らない。

## 手順

### 1. 始める前

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -B -m unittest discover -s tests      # 全部通ることを先に確かめる（15 秒ほど）
npm ci && npm test                            # 仕組みのページや src/assets の JS を変えるときは、こちらも
```

通らなければ、変更を始める前にその原因を伝える。

### 2. 変更の種類で分ける

**A. 出力を変えないもの（リファクタリング・整理・高速化）**

前後の出力が 1 バイトも変わらないことを確かめる。

```bash
python3 -B tests/snapshot.py <スクラッチパッド>/before    # 変更の前に
# … 変更する …
python3 -B tests/snapshot.py <スクラッチパッド>/after     # 変更の後に
diff -r <スクラッチパッド>/before <スクラッチパッド>/after   # 何も出なければ OK
```

差分が出たら、それが意図したものでない限り直す。

**B. 出力を変えるもの（機能追加・不具合修正・見た目の変更）**

1. 先にテストを足す・直す（不具合なら、それを再現するテストが失敗することを確かめてから直す）。
2. 実装する。
3. 変更の前後で `tests/snapshot.py` を取り、`diff -r` で `build/`（＝`dist/` の中身）の**変わったファイルの数が想定どおりか**を見る。全ページが変わる変更（memo:head・memo:quiz・Markdown 変換）は、その旨をユーザーに伝えてからコミットする。
4. ページの見た目や動きに関わる変更は、build してからブラウザで確かめる（`python3 -m http.server -d dist` と、会話に見せるなら `memo.py preview`）。

### 3. 仕上げの確認

```bash
python3 -B -m unittest discover -s tests          # 全部通る
npm test                                          # ページや src/assets の JS を変えたとき
python3 -B scripts/memo.py build && git status --short   # dist/ を作り直しても src/ に差分が出ない
python3 -B -m py_compile scripts/memo.py scripts/memolib/*.py tests/*.py
```

GitHub Actions は Python 3.12 で動く。手元に `python3.12` があればそれでもテストを流す。
`-B` を付けて `__pycache__` を作らない（`.gitignore` 済みだが、作業ツリーを汚さない）。

### 4. ドキュメントを合わせる

変えた内容に応じて、次を更新する。

| 変えたもの | 更新する場所 |
| --- | --- |
| コマンド・オプション | `memo.py` 冒頭の使い方と argparse の help、それを使うスキル。コマンドを足したら `memo-detail.md` の「コマンド」の表 |
| メモの構造・lint のルール | `mechanism/memos.md` |
| 生成物・自動生成ブロック・Markdown 版・preview | `mechanism/build.md`（人から見える生成物が増減したら `memo-detail.md` の「build が作るもの」も） |
| モジュールの分け方 | このスキルの「モジュールの役割」と依存の向き、`memo-detail.md` の「コードの構成」の図 |
| ワークフロー・sync | `mechanism/ci-sync.md`、`memo-detail.md` の「GitHub Actions」の表 |
| 設定の項目 | `memolib/config.py` の `DEFAULTS`、`mechanism/config.md`（ルールや注意があれば）、`memo-detail.md` の「サイトごとの設定」の表、テストの `tests/fixtures/memo.config.json` |
| 変更箇所の対応 | `mechanism/where-to-change.md` |
| 仕組みとして残すファイル | `memo-detail.md` の「このキットから始める」、`tests/helpers.py` の `MECHANISM_DOCS` |
| スキルの追加 | `.claude/skills/ROUTING.md` の 2 つの表に 1 行ずつ |

`mechanism/` には既定値・関数一覧・コマンドの書式を書き写さない（コードを見るように書く）。`memo-detail.md` の Mermaid の図を変えたら、描画できることを確かめる（構文エラーだと GitHub で図が出ない）。

### 5. コミット

- コミットするのはスクリプトと原本だけ。生成物（`dist/`）はコミットしない。
- push すると `Test memo.py`（テスト）と `Deploy MEMO`（build して dist ブランチにデプロイ）の 2 つのワークフローが動く。

### 6. memo-kit とテンプレートから作ったリポジトリをそろえる

- 仕組みは memo-kit で直すのが基本。テンプレートから作ったリポジトリで直したときは、同じ変更を memo-kit にも入れる（入れないと、次の `sync` で消える）。
- memo-kit の変更は、各リポジトリで `python3 scripts/memo.py sync <memo-kit を clone したフォルダ>` で取り込み、テストを流してからコミットする。「見比べる」と出たスキルやページは、memo-kit の差分を見てサイトに合う形で手で入れる（`mechanism/ci-sync.md`）。`.claude/skills/mechanism/` も「見比べる」に出るので、差分があれば反映する。
- 仕組みのファイルは足せばそのまま取り込まれる。サイトごとに持つファイル（サンプルのメモ・画像など）や、サイトごとに書き換えるファイルを memo-kit に足したときだけ、`memolib/sync.py` の `SITE_PATTERNS`・`REVIEW_PATTERNS` に足す。

## 過去につまずいたこと

- **日付**: 実行環境の時計は UTC のことがある。「今日」は `config.today()`（`memo.config.json` のタイムゾーン）を使う（`date.today()` を使わない）。
- **埋め込みの閉じタグ**: JS や JSON を `<script>` に埋め込むときは `</script` をエスケープする（`site._inline_tag`・`window.MEMO_DATA`）。
- **共通ファイルとプレビュー**: 公開ページは `src/assets/memo-quiz.*` や JSON を読み込む。HTML 1 枚だけを渡す場面では動かないので、会話に見せるときは `memo.py preview` を通す。
- **Actions の差分検出**: `git diff` は新しく生成された（未追跡の）ファイルを見ない。`git status --porcelain` を使う。
