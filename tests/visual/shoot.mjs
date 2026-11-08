// 共通部品の見た目のスクリーンショットを撮る（tests/visual/README は無い。使い方はこのコメント）。
//   node tests/visual/shoot.mjs <リポジトリのフォルダ> <出力フォルダ>
// テンプレート（.claude/skills/memo-style/template.html）には全部品の見本が入っているので、それを
// memo.py preview で 1 枚にし（共通部品の CSS を埋め込む）、ライト・ダーク × 誤解を閉じた・開いたで撮る。
// 外部への通信（Google Fonts）は止める。同じマシンで撮った 2 回分を compare.mjs で比べる前提で、
// 画像をリポジトリに置いて比べることはしない（フォントの違いでマシンごとに少しずつ変わるため）。
// ブラウザは Playwright の Chromium。別のものを使うときは環境変数 MEMO_CHROME に実行ファイルのパス。
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const [repo, out] = process.argv.slice(2).map((p) => resolve(p));
if (!repo || !out) {
  console.error('使い方: node tests/visual/shoot.mjs <リポジトリのフォルダ> <出力フォルダ>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const page1 = join(out, 'template.html');
execFileSync('python3', ['-B', 'scripts/memo.py', 'preview', '.claude/skills/memo-style/template.html', '-o', page1],
  { cwd: repo, stdio: 'inherit' });

const browser = await chromium.launch(process.env.MEMO_CHROME ? { executablePath: process.env.MEMO_CHROME } : {});
try {
  for (const scheme of ['light', 'dark']) {
    for (const open of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 900, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1 });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto('file://' + page1);
      await page.addStyleTag({ content: '*{transition:none!important;animation:none!important}' });
      if (open) await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      await page.locator('.wrap').screenshot({ path: join(out, `${scheme}-${open ? 'open' : 'closed'}.png`) });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
