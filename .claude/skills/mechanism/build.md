# build・生成物・preview

## build（`memolib/dist.py`）

`src/` は読むだけ。`dist/` に置くべき全ファイルをメモリ上で組み立ててから、`dist/` をその中身にそろえる（変わったファイルだけ書き、要らないファイルは消す）。

1. `src/` のページ以外をコピーする。許可リスト: `src/` 直下の `CNAME`・`.nojekyll` と `assets/` の下（ドットファイル・`.bak` などは除く）。それ以外（下書きのフォルダ・`.env`・シンボリックリンク）は公開せず警告。
2. 各ページに自動生成ブロックとサイト設定を差し込む（下の表）。
3. `memos.json`（日付の新しい順。各メモの問題数 `quizzes` を含む）と `quizzes.json`（1 問 1 行）を作る。崩れた問題は飛ばして警告。
4. `md/*.md` と `llms.txt` を作る。
5. `entry-skill/SKILL.md` を作る。
6. `dist/` をそろえる。

- `--check`: 何も書かず、`dist/` が古ければ名前を出して終了コード 1。
- `--strict`: クイズの崩れや許可リスト外のファイルの警告が 1 件でもあれば、書き出さずに終了コード 1（デプロイが使う）。`repository` がテンプレートのまま（`repo/sample` など）という警告では止まらない。
- 冪等: 2 回続けて実行しても 2 回目は何も変わらない。`dist/` を消して作り直しても同じ中身（テストで確かめている）。
- `quiz: false` のとき: `quiz.html`・`quizzes.json`・`assets/memo-quiz.*` を出さず、`memo:quiz` ブロックを入れず、`memos.json` の問題数は 0。原本の問題データは残す。

## 自動生成ブロック（`memolib/blocks.py`）

開始・終了のコメントで囲み、毎回まるごと作り直す。目印（`<!-- memo:head` など）と `data-memo-site` の書き方は変えない（既存のページがこれで見つけられている）。

| ブロック | 入る場所 | 中身 | 関数 |
| --- | --- | --- | --- |
| `<!-- memo:head -->` | `</head>` の直前 | ファビコン・iOS アイコン・OGP・共通部品の CSS（メモだけ。`assets/memo-parts.css`。ページの `<style>` より後なので同じ強さなら勝つ）・アクセント色（`<style id="memo-accent">`、`html:root` でページの `--accent` を上書き） | `head_block`・`apply_head` |
| `<!-- memo:quiz -->` | フッター（`memo-backlink`）の直前、無ければ最後の `</body>` の直前 | クイズの表示枠と共通 CSS / JS への参照。問題データが無ければ入れない | `apply_quiz` |
| `data-memo-site*` 属性 | 仕組みの 4 ページ | 設定値（`site_fields()`）で中身や属性を置き換える。目印は残す | `apply_site` |
| `data-memo-if` 属性 | 仕組みのページ | 設定（`config.OPTIONAL_PAGES` の値）がオフなら要素ごと消す | `apply_site` |

## AI 向けの Markdown 版（`memolib/markdown.py`）

- `md/NAME.md`: 冒頭にタイトル・説明・URL・タグ・日付、続けて本文。`llms.txt`: 全メモの目次。
- 除くもの: `<head>`・CSS・JS・クイズの表示ブロック・フッター・問題データ。
- SVG は中の文字だけ残す。`<sup>`・`<sub>` は `^`・`_` を付ける（`2^53`）。
- 図や操作できるパーツがある節には、元のページのその節へのリンクを付ける。
- 本文の大半を JS のデータから描画するページは、そのスクリプトをコードブロックとして末尾に付ける。
- 別のメモへのリンクは、そのメモの Markdown 版へのリンクに置き換える。
- よくある誤解（`details.myth`）は、✗・✓ が CSS で付くので「✗ 誤解: …」「✓ 正しくは: …」と言葉を付けて書き出す。

## preview（`memolib/site.py` の `preview_text`）

公開ページは共通ファイルを読み込むので、HTML 1 枚だけでは動かない。`preview` は自動生成ブロックを入れ、`memo-parts.css`・`memo-quiz.css` / `.js`（仕組みのページは `memo-site.js` も）を埋め込み、index / quiz には `window.MEMO_DATA` に JSON の中身を埋め込んで書き出す（`-o` 省略時は一時フォルダの `memo-preview/`）。元のファイルは変えない。index / quiz は `window.MEMO_DATA` があればそれを使い、無ければ fetch する。
