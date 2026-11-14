# 変えたいものと触る場所

モジュールの役割・依存の向き・テストの流し方は memo-maintain スキルにある。

| 変えたいもの | 触る場所 | その後 |
| --- | --- | --- |
| メモの本文・問題 | `src/NAME.html` | `lint NAME` → ファクトチェック → push |
| タイトル・説明・タグ・日付 | `memo.py meta NAME ...` | push |
| クイズの見た目・動き | `src/assets/memo-quiz.css`・`.js` | 全メモに反映（build 不要） |
| 共通部品（ざっくり言うと・よくある誤解・番号付きの手順・表やリストの中のリンク・解説用の色）の見た目 | `src/assets/memo-parts.css`、見本は `template.html` | 全メモに反映。push で `visual.yml` が前後のスクリーンショットを比べる |
| 見た目の決まりのチェック | `memolib/design.py`（ルールを変えたら memo-style・`mechanism/memos.md` も） | テスト、`lint --all` |
| 描画しての表示と色のチェック（SP・PC 幅、コントラスト、色覚の違い） | `tests/visual/check.mjs`（観点を変えたら memo-check も） | テンプレートで `[要対応]` が出ないこと |
| クイズ表示の枠・入る場所 | `memolib/blocks.py` の `QUIZ_BLOCK`・`apply_quiz` | build で全メモが変わる |
| アイコン・OGP のタグ | `memolib/blocks.py` の `head_block` | build で全ページが変わる |
| 一覧に載せる項目 | `memolib/meta.py` の `read_meta`、`memolib/site.py` の `memos_json` | build |
| Markdown 版の変換 | `memolib/markdown.py` の `_ToMarkdown`・`html_to_markdown` | build で全 Markdown 版が変わる |
| 仕組みの 4 ページの共通処理 | `src/assets/memo-site.js`（色の計算は `config.light_accent` と揃える） | `npm test` |
| 上部のナビ | 4 ページそれぞれの `<nav class="nav">` と `.nav` の CSS（4 か所で揃える。クイズ・ロードマップの項目は `data-memo-if`） | — |
| サイト名などを入れる場所 | 4 ページに `data-memo-site*` 属性を付ける | build |
| 設定の項目 | `memolib/config.py` の `DEFAULTS` と検証、`tests/fixtures/memo.config.json` | テスト |
| 設定ページの色の候補 | `src/settings.html` の `PRESETS` | — |
| アイコン・OGP 画像 | 文字・色は `memo.config.json`、デザインは `branding/` | `python3 branding/render.py` → build |
| 新しいメモの雛形 | `.claude/skills/memo-style/template.html` | — |
| 公開ドメイン | `src/CNAME` | build（OGP の URL が変わる） |
| sync の分類 | `memolib/sync.py` の `SITE_PATTERNS`・`REVIEW_PATTERNS` | テスト |
| 入口スキル | `memolib/entry.py`（`ROUTING_PATH`・`ROUTING_HEADING` は変えない） | build、アプリ側に貼り直す |
