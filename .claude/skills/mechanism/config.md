# memo.config.json・アクセント色・画像・入口スキル・ロードマップ

## memo.config.json（`memolib/config.py` の `load_config`）

項目と既定値は `DEFAULTS`・`BRANDING_DEFAULTS` を読む。今の値は `python3 scripts/memo.py config [KEY]`（公開 URL `site_url` も出る）。

- 書き間違い（JSON・型・範囲・空にできない項目・`deploy_branch` が `branch` と同じ・知らない項目や `branding` のおかしな値）は、項目名と直し方を示して止まる（traceback は出さない）。項目を足すときはエラーの判定とテストの `tests/fixtures/memo.config.json` も直す。
- `repository` が空・`owner/name` でない・テンプレートの値のときは、`build` が警告して続ける。
- `quiz`・`roadmap` は `config.OPTIONAL_PAGES` でページ名と対応する。オフのページは `dist/` に出さず、`data-memo-if` の要素を消す。
- `branding.accent_light` を省くと、`accent` を白地とのコントラスト比 4.5 以上になるまで暗くした色（`config.light_accent`）。同じ式が `memo-site.js` の `lightAccent` にもあるので、変えたら両方直す（`tests/fixtures/accents.json` で突き合わせる）。

## 公開 URL・画像

- 公開 URL は `src/CNAME` の独自ドメイン、無ければ `repository` から `https://OWNER.github.io/REPO/`（`config.site_url`）。`og:url`・`og:image` の絶対 URL にも使う。
- `og:image` には `og.png` の中身のハッシュを `?v=…` で付ける（`config.asset_version`）。
- アイコン・OGP 画像は `branding/`（`og.html`・`icon.html`・`leaf.css`、テーマ色は `render.py` の `THEMES`）から `python3 branding/render.py` で `src/assets/` に書く。文字と色は設定から入れる。`render.py` だけは標準ライブラリで動かない（playwright・chromium・Pillow・フォント。`branding/requirements.txt`）。`build` だけでは画像は変わらない。

## アクセント色

- `memo.py accent COLOR [LIGHT]` は `memo.config.json` の `branding.accent`・`accent_light` だけを書き換える（ほかの項目と並び順はそのまま。`config.set_accent`）。反映は `build`、公開はデプロイ。
- 設定ページ（`src/settings.html`。候補は `PRESETS`）は色を試すだけ。固定は `.github/workflows/set-accent.yml`（詳しくは [ci-sync.md](ci-sync.md)）。

## 入口スキル（`memolib/entry.py`）

- `build` が `dist/entry-skill/SKILL.md` を作る。中身はリポジトリを clone して `ROUTING.md` に従うだけ。
- スキル名はリポジトリ名から作る（小文字に、英数字以外はハイフンに、64 文字まで）。clone 先のフォルダ名はリポジトリ名のまま。
- 未コミットの変更や push していないコミットがあれば消さずにユーザーに確認する。clone できず WebFetch で読めただけなら、参照と保存しない下書きまで（`memo.py` が動かないので登録・修正はしない）。
- アプリ側の古いコピーが残るので、`ROUTING_PATH`（`.claude/skills/ROUTING.md`）と `ROUTING_HEADING` は変えない（テストで確かめている）。

## ロードマップ（`src/roadmap.html`）

- `roadmap: true` のときだけ公開。各ページ上部のナビとトップのフッターのリンクは `data-memo-if="roadmap"`。
- 項目はスクリプト冒頭の `ROADMAP`。書いたメモは `file` だけ、これから書くテーマは `title`・`prio`（`high` / `mid` / `low`）・`note`。別名でも済みにするなら `alt`。
- チェックはページが `memos.json` を読んで付ける（`file` か `alt` が一致）。どの項目にも当てはまらないメモは「ロードマップ外のメモ」に並ぶ。
- 項目を決める・その順に書くのは memo-roadmap スキル。
