# GitHub Actions と memo.py sync

## ワークフロー（`.github/workflows/`）

**`deploy.yml`（Deploy MEMO）**
- 起動: デフォルトブランチへの push（`src/`・`scripts/`・`memo.config.json`・このワークフローの変更）、手動、`set-accent.yml` からの呼び出し。ブランチ名はワークフローに書かない。
- 手順: 履歴ごと checkout（日付の推定に使う）→ `memo.py config branch` がデフォルトブランチと同じか確かめる（違えば止める）→ Python のテスト（`MEMO_SKIP_REPO_TESTS` 付き。本物のメモの状態では止めない）→ 全メモを lint（報告のみ。メモ 0 本なら省略）→ `build --strict`。
- コミット: dist ブランチ（`config deploy_branch`）を `dist/` の中身で丸ごと置き換え、変わっていれば `Deploy <元のコミット>` で push。ブランチが無ければ orphan で作る。原本のブランチには何もコミットしない。
- `concurrency` で同じブランチの実行は 1 本ずつ（途中で止めない）。dist ブランチに書くのはこれだけ。
- JS のテストは流さない（書き込み権限のあるジョブで外のパッケージを動かさないため）。

**`test.yml`（Test memo.py）**: 仕組みのファイル（`scripts/`・`tests/`・共通 JS / CSS・4 ページ・`memo.config.json`・テンプレート・`package*.json`・`vitest.config.mjs`）の変更で、どのブランチでも PR でも動く。Python と JS（`npm ci && npm test`）のテスト。読み取り権限だけ。

**`set-accent.yml`（Set accent color）**: 手動で色を受け取る。3 ジョブに分ける: `render`（読み取り権限のみ・認証情報なし。`memo.py accent` と、`images` がオンなら `branding/render.py`）→ `commit`（書き込み権限。`Set accent color: …` で push）→ `deploy`（Deploy MEMO を呼ぶ。Actions の push では push トリガーが動かないため）。外のパッケージは `render` でだけ動かし、版は `branding/requirements.txt` と Ubuntu の版で固定。色が不正なら何もコミットせず止める。

**`kit-sync.yml`（Check memo-kit）**: テンプレートから作ったリポジトリで週 1 回 `sync --check`。違いがあれば失敗にして注釈を出す。何も書き換えない。memo-kit 自身では動かない。memo-kit の場所はリポジトリ変数 `MEMO_KIT_REPOSITORY` で変えられる。

## sync（`memolib/sync.py`）

テンプレートから作ったリポジトリは memo-kit と履歴を共有しないので、`memo.py sync KIT` で取り込む。取り込まないファイルを列挙し、それ以外はすべて取り込む方式。

| 分類 | パターン | sync がすること |
| --- | --- | --- |
| サイトのもの | `SITE_PATTERNS`（設定・README・LICENSE・`.memo-kit-sync`・メモ・`src/CNAME`・画像・`branding/source.png`） | 触らない |
| 見比べる | `REVIEW_PATTERNS`（`.claude/skills/**`、`src/` の 4 ページ） | 書き換えない。前回取り込んだコミット以降に memo-kit で変わったものを、差分を見るコマンドと一緒に出す。人（Claude）が差分を見てサイトに合う形で反映する |
| 仕組み | 上記以外すべて | memo-kit の中身で上書き。前回あって今は無いファイルは消す。サイト独自のファイルは消さない（「残す」と表示） |

- 前回取り込んだ memo-kit のコミットは `.memo-kit-sync`。消すファイルと「見比べる」はこれを基準に決まる。無いときは memo-kit と違うものを全部「見比べる」に出す。
- `--check` は違いを出すだけ（上書きするファイルに違いがあれば終了コード 1、「見比べる」だけなら 0）。
- 止まる条件: KIT が git リポジトリでない・KIT に未コミットの変更・上書きするファイルに未コミットの変更（`--check` 以外）・KIT の `repository` がテンプレートの値でない（ほかのサイトを渡した）・前回より古いか別ブランチ・前回のコミットが KIT の履歴に無い（浅い clone。`--filter=blob:none` で clone し直す）。わざとなら `--force`。
- memo-kit にサイトのもの（サンプルのメモや画像など）を足すときは `SITE_PATTERNS` にも足す（忘れると各サイトに取り込まれる）。
- `sync.py` 自身が変わった回は古い決まりで判定される。知らせが出たらコミットしてもう一度 `sync`。
- `src/` の 4 ページとスクリプトの両方が変わったときは同じコミットで反映する（片方だけだとテストが落ちて公開も止まる）。`git -C KIT diff 前回..今回 -- src/index.html | git apply` でサイト固有の部分を残して当てられる。
