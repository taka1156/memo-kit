# メモ 1 本の構造と lint

## ファイルと名前

- メモ = `src/` 直下の `*.html` のうち、`index`・`quiz`・`settings`・`roadmap` 以外。
- 名前は英小文字・数字・ハイフン（`config.NAME_RE`）。4 つの特別なページ名（`config.SPECIAL_NAMES`）は使えない。
- コマンドの `MEMO` / `NAME` は `docker`・`docker.html`・`src/docker.html` のどれでもよい。既存のファイルパスを渡せばそのファイルが対象（下書きの点検に使う）。
- UTF-8 で読む。読めないファイルがあると、どのコマンドもファイル名を示して止まる。

## `<head>` のメタ情報（一覧はここから読む。`meta.read_meta`）

| 項目 | タグ | 備考 |
| --- | --- | --- |
| タイトル | `<meta name="memo:title">` > `<title>` > ファイル名 | |
| 説明 | `<meta name="description">` | OGP にも使う |
| タグ | `<meta name="memo:tags">` | カンマ区切り。既存のタグ（`memo.py list`）を使い回す |
| 日付 | `<meta name="memo:date">` | `YYYY-MM-DD`。無ければ git でファイルが最初に追加された日 |

- `meta --date` を値なしで実行すると、`utc_offset_hours` のタイムゾーンでの今日が入る（`config.today`）。
- `meta` は指定した項目だけを書き換える。

## 原本に入るもの・入らないもの

- 入る: 本文、`<head>` のメタ情報、ページ固有の `<style>`、`<footer id="memo-backlink">`（`lint --backlink` が追加。自動生成のうちこれだけは原本に入る）、問題データ。
- 入らない: `<!-- memo:head -->`・`<!-- memo:quiz -->` ブロック（`build` が `dist/` にだけ入れる。原本にあれば `lint --fix` が取り除く）。

## 確認クイズの問題データ

```html
<script type="application/json" id="memo-quiz">
[{"q": "問題文", "choices": ["A", "B", "C"], "answer": 0, "explain": "解説", "ref": "#見出しのid"}]
</script>
```

- 形のチェックは `blocks.validate_quiz`・`read_quiz`（choices は 2〜5 個、answer は 0 始まり、ref は `#id` でページ内に飛び先があること、3 問以上で正解の位置が全問同じならエラー）。
- 作問ルールは memo-style の「確認クイズ」。`memo.config.json` の `quiz` が `false` のサイトでは書かない。
- `ref` の飛び先が閉じたタブや `<details>` の中なら、`memo-quiz.js` が開いてから移動する。
- 問題の原本は各メモの中だけ。`quizzes.json` は `build` が集める。

## lint（`memolib/lint.py` の `lint_text`）

`--fix` のときだけ書き込む。終了コードは、`[要対応]` が残るか `--fix` なしで直せるものがあれば 1（`[注意]` だけなら 0）。`--all` は仕組みのページを除く全メモ。

- 直す: `<style>` 内の全角クォート、`* {` が `- {` / `\*` に化けたもの、`<!DOCTYPE html>`・charset・viewport の欠落、原本に入った自動生成ブロック、フッターの「← 一覧に戻る」（`--backlink` のとき）。
- 報告: JS の文字列区切りに全角クォートの疑い、メタ情報の欠落、一覧へのリンクが無い、クイズの崩れ、テンプレートの仮の文が残っている、外部 `<script src>` に版や `integrity` が無い（Google Fonts の `<link>` は対象外）。
- 注意: 正解だけが目立って長い（ほかの 1.3 倍以上）問題が半分以上。
