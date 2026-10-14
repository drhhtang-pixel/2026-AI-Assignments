#!/usr/bin/env node
// Security test for the gallery build: feeds fictional malicious submissions
// into build-gallery.js and checks that the generated HTML stays inert.
// Run from repo root: node scripts/test-build-gallery.js
// Uses a temp directory only; does not read or write submissions/, index.html or gallery.json.

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { escapeHtml, decodeBasicEntities, checkExternalUrl } = require('./lib/sanitize');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

// --- 1. Unit tests: sanitize helpers ---
console.log('sanitize.js');

test('escapeHtml escapes & < > " \'', () => {
  assert.strictEqual(escapeHtml(`<a href="x" title='y'>&</a>`),
    '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('decodeBasicEntities + escapeHtml does not double-escape', () => {
  assert.strictEqual(escapeHtml(decodeBasicEntities('A &amp; B &#60;x&#x3E;')), 'A &amp; B &lt;x&gt;');
});

test('decodeBasicEntities leaves control, surrogate and out-of-range code points as text', () => {
  for (const e of ['&#1;', '&#x1F;', '&#xD800;', '&#57343;', '&#x110000;', '&#99999999;']) {
    assert.strictEqual(decodeBasicEntities(e), e);
  }
});

const accepted = [
  ['https://example.com/', 'https://example.com/'],
  ['https://example.com/a?b=1&c=2#top', 'https://example.com/a?b=1&c=2#top'],
  ['https://例子.example/作品', 'https://xn--fsqu00a.example/%E4%BD%9C%E5%93%81'],
];
for (const [input, expected] of accepted) {
  test(`accepts ${input}`, () => {
    assert.deepStrictEqual(checkExternalUrl(input), { ok: true, url: expected });
  });
}

const rejected = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'http://example.com/',
  'HTTPS://example.com/',
  '//example.com/',
  'https:/example.com/',
  'https://example.com/"><script>alert(1)</script>',
  "https://example.com/' onmouseover='alert(1)",
  'https://example.com/ onmouseover=alert(1)',
  'https://example.com/\tx',
  'https://example.com/\u0000x',
  'https://example.com/`x`',
  'https://example.com\\@evil.example/',
  'https://user:pass@example.com/',
  'https://%75ser@example.com/',
  'https://%22.example/',
  'https://',
  '',
];
for (const input of rejected) {
  test(`rejects ${JSON.stringify(input)}`, () => {
    assert.strictEqual(checkExternalUrl(input).ok, false);
  });
}

// --- 2. Integration test: build-gallery.js on fictional submissions ---
console.log('build-gallery.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-test-'));
const subDir = path.join(tmp, 'submissions');
const outDir = path.join(tmp, 'out');
fs.mkdirSync(subDir);
fs.mkdirSync(outDir);

function addSubmission(dirName, files) {
  const dir = path.join(subDir, dirName);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'thumbnail.png'), '');
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

// All IDs and names below are fictional.
addSubmission('T001-<img src=x onerror=alert(1)>', { 'index.html': '<title>ok</title>' });
addSubmission('T002-quote"onmouseover="alert(2)', { 'index.html': '<title>x" onerror="alert(3)</title>' });
addSubmission('T003-js', { 'url.txt': 'javascript:alert(4)\n<script>alert(5)</script>\n' });
addSubmission('T004-data', { 'url.txt': 'data:text/html,<script>alert(6)</script>\n' });
addSubmission('T005-breakout', { 'url.txt': 'https://example.com/"><script>alert(7)</script>\n' });
addSubmission('T006-space', { 'url.txt': 'https://example.com/ onmouseover=alert(8)\n' });
addSubmission('T007-ok', { 'url.txt': 'https://example.com/a?b=1&c=2\r\nA & B\r\n' });
addSubmission('T008-entity', { 'index.html': '<title>Tom &amp; Jerry</title>' });
addSubmission("T009-single'quote", { 'index.html': "<title>it's</title>" });
// Uses only tags/attributes the template itself uses, so a name-allowlist alone would miss it
addSubmission('T010-allowed-tags', { 'url.txt': 'https://example.com/\n<img src="https://example.com/t.png" style="position:fixed">\n' });

// Expected card shape, in sorted folder order: link = card wrapped in <a>, badge = external-link <span>
const CARDS = [
  { dir: 'T001-<img src=x onerror=alert(1)>', link: true, badge: false },
  { dir: 'T002-quote"onmouseover="alert(2)', link: true, badge: false },
  { dir: 'T003-js', link: false, badge: true },
  { dir: 'T004-data', link: false, badge: true },
  { dir: 'T005-breakout', link: false, badge: true },
  { dir: 'T006-space', link: false, badge: true },
  { dir: 'T007-ok', link: true, badge: true },
  { dir: 'T008-entity', link: true, badge: false },
  { dir: "T009-single'quote", link: true, badge: false },
  { dir: 'T010-allowed-tags', link: true, badge: true },
];

const run = spawnSync(process.execPath, [path.join(__dirname, 'build-gallery.js')], {
  env: { ...process.env, GALLERY_SUBMISSIONS_DIR: subDir, GALLERY_OUT_DIR: outDir },
  encoding: 'utf8',
});
if (run.status !== 0) {
  console.error(run.stderr);
  throw new Error(`build-gallery.js exited with ${run.status}`);
}

const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
const json = JSON.parse(fs.readFileSync(path.join(outDir, 'gallery.json'), 'utf8'));

const ALLOWED_TAGS = new Set(['html', 'head', 'meta', 'title', 'style', 'body', 'header', 'div',
  'img', 'h1', 'p', 'nav', 'a', 'main', 'footer', 'span']);
const ALLOWED_ATTRS = new Set(['lang', 'charset', 'name', 'content', 'class', 'src', 'alt', 'href',
  'target', 'rel', 'style']);

// Every "<" must start a well-formed tag from the template's own vocabulary,
// with only double-quoted attribute values. This only checks names; the
// per-card structure test below checks that no extra (allowed) tags appear.
function scanTags(doc) {
  const tags = [];
  const openTag = /<([a-z0-9]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*>/y;
  const closeTag = /<\/([a-z0-9]+)>/y;
  const doctype = /<!DOCTYPE html>/y;
  for (let i = doc.indexOf('<'); i !== -1; i = doc.indexOf('<', i + 1)) {
    for (const re of [doctype, closeTag, openTag]) re.lastIndex = i;
    if (doctype.test(doc)) continue;
    let m = closeTag.exec(doc);
    if (m) {
      assert.ok(ALLOWED_TAGS.has(m[1]), `unexpected closing tag </${m[1]}>`);
      tags.push({ name: `/${m[1]}`, attrs: {} });
      continue;
    }
    m = openTag.exec(doc);
    assert.ok(m, `stray "<" at offset ${i}: ${JSON.stringify(doc.slice(i, i + 60))}`);
    assert.ok(ALLOWED_TAGS.has(m[1]), `unexpected tag <${m[1]}>`);
    const attrs = {};
    for (const a of m[2].matchAll(/([a-z-]+)="([^"]*)"/g)) {
      assert.ok(ALLOWED_ATTRS.has(a[1]), `unexpected attribute ${a[1]} on <${m[1]}>`);
      attrs[a[1]] = a[2];
    }
    tags.push({ name: m[1], attrs });
  }
  return tags;
}

let tags = [];
test('every tag and attribute name is one the template uses', () => {
  tags = scanTags(html);
});

test('each card has exactly the template\'s tag structure (no extra nodes)', () => {
  const start = tags.findIndex(t => t.name === 'div' && t.attrs.class === 'grid');
  const end = tags.findIndex(t => t.name === '/main');
  assert.ok(start !== -1 && end > start, 'grid not found');
  const actual = tags.slice(start + 1, end - 1).map(t => t.name); // drop grid's own </div>
  const expected = CARDS.flatMap(c => [
    'div', c.link ? 'a' : 'div', 'img', 'div', 'div', ...(c.badge ? ['span', '/span'] : []), '/div',
    'div', '/div', '/div', c.link ? '/a' : '/div', '/div',
  ]);
  assert.deepStrictEqual(actual, expected);
  const imgs = tags.slice(start + 1, end - 1).filter(t => t.name === 'img');
  assert.deepStrictEqual(imgs.map(t => t.attrs.src),
    CARDS.map(c => escapeHtml(`submissions/${encodeURIComponent(c.dir)}/thumbnail.png`)));
});

test('no <script> and no event-handler attributes', () => {
  assert.ok(!/<script/i.test(html));
  assert.ok(!tags.some(t => Object.keys(t.attrs).some(k => k.startsWith('on'))));
});

test('every href is https:// or a relative submissions/ path', () => {
  const hrefs = tags.filter(t => t.name === 'a').map(t => t.attrs.href);
  for (const h of hrefs) {
    assert.ok(h.startsWith('https://') || h.startsWith('submissions/') || h === 'git-guide.html',
      `unsafe href ${h}`);
  }
});

test('unsafe url.txt links produce cards without a link', () => {
  const hrefs = tags.filter(t => t.name === 'a').map(t => t.attrs.href);
  assert.ok(!hrefs.some(h => /^(javascript|data):/i.test(h) || h.includes('example.com/%22')));
  // T001, T002, T008, T009 (local) + T007, T010 (valid external) + nav link
  assert.strictEqual(hrefs.length, 7);
});

test('valid external link keeps & escaped in the attribute', () => {
  assert.ok(html.includes('href="https://example.com/a?b=1&amp;c=2"'));
  assert.ok(html.includes('>A &amp; B<span'));
});

test('folder name and titles are shown as escaped text', () => {
  assert.ok(html.includes('T001-&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('T002-quote&quot;onmouseover=&quot;alert(2)'));
  assert.ok(html.includes('alt="x&quot; onerror=&quot;alert(3)"'));
  assert.ok(html.includes('&lt;script&gt;alert(5)&lt;/script&gt;'));
  assert.ok(html.includes('T009-single&#39;quote'));
  assert.ok(html.includes('&lt;img src=&quot;https://example.com/t.png&quot; style=&quot;position:fixed&quot;&gt;'));
});

test('folder names are percent-encoded in paths', () => {
  assert.ok(html.includes('src="submissions/T001-%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E/thumbnail.png"'));
});

test('entities in <title> are not double-escaped', () => {
  assert.ok(html.includes('>Tom &amp; Jerry<'));
  assert.ok(!html.includes('&amp;amp;'));
});

test('build warns about each rejected url.txt', () => {
  const warnings = run.stderr.split('\n').filter(l => l.startsWith('WARNING: ignoring url.txt'));
  assert.strictEqual(warnings.length, 4, run.stderr);
});

test('gallery.json: unsafe links are null, text stays raw for consumers to escape', () => {
  const byDir = Object.fromEntries(json.entries.map(e => [e.dirName, e]));
  for (const d of ['T003-js', 'T004-data', 'T005-breakout', 'T006-space']) {
    assert.strictEqual(byDir[d].href, null, d);
  }
  assert.strictEqual(byDir['T007-ok'].href, 'https://example.com/a?b=1&c=2');
  assert.strictEqual(byDir['T003-js'].title, '<script>alert(5)</script>');
  assert.ok(byDir['T001-<img src=x onerror=alert(1)>'].thumbnail.endsWith('/submissions/T001-%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E/thumbnail.png'));
});

fs.rmSync(tmp, { recursive: true, force: true });

console.log(process.exitCode ? '\nFAILED' : `\nAll ${passed} tests passed.`);
