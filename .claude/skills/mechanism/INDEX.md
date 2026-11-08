# 仕組みの説明（Claude 向け）

人向けの説明は `memo-detail.md`、作業の手順は各スキル、スキルの振り分けは `ROUTING.md` にある。このフォルダ（`SKILL.md` は無いのでスキルではない）は、仕組みを直す・調べるときに Claude が読む短い説明。`memo.py sync` では上書きされず「見比べる」に出るので、memo-kit の変更は差分を見て反映する。

- **全部は読まない。** 下の表で作業に関係するファイルだけ読む。
- **コードが正。** コマンドの書式は `python3 scripts/memo.py -h`（と `memo.py` 冒頭の docstring）、設定の既定値は `scripts/memolib/config.py` の `DEFAULTS`・`BRANDING_DEFAULTS`、関数はモジュールを読む。ここには書き写さない。

| 作業 | 読むファイル |
| --- | --- |
| メモの構造・メタ情報・クイズデータ・lint を触る | [memos.md](memos.md) |
| build・生成物・自動生成ブロック・Markdown 版・preview を触る | [build.md](build.md) |
| `memo.config.json`・アクセント色・画像・入口スキル・ロードマップを触る | [config.md](config.md) |
| GitHub Actions・`memo.py sync` を触る | [ci-sync.md](ci-sync.md) |
| 何かを変えたいが、どこを触ればよいか | [where-to-change.md](where-to-change.md) |
| モジュールの役割・依存の向き・テスト | memo-maintain スキル |

## 守ること（どの作業でも）

- 原本は `src/` だけ（メモ本文・`<head>` のメタ情報・問題データ）。それ以外は生成物で、すべて `dist/`（`.gitignore` 済み）に書く。生成物は手で直さない。
- `build` は `src/` を書き換えない。`lint`・`meta`・`new`・`add` も `src/` に自動生成ブロックを入れない。
- 公開されるのは `dist/` だけ（Actions が dist ブランチにコミットし、Pages の公開元にする）。原本のブランチに生成物や Actions のコミットを入れない。
- 同じものを 2 か所に書かない。クイズの CSS / JS は `src/assets/memo-quiz.*`、仕組みのページの共通処理は `src/assets/memo-site.js` に 1 つだけ。
- サイトごとの値（サイト名・リポジトリ・ブランチ・タイムゾーン・ドメイン・色）は `memo.config.json` だけに書く。スキルは `memo.py config KEY` で読む。
- パスを知っているのは `memolib/config.py` だけ。スキルは `memo.py path NAME` で引く。
- 依存してよいのは memo-kit だけ。同じ memo-kit から作ったほかのサイトの URL・`llms.txt`・リポジトリを参照しない。
- 標準ライブラリだけで動かす（`branding/render.py` と JS のテストを除く）。
