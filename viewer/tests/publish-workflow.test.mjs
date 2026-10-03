import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflowUrl = new URL('../../.github/workflows/publish-pages-root.yml', import.meta.url);

test('正式發布只覆蓋根目錄 index.html 與 assets，不破壞 case 原始證據', () => {
  assert.ok(fs.existsSync(workflowUrl), '缺少 publish-pages-root.yml');
  const workflow = fs.readFileSync(workflowUrl, 'utf8');
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /viewer\/dist\/index\.html/);
  assert.match(workflow, /viewer\/dist\/assets/);
  assert.doesNotMatch(workflow, /rm\s+-rf\s+case/);
  assert.doesNotMatch(workflow, /cp\s+-R\s+viewer\/dist\/case/);
  assert.match(workflow, /contents:\s*write/);
});
