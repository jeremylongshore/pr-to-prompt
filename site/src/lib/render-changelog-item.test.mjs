import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml, renderChangelogItem } from './render-changelog-item.mjs';

test('escapes every HTML-significant character', () => {
  assert.equal(
    escapeHtml(`<script data-value="one">alert('two') & more</script>`),
    '&lt;script data-value=&quot;one&quot;&gt;alert(&#39;two&#39;) &amp; more&lt;/script&gt;',
  );
});

test('adds only the constrained bold and code markup after escaping input', () => {
  const rendered = renderChangelogItem(
    '**<img src=x onerror=alert(1)>** and `<script>alert(2)</script>`',
  );

  assert.equal(
    rendered,
    '<strong class="text-text font-medium">&lt;img src=x onerror=alert(1)&gt;</strong> and <code class="px-1 py-0.5 rounded bg-surface-2 text-primary-light text-xs font-mono">&lt;script&gt;alert(2)&lt;/script&gt;</code>',
  );
  assert.equal(rendered.includes('<img'), false);
  assert.equal(rendered.includes('<script'), false);
});
