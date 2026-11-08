# このリポジトリで作業する Claude へ

- 依頼に合うスキルは [.claude/skills/ROUTING.md](.claude/skills/ROUTING.md) の「リポジトリで作業しているとき」の表で選ぶ。表に無い依頼は `.claude/skills/` の各 SKILL.md の description で選ぶ。
- 仕組み（`scripts/memo.py`・生成物・設定・GitHub Actions）を調べる・直すときは [.claude/skills/mechanism/INDEX.md](.claude/skills/mechanism/INDEX.md) から、作業に関係するファイルだけを読む。`memo-detail.md` は人向けの説明。
- `README.md` は人が読むための説明。作業の手順・規約はスキルと `.claude/skills/mechanism/` に従い、README と memo-detail.md は根拠にしない。
- このサイトが依存してよいのは memo-kit（テンプレート元）だけ。同じ memo-kit から作ったほかのサイトの URL・`llms.txt`・リポジトリを、スキル・スクリプト・ワークフロー・ページに書かない（`.claude/skills/mechanism/INDEX.md` の「守ること」）。
