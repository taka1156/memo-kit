# MemoKit

Claude に作ってもらった図解つきの解説ページ（HTML）を、GitHub Pages で公開・蓄積するためのキットです。
このリポジトリは **テンプレートリポジトリ** なので、「Use this template」から自分のリポジトリを作って使います。

- トップページ: `src/index.html`（メモ一覧・検索・タグ絞り込み・ランダムクイズ）
- クイズページ: `src/quiz.html`（ランダム 10 問・カテゴリ別 10 問（カテゴリは複数選べる）。最後にスコアと正答一覧、本文へのリンク。タイムアタックは制限時間 30 秒／1 分／3 分で、ランダムかカテゴリ（複数可）を選んで何問正解できるかを競い、答えるとすぐ次へ進んで解説は結果にまとめて出す）
- 設定ページ: `src/settings.html`（アクセント色を候補から選ぶか自分で決めて試し、GitHub Actions でサイト全体に固定する。下の「アクセント色を変える」）
- ロードマップ（オプション）: `src/roadmap.html`（書いたメモとこれから書くテーマのチェックリスト。`memo.config.json` の `roadmap` で有効にする。下の「3. `memo.config.json` を書き換える」）
- AI 向けの Markdown 版: `md/` と `llms.txt`（`build` が作る。公開 URL を渡せば、リポジトリを繋いでいない会話でも Claude が過去のメモを読める）
- 設定: `memo.config.json`（サイト名・説明・リポジトリ・ブランチ・タイムゾーン・アイコンと OGP 画像。コードやスキルには直接書かない）
- 原本と公開物: `src/` には手で書く原本だけを置きます（単体で開いて見るものではありません）。`memo.py build` が自動生成ブロックや一覧データを入れた公開用のサイト一式を `dist/` に書き出し、GitHub Actions がその中身を **dist ブランチ**にコミットして GitHub Pages で公開します。生成物はデフォルトブランチに入りません
- 公開 URL: `src/CNAME` があればその独自ドメイン、なければ `https://<owner>.github.io/<name>/`（`python3 scripts/memo.py url` で確認できます。OGP の URL もここから自動で決まります）

**日本語のサイト向けです。** ページの `lang="ja"`、「一覧に戻る」などの表示、`memo.py` のメッセージ、スキル（日本語で書く規約）、フォント（Noto Sans JP）は日本語前提です。

テンプレートのままの状態では、サイト名 `MemoKit`、サンプルのメモ 2 本（`src/sample*.html`）、プレースホルダの画像が入っています。

> [!WARNING]
> **GitHub Pages で公開すると、メモはインターネット上の誰でも読めます。**
> - 各メモ・一覧・クイズのページに加えて、AI 向けの Markdown 版（`md/`・`llms.txt`）も公開され、検索エンジンや AI に読まれることがあります。
> - GitHub の無料プランでは Pages は公開リポジトリでしか使えないため、リポジトリ（メモの原本・コミット履歴・設定）も公開になります。
> - 「さっきの説明をメモにして」（`memo-from-chat`）は会話の内容をそのままページにします。社外秘の情報・個人情報・認証情報などを含む会話はメモにしないでください。
> - 一度公開した内容は、消してもコミット履歴やキャッシュ、第三者の保存に残ることがあります。

## はじめかた

### 1. テンプレートからリポジトリを作る

GitHub でこのリポジトリの「Use this template」→「Create a new repository」。作ったリポジトリを手元に clone します。

### 2. サンプルを消す

```bash
find src -maxdepth 1 -name '*.html' ! -name index.html ! -name quiz.html ! -name settings.html ! -name roadmap.html -delete   # サンプルのメモ
rm -rf dist                                                                            # 生成物（build で作り直す）
```

### 3. `memo.config.json` を書き換える

```json
{
  "site_name": "MyNotes",
  "description": "Claude に作ってもらった解説ページの置き場",
  "llms_description": "Claude に作ってもらった解説ページの集まり。各リンク先は本文を Markdown にしたもので、元のページへの URL も含む。",
  "repository": "alice/my-notes",
  "branch": "main",
  "deploy_branch": "dist",
  "utc_offset_hours": 9,
  "quiz": true,
  "roadmap": false,
  "branding": { "accent": "#00d4ff", "accent_light": "#0077b6", "theme": "dark" }
}
```

- `repository` は自分の `owner/name`。テンプレートの値（`repo/sample`）のままだと `build` が警告します。
- `branch` はリポジトリのデフォルトブランチ（原本を置く。スキルの push 先）。
- `deploy_branch` は `build` の出力を置く公開用のブランチ（既定 `dist`。Actions が作る）。`branch` と同じにはできません。
- `quiz` は確認クイズを使うか（既定 `true`）。`false` にすると、クイズのページ（`quiz.html`）・全問題のデータ・各メモのクイズ表示・トップページのランダムクイズを作らず、スキルも新しいメモにクイズを書きません。
- `roadmap` はロードマップ（`src/roadmap.html`）を使うか（既定 `false`）。`true` にすると、`build` がロードマップのページを `dist/` に出し、各ページ上部のナビとトップページのフッターに「ロードマップ」のリンクを出します。`false` ならページもリンクも作りません（原本の `src/roadmap.html` は残るので、`true` に戻して `build` すれば元どおり出ます）。項目は `src/roadmap.html` の `ROADMAP` に書き、メモを公開すると自動でチェックが付きます（項目決めは `memo-roadmap` スキル）。詳しくは [memo-detail.md の「ロードマップ（オプション）」](memo-detail.md#ロードマップオプション)。
- 書き間違い（JSON の書式・型・範囲）は、`memo.py` を実行したときにどの項目をどう直すかを示して止まります。
- `branding` はサイト全体のアクセント色と、アイコン・OGP 画像の文字・色です。
  - `accent` はダークモード、`accent_light` はライトモードのアクセント色。全ページ（トップ・クイズ・各メモ）に `build` が反映し、画像にも同じ色を使います（公開後は設定ページからも変えられます。下の「アクセント色を変える」）。`accent_light` を省くと、`accent` を白地で読める濃さまで自動で暗くします。
  - `title`・`tagline`・`url`・`mark`・`icon`・`theme` は画像用。空欄はサイト名・説明・公開 URL から埋まります。項目の説明は [memo-detail.md の「サイトごとの設定」](memo-detail.md#サイトごとの設定memoconfigjson) にあります。

### 4. 作り直して確かめる

```bash
python3 branding/render.py                 # アイコン・OGP 画像を設定から作り直す（要: 下の「必要なもの」）
python3 scripts/memo.py build              # dist/ に公開用のサイト一式を生成（src/ は書き換えない）
python3 -m http.server -d dist             # http://localhost:8000/ で表示を確かめる
python3 -B -m unittest discover -s tests   # テスト
```

`src/` などの原本の変更（と作り直した画像）をコミットして push します。`dist/` はコミットしません（`.gitignore` 済み）。

### 5. GitHub の設定

- **Actions の書き込み権限**: Settings → Actions → General → Workflow permissions を「Read and write permissions」にする（`Deploy MEMO` が dist ブランチにコミット・push するため）。
- **最初のデプロイ**: 書き込み権限を付けたあとに push する（または Actions の画面から `Deploy MEMO` を「Run workflow」で実行する）と、dist ブランチができます。
- **Pages**: dist ブランチができたら、Settings → Pages → Source を「Deploy from a branch」、ブランチを `dist`、フォルダを `/ (root)` にする。
- 独自ドメインを使うなら `src/CNAME` にドメインを 1 行書いて push し、DNS を設定する（テンプレートには `src/CNAME` を入れていません。公開 URL の決まり方は冒頭の一覧）。

### 6. Claude から使う

- **Claude Code や、リポジトリを繋いだ claude.ai の会話**: `.claude/skills/` のスキルがそのまま使えます（下の「Claude に頼むとき」）。
- **claude.ai のアプリ**: `build` が作る入口スキルをアプリ側のスキルとして登録します（同じく下の「Claude に頼むとき」）。

## アクセント色を変える

見出し・強調・リンクの色（アクセント色）は、公開したサイトの設定ページ（`https://…/settings.html`。トップページのいちばん下の「設定」から開けます）から変えられます。サーバーはないので、ページで試した色を GitHub Actions で固定します。

1. 設定ページで候補から選ぶか、自分で色を決める（そのページだけがその場で変わり、ダーク・ライトでの見え方とコントラスト比が出ます）。
2. 「GitHub で固定する」で Actions の `Set accent color` を開き、「Run workflow」にページに出た `accent`・`accent_light` を貼って実行する。
3. Actions が `memo.config.json` を書き換え、アイコン・OGP 画像を同じ色で作り直してコミットし、続けて `Deploy MEMO` で全ページを作り直して公開します。3〜5 分でサイトに反映されます（画像はそのままでよければ、実行時に「アイコン・OGP 画像も…」のチェックを外すと 1〜2 分）。

- 実行できるのはリポジトリに書き込み権限がある人だけです（ページを見た人は色を試せるだけで、変えられません）。
- 手元では `python3 scripts/memo.py accent '#3ddc97' '#0f7a50'` で `memo.config.json` を書き換えて push しても同じです。ただし画像は変わらないので、揃えるなら `python3 branding/render.py` も実行してコミットします。

## 必要なもの

| 用途 | 必要なもの |
| --- | --- |
| 仕組みのページの JS のテスト（`npm test`。仕組みを直すときだけ） | Node.js 22.12 以上（22・24・26 などの偶数の版） |
| `scripts/memo.py`（登録・点検・生成）とテスト | Python 3.8 以上（標準ライブラリのみ。テストは 3.11・3.12 で確認、GitHub Actions は 3.12）、git |
| 公開 | GitHub Pages（dist ブランチを公開）、GitHub Actions（build・デプロイとテスト） |
| ページの表示 | 閲覧者のブラウザが Google Fonts（`fonts.googleapis.com` の Noto Sans JP・JetBrains Mono）を読み込みます。読めないときはシステムのフォントで表示されます。メモによっては cdnjs のライブラリを使います（[memo-style](.claude/skills/memo-style/SKILL.md)） |
| `branding/render.py`（アイコン・OGP 画像の生成。設定を変えたときだけ） | `pip install -r branding/requirements.txt`（版を固定）と `python3 -m playwright install chromium`、フォント Noto Sans CJK JP・DejaVu Sans Mono（Ubuntu なら `apt install fonts-noto-cjk fonts-dejavu-core`）。Actions では、設定ページから色を固定する `Set accent color` だけがこれを入れて動かす。それ以外は手元で実行してコミットする |

## Claude に頼むとき

`.claude/skills/` のスキルが、メモの作成・登録・ファクトチェック・参照・ロードマップ・仕組みの修正を受け持ちます。「〜の図解ページを作って」「この HTML をメモに入れて」「さっきの説明をメモにして」のように頼めば、Claude が合うスキルを選びます。どの依頼でどのスキルを使うかは [`.claude/skills/ROUTING.md`](.claude/skills/ROUTING.md) にあります。

- **Claude Code や、リポジトリを繋いだ claude.ai の会話**: 新しい会話では最初に「`<owner>/<name>` リポジトリで作業して」（自分のリポジトリ名）と伝えるとスキルが効きます。
- **claude.ai のアプリ**: `memo.py build` が `memo.config.json` のリポジトリ名とブランチから入口スキル `dist/entry-skill/SKILL.md` を作ります（dist ブランチと公開サイトの `/entry-skill/SKILL.md` にもあります）。これをアプリ側のスキルとして登録します。入口スキルは「このリポジトリを取ってきて、ここのスキルに従う」だけのもので、手順やデザイン規約はアプリ側には書きません。設定を変えたら貼り直してください。

## 仕組みと memo.py

ファイルの構成（原本と生成物）、`scripts/memo.py` の各コマンド、自動生成ブロック、確認クイズのデータの流れ、AI 向けの Markdown 版（`llms.txt`）、サイトごとの設定（`memo.config.json`）、表示の確認とプレビュー、GitHub Actions は、図つきで [memo-detail.md](memo-detail.md) にまとめています。

メモ（中身）と仕組みは分けてあり、仕組みは本物のメモがなくても動きます（テストは `tests/fixtures/` のサンプルで動く）。残すもの・消すものの一覧は [memo-detail.md の「このキットから始める」](memo-detail.md#このキットから始める) にあります。

## ライセンス

[MIT License](LICENSE)。

テンプレートから作ったリポジトリにもこの `LICENSE` がそのまま入ります。仕組み（スクリプト・スキル・テンプレートなど）を使う分には、著作権表示を残せば自由に改変・再配布できます。
`LICENSE` はリポジトリ全体に掛かるように見えるので、自分のメモ（`src/` の中身）を MIT にしたくない場合は、README などにメモの扱いを別に書いてください（例: 「`src/` のメモは CC BY 4.0」「メモの著作権は作者に帰属」）。
