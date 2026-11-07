// src/assets/memo-quiz.js（各メモの確認クイズの表示）のテスト。表示の枠は memo.py が入れるものと同じ（blocks.QUIZ_BLOCK）
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const root = process.cwd();  // テストはリポジトリのルートで動かす（npm test）
const code = readFileSync(join(root, 'src/assets/memo-quiz.js'), 'utf8');
const block = execFileSync('python3', ['-c',
  'import sys; sys.path.insert(0, "scripts"); from memolib import blocks; print(blocks.QUIZ_BLOCK)'],
  { cwd: root, encoding: 'utf8' })
  // 外部の CSS と JS の読み込みは除く（JS は下で直接動かす）
  .replace(/<link[^>]*>|<script src=[^>]*><\/script>/g, '');

const QUIZ = [
  { q: '問1', choices: ['正1', '誤1'], answer: 0, explain: '説明1', ref: '#s1' },
  { q: '問2', choices: ['誤2', '正2', '誤3'], answer: 1 },
];

function mount(quiz) {
  document.body.innerHTML = '<h2 id="s1">節</h2>' + block +
    `<script type="application/json" id="memo-quiz">${JSON.stringify(quiz)}</script>`;
  new Function(code)();  // document.readyState が loading でなければ、その場で動く
  return document.getElementById('memo-quiz-ui');
}
const choice = (ui, text) => [...ui.querySelectorAll('button')].find(b => b.textContent === text);

describe('memo-quiz.js', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('問題データがあれば枠を表示し、問題を並べる', () => {
    const ui = mount(QUIZ);
    expect(ui.hidden).toBe(false);
    expect(ui.textContent).toContain('問1');
    expect(ui.textContent).toContain('問2');
    expect(choice(ui, '正2')).toBeTruthy();
  });

  it('答えると採点が進み、全問答えると結果が出る', () => {
    const ui = mount(QUIZ);
    choice(ui, '正1').click();
    choice(ui, '誤3').click();
    const result = ui.querySelector('.mq-result');
    expect(result.hidden).toBe(false);
    expect(ui.querySelector('h2 small').textContent).toMatch(/1/);
  });

  it('壊れたデータや形の合わない問題は表示しない', () => {
    expect(mount([{ q: 'x', choices: ['a'], answer: 5 }]).hidden).toBe(true);
    document.body.innerHTML = block + '<script type="application/json" id="memo-quiz">{壊れた</script>';
    new Function(code)();
    expect(document.getElementById('memo-quiz-ui').hidden).toBe(true);
  });
});
