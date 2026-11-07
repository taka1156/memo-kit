# このリポジトリで作業する Claude へ

- 依頼に合うスキルは [.claude/skills/ROUTING.md](.claude/skills/ROUTING.md) の「リポジトリで作業しているとき」の表で選ぶ。表に無い依頼は `.claude/skills/` の各 SKILL.md の description で選ぶ。
- 仕組み（`scripts/memo.py`・生成物・設定・GitHub Actions）の説明は [memo-detail.md](memo-detail.md) にある。
- `README.md` は人が読むための説明。作業の手順・規約はスキルと memo-detail.md に従い、README は根拠にしない。
- このサイトが依存してよいのは memo-kit（テンプレート元）だけ。同じ memo-kit から作ったほかのサイトの URL・`llms.txt`・リポジトリを、スキル・スクリプト・ワークフロー・ページに書かない（memo-detail.md の「基本の考え方」）。
