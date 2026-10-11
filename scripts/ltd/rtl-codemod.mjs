#!/usr/bin/env node
// Life-to-Day spike G3 (throwaway): Tailwind physical -> logical codemod + RTL surface counter.
//   node scripts/ltd/rtl-codemod.mjs count [entry ...]   report only
//   node scripts/ltd/rtl-codemod.mjs write               rewrite frontend/**
// "entry" files limit the per-scope report to their transitive relative imports.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[1], '../../..');
const FRONTEND = path.join(ROOT, 'frontend');
const [mode = 'count', ...entries] = process.argv.slice(2);

const B = String.raw`(?<=^|[\s"'\`:!])`; // class-token boundary (start, space, quote, variant, important)
const E = String.raw`(?=$|[\s"'\`])`;
// Auto: physical utility -> Tailwind 3.4 logical utility.
const AUTO = [
  [new RegExp(`${B}(-?)m([lr])-(?!1/2)`, 'g'), (_, n, s) => `${n}m${s === 'l' ? 's' : 'e'}-`],
  [new RegExp(`${B}(-?)p([lr])-`, 'g'), (_, n, s) => `${n}p${s === 'l' ? 's' : 'e'}-`],
  [new RegExp(`${B}(-?)(left|right)-(?!1/2)`, 'g'), (_, n, s) => `${n}${s === 'left' ? 'start' : 'end'}-`],
  [new RegExp(`${B}text-(left|right)${E}`, 'g'), (_, s) => `text-${s === 'left' ? 'start' : 'end'}`],
  [new RegExp(`${B}float-(left|right)${E}`, 'g'), (_, s) => `float-${s === 'left' ? 'start' : 'end'}`],
  [new RegExp(`${B}rounded-([tb])([lr])(?=$|[\\s"'\`-])`, 'g'), (_, v, h) => `rounded-${v === 't' ? 's' : 'e'}${h === 'l' ? 's' : 'e'}`],
  [new RegExp(`${B}rounded-([lr])(?=$|[\\s"'\`-])`, 'g'), (_, s) => `rounded-${s === 'l' ? 's' : 'e'}`],
  [new RegExp(`${B}border-([lr])(?=$|[\\s"'\`-])`, 'g'), (_, s) => `border-${s === 'l' ? 's' : 'e'}`],
  [new RegExp(`${B}scroll-([mp])([lr])-`, 'g'), (_, k, s) => `scroll-${k}${s === 'l' ? 's' : 'e'}-`],
];
// Auto: add the rtl reverse helper next to space-x / divide-x when missing in the same string.
const REVERSE = [
  [/(?<=^|[\s"'`:!])(space-x-\d+(?:\.5)?)(?=$|[\s"'`])/g, 'rtl:space-x-reverse'],
  [/(?<=^|[\s"'`:!])(divide-x(?:-\d+)?)(?=$|[\s"'`])/g, 'rtl:divide-x-reverse'],
];
// Auto v2: mirror directional icons and horizontal translations in RTL.
const ICON_TAG = /<((?:Chevron(?:Double)?|Arrow(?:Long|Small|Uturn)?)(?:Left|Right)Icon)\b([^>]*?)(\/?)>/gs;
const FLIP = 'rtl:-scale-x-100';
function flipIcon(attrs) {
  if (attrs.includes(FLIP) || /\bstyle=/.test(attrs)) return null; // inline transform: manual
  if (/className="/.test(attrs)) return attrs.replace(/className="([^"]*)"/, (_, c) => `className="${c} ${FLIP}"`);
  if (/className=\{`/.test(attrs)) return attrs.replace(/className=\{`([^`]*)`/, (_, c) => `className={\`${c} ${FLIP}\``);
  if (/className=\{'/.test(attrs)) return attrs.replace(/className=\{'([^']*)'/, (_, c) => `className={'${c} ${FLIP}'`);
  if (!/className=/.test(attrs)) return `${attrs} className="${FLIP}"`;
  return null; // computed className: manual
}
const TRANSLATE = /(?<=^|\s)((?:[\w-]+:)*)(-?)translate-x-(?!0(?=$|\s)|1\/2)([\w.\/[\]-]+)(?=$|\s)/g;
// Manual: no safe mechanical rewrite; each hit needs a human look.
const MANUAL = {
  origin: /(?<=^|[\s"'`:!])origin-(?:left|right|top-left|top-right|bottom-left|bottom-right)\b/g,
  inlineStyle: /\b(?:marginLeft|marginRight|paddingLeft|paddingRight|borderLeft\w*|borderRight\w*|left|right)\s*:\s*(?!['"]?(?:auto|unset)\b)[^,}\n]+/g,
  domGeometry: /\.(?:getBoundingClientRect\(\)\.(?:left|right)|scrollLeft|offsetLeft|clientX)\b/g,
};
const CSS_MANUAL = /\b(?:margin-left|margin-right|padding-left|padding-right|border-left[\w-]*|border-right[\w-]*|text-align:\s*(?:left|right)|(?<![\w-])left|(?<![\w-])right)\s*:/g;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return d.name === 'node_modules' ? [] : walk(p);
  return [p];
});
const all = walk(FRONTEND).filter((f) => /\.(tsx?|jsx?|css)$/.test(f));
const isTest = (f) => /__tests__|\.test\.|\.spec\./.test(f);

function reach(starts) {
  const seen = new Set();
  const stack = starts.map((s) => path.resolve(ROOT, s));
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:import|from)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const base = path.resolve(path.dirname(f), m[1]);
      for (const c of [base, ...['.tsx', '.ts', '.jsx', '.js', '.css'].map((x) => base + x), ...['index.tsx', 'index.ts'].map((x) => path.join(base, x))]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) { stack.push(c); break; }
      }
    }
  }
  return seen;
}

function scan(file, write) {
  let src = fs.readFileSync(file, 'utf8');
  const r = { auto: 0, reverse: 0, icon: 0, translate: 0, manual: {} };
  if (file.endsWith('.css')) {
    r.manual.css = (src.match(CSS_MANUAL) || []).length;
    return r;
  }
  let out = src;
  for (const [re, fn] of AUTO) out = out.replace(re, (...a) => { r.auto++; return fn(...a); });
  for (const [re, helper] of REVERSE) {
    out = out.replace(/(["'`])((?:(?!\1)[^\n])*)\1/g, (whole, q, body) => {
      if (!re.test(body) || body.includes(helper)) { re.lastIndex = 0; return whole; }
      re.lastIndex = 0; r.reverse++;
      return `${q}${body} ${helper}${q}`;
    });
  }
  out = out.replace(ICON_TAG, (whole, name, attrs, close) => {
    const next = flipIcon(attrs);
    if (next === null) return whole;
    r.icon++; return `<${name}${next}${close}>`;
  });
  out = out.replace(/(["'`])((?:(?!\1)[^\n])*)\1/g, (whole, q, body) => {
    let changed = false;
    const nb = body.replace(TRANSLATE, (tok, variants, neg, v) => {
      if (variants.includes('rtl:') || variants.includes('ltr:')) return tok;
      const twin = `rtl:${variants}${neg ? '' : '-'}translate-x-${v}`;
      if (body.includes(twin)) return tok;
      changed = true; r.translate++;
      return `${tok} ${twin}`;
    });
    return changed ? `${q}${nb}${q}` : whole;
  });
  for (const [k, re] of Object.entries(MANUAL)) r.manual[k] = (out.match(re) || []).length;
  r.manual.dirIconLeft = [...out.matchAll(ICON_TAG)].filter((m) => !m[2].includes(FLIP)).length;
  if (write && out !== src) fs.writeFileSync(file, out);
  return r;
}

const scope = entries.length ? reach(entries) : null;
const tot = (files) => files.reduce((a, f) => {
  const r = scan(f, mode === 'write');
  a.files += r.auto + r.reverse + r.icon + r.translate + Object.values(r.manual).reduce((x, y) => x + y, 0) ? 1 : 0;
  a.auto += r.auto; a.reverse += r.reverse; a.icon += r.icon; a.translate += r.translate;
  for (const [k, v] of Object.entries(r.manual)) a.manual[k] = (a.manual[k] || 0) + v;
  return a;
}, { files: 0, auto: 0, reverse: 0, icon: 0, translate: 0, manual: {} });

const src = all.filter((f) => !isTest(f));
const report = { mode, source_files: src.length, all: tot(src), tests: tot(all.filter(isTest)) };
if (scope) report.scope = { entries, files: [...scope].filter((f) => !isTest(f)).length, ...tot([...scope].filter((f) => !isTest(f) && all.includes(f)).map((f) => f)) };
if (mode === 'write') delete report.scope;
console.log(JSON.stringify(report, null, 2));
