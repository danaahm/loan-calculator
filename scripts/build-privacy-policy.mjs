// Renders PRIVACY_POLICY.md into docs/index.html, the page Cloudflare Pages
// serves. The Markdown is the only copy anyone edits; this keeps the hosted
// page and the Play Console listing from drifting apart again.
//
//   node scripts/build-privacy-policy.mjs           regenerate docs/index.html
//   node scripts/build-privacy-policy.mjs --check   fail if it is out of date
//
// The Markdown here is a fixed, simple subset (headings, paragraphs, bullet
// lists, bold, links), so it is parsed directly rather than pulling a Markdown
// library into the dependency tree for a page that changes twice a year.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'PRIVACY_POLICY.md');
const TEMPLATE = join(root, 'scripts', 'privacy-policy.template.html');
const OUTPUT = join(root, 'docs', 'index.html');

const INDENT = ' '.repeat(10);
const WIDTH = 78;

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Inline formatting. Markdown links are parked as sentinels first so neither
// the smart quotes nor the email autolinker can reach inside an anchor.
function inline(text) {
  const parked = [];
  let out = escapeHtml(text);

  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    parked.push(`<a href="${href}">${label}</a>`);
    return `\u0000${parked.length - 1}\u0000`;
  });

  // Typographic quotes, matching what the hand-written page used.
  out = out
    .replace(/(^|[\s(\[])"/g, '$1&ldquo;')
    .replace(/"/g, '&rdquo;')
    .replace(/'/g, '&rsquo;');

  out = out.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    (email) => `<a href="mailto:${email}">${email}</a>`,
  );

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => parked[Number(i)]);
}

// Splits on spaces outside a tag, so "<a href=..." is never broken across lines.
function tokenize(html) {
  const tokens = [];
  let current = '';
  let depth = 0;

  for (const char of html) {
    if (char === '<') depth += 1;
    else if (char === '>') depth -= 1;

    if (char === ' ' && depth === 0) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function wrapText(html, indent) {
  const lines = [];
  let line = '';

  for (const token of tokenize(html)) {
    if (!line) line = token;
    else if (indent.length + line.length + 1 + token.length <= WIDTH) line += ' ' + token;
    else {
      lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);

  return lines.map((text) => indent + text).join('\n');
}

// Short blocks stay on one line; longer ones wrap inside their own tags, so a
// one-word policy edit shows up as a one-line diff.
function block(tag, html, indent) {
  const oneLine = `${indent}<${tag}>${html}</${tag}>`;
  if (oneLine.length <= WIDTH) return oneLine;
  return [`${indent}<${tag}>`, wrapText(html, indent + '  '), `${indent}</${tag}>`].join('\n');
}

function parse(markdown) {
  const lines = markdown.split('\n');
  let title = null;
  let effectiveDate = null;
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (list) {
      blocks.push({ type: 'list', items: list });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('# ')) {
      flush();
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
      continue;
    }

    const date = line.match(/^Effective date:\s*(.+)$/i);
    if (date && effectiveDate === null) {
      flush();
      effectiveDate = date[1].trim();
      continue;
    }

    if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      list = list ?? [];
      list.push(line.slice(2).trim());
      continue;
    }

    if (list) flush();
    paragraph.push(line);
  }
  flush();

  if (!title) throw new Error('PRIVACY_POLICY.md: no "# " title heading found');
  if (!effectiveDate) throw new Error('PRIVACY_POLICY.md: no "Effective date:" line found');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new Error(`PRIVACY_POLICY.md: effective date "${effectiveDate}" is not YYYY-MM-DD`);
  }

  return { title, effectiveDate, blocks };
}

// The contact details keep the boxed treatment the hand-written page had, so
// regenerating is not a visible downgrade.
const renderContact = (items) =>
  [
    `${INDENT}<div class="contact">`,
    ...items.map((item) => {
      const pair = item.match(/^([^:]+):\s*(.+)$/);
      const html = pair
        ? `<strong>${inline(pair[1])}:</strong> ${inline(pair[2])}`
        : inline(item);
      return block('p', html, INDENT + '  ');
    }),
    `${INDENT}</div>`,
  ].join('\n');

function render(blocks) {
  const out = [];
  let section = null;

  for (const item of blocks) {
    if (item.type === 'heading') {
      section = item.text;
      if (out.length) out.push('');
      out.push(`${INDENT}<h2>${inline(item.text)}</h2>`);
    } else if (item.type === 'paragraph') {
      out.push(block('p', inline(item.text), INDENT));
    } else if (section === 'Contact') {
      out.push(renderContact(item.items));
    } else {
      out.push(
        `${INDENT}<ul>`,
        ...item.items.map((entry) => block('li', inline(entry), INDENT + '  ')),
        `${INDENT}</ul>`,
      );
    }
  }

  return out.join('\n');
}

const { title, effectiveDate, blocks } = parse(read(SOURCE));
const html = read(TEMPLATE)
  .replaceAll('{{TITLE}}', escapeHtml(title))
  .replaceAll('{{EFFECTIVE_DATE}}', escapeHtml(effectiveDate))
  .replace('{{CONTENT}}', render(blocks));

if (process.argv.includes('--check')) {
  let current;
  try {
    current = read(OUTPUT);
  } catch {
    console.error('docs/index.html is missing. Run: npm run build:privacy');
    process.exit(1);
  }
  if (current !== html) {
    console.error(
      'docs/index.html is out of date with PRIVACY_POLICY.md.\n' +
        'Run "npm run build:privacy" and commit the result.',
    );
    process.exit(1);
  }
  console.log(`docs/index.html is in sync (effective date ${effectiveDate}).`);
} else {
  writeFileSync(OUTPUT, html, 'utf8');
  console.log(`Wrote docs/index.html (effective date ${effectiveDate}).`);
}
