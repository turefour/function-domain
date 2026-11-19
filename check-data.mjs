/* 数据与文案自检：关卡/解法/英文名数量一致、函数族都有教学、i18n 键中英齐全
   用法：node check-data.mjs   （失败时退出码为 1） */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(root, 'game.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const errors = [];
const block = (re) => {
  const m = js.match(re);
  return m ? m[0] : '';
};
const count = (s, re) => (s.match(re) || []).length;

const baseLevels = block(/const LEVELS = \[[\s\S]*?\n  \];/);
const chLevels = block(/const CHALLENGE_LEVELS = \[[\s\S]*?\n  \];/);
const sandbox = block(/const SANDBOX_LEVEL = \{[\s\S]*?\n  \};/);
const sols = block(/const SOLUTIONS = \[[\s\S]*?\n  \];/);
const chSols = block(/const CHALLENGE_SOLUTIONS = \[[\s\S]*?\n  \];/);
const levelEn = block(/const LEVEL_EN = \[[\s\S]*?\n  \];/);
const chEn = block(/const CHALLENGE_EN = \[[\s\S]*?\n  \];/);
const roman = block(/const ROMAN = \[[\s\S]*?\];/);
const kinds = block(/const KINDS = \{[\s\S]*?\n  \};/);
const lessons = block(/const LESSONS = \{[\s\S]*?\n  \};/);
const lessonEn = block(/const LESSON_EN = \{[\s\S]*?\n  \};/);
const lessonEnExt = block(/const LESSON_EN_EXT = \{[\s\S]*?\n  \};/);
const kindEn = block(/const KIND_EN = \{[\s\S]*?\n  \};/);

const counts = {
  BASE: count(baseLevels, /name: '/g),
  CHALLENGE: count(chLevels, /name: '/g),
  SANDBOX: count(sandbox, /name: '/g),
  SOLUTIONS: count(sols, /forms: \[/g) + count(chSols, /forms: \[/g) + 1,
  LEVEL_EN: count(levelEn, /name: '/g) + count(chEn, /name: '/g) + 1,
  ROMAN: count(roman, /'[^']+'/g),
};

/* 两页关卡数量必须一致，解法与英文名覆盖全部关卡 */
if (counts.CHALLENGE !== counts.BASE) {
  errors.push(`挑战页 ${counts.CHALLENGE} 关，与基础页 ${counts.BASE} 关不一致`);
}
const total = counts.BASE + counts.CHALLENGE + counts.SANDBOX;
for (const key of ['SOLUTIONS', 'LEVEL_EN']) {
  if (counts[key] !== total) errors.push(`${key} 有 ${counts[key]} 条，总关卡 ${total} 条`);
}
if (counts.SANDBOX !== 1) errors.push(`测试场应为 1 个，实际 ${counts.SANDBOX}`);
if (counts.ROMAN !== counts.BASE) errors.push(`ROMAN 有 ${counts.ROMAN} 个，基础页 ${counts.BASE} 关`);

const kindKeys = [...kinds.matchAll(/^    (\w+): \{/gm)].map((m) => m[1]);
const lessonKeys = [...lessons.matchAll(/^    (\w+): \{/gm)].map((m) => m[1]);
for (const k of kindKeys) if (!lessonKeys.includes(k)) errors.push(`KINDS.${k} 缺少 LESSONS 条目`);
for (const k of lessonKeys) if (!kindKeys.includes(k)) errors.push(`LESSONS.${k} 没有对应的 KINDS`);

/* 教学五件套 + 英文三处映射，新增函数时最容易漏这里 */
const LESSON_FIELDS = ['sample', 'concept', 'steps', 'pitfalls', 'points'];
for (const k of kindKeys) {
  const seg = lessons.match(new RegExp(`\\n    ${k}: \\{([\\s\\S]*?)\\r?\\n    \\},`));
  if (!seg) { errors.push(`LESSONS.${k} 段落无法解析`); continue; }
  for (const f of LESSON_FIELDS) {
    if (!seg[1].includes(`${f}:`)) errors.push(`LESSONS.${k} 缺少 ${f}`);
  }
  if (!new RegExp(`\\n    ${k}: \\{`).test(lessonEnExt)) errors.push(`LESSON_EN_EXT.${k} 缺失`);
  if (!new RegExp(`\\n    ${k}: \\[`).test(lessonEn)) errors.push(`LESSON_EN.${k} 缺失`);
  if (!new RegExp(`(^|[\\s,])${k}: '`).test(kindEn)) errors.push(`KIND_EN.${k} 缺失`);
}

for (const m of (baseLevels + chLevels + sandbox).matchAll(/tol: ([\d.]+)/g)) {
  const v = parseFloat(m[1]);
  if (!(v >= 0.15 && v < 0.8)) errors.push(`tol=${v} 超出合理范围 (0.15, 0.8)`);
}

/* 函数池硬绑定：每关的 pool 必须存在、无未知函数、且覆盖 seed 与全部解法用到的函数 */
const levelEntries = baseLevels.split(/\r?\n    \{\r?\n/).slice(1)
  .concat(chLevels.split(/\r?\n    \{\r?\n/).slice(1));
const solEntries = sols.split(/\r?\n    \[/).slice(1)
  .concat(chSols.split(/\r?\n    \[/).slice(1));

levelEntries.forEach((raw, i) => {
  const n = i + 1;
  const name = (raw.match(/name: '([^']+)'/) || [])[1] || `L${n}`;
  const seed = (raw.match(/seed: '(\w+)'/) || [])[1];
  const poolRaw = (raw.match(/pool: \[([^\]]*)\]/) || [])[1];

  if (!poolRaw) {
    errors.push(`L${n} ${name} 缺少 pool`);
    return;
  }

  const pool = poolRaw.split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  if (!pool.length) errors.push(`L${n} ${name} 的 pool 为空`);

  const unknown = pool.filter((k) => !kindKeys.includes(k));
  if (unknown.length) errors.push(`L${n} ${name} 的 pool 含未知函数: ${unknown.join(', ')}`);

  if (seed && !pool.includes(seed)) errors.push(`L${n} ${name} 的 seed(${seed}) 不在 pool 中`);

  const solRaw = solEntries[i] || '';
  const used = [...solRaw.matchAll(/kind: '(\w+)'/g)].map((m) => m[1]);
  const missing = [...new Set(used)].filter((k) => !pool.includes(k));
  if (missing.length) errors.push(`L${n} ${name} 的解法用到 ${missing.join(', ')}，但不在 pool 中`);
});

const zhBlock = js.match(/zh: \{([\s\S]*?)\r?\n {4}\},/);
const enBlock = js.match(/en: \{([\s\S]*?)\r?\n {2}\};/);
const zhKeys = new Set([...(zhBlock ? zhBlock[1] : '').matchAll(/'([\w.]+)':/g)].map((m) => m[1]));
const enKeys = new Set([...(enBlock ? enBlock[1] : '').matchAll(/'([\w.]+)':/g)].map((m) => m[1]));
const htmlKeys = [...html.matchAll(/data-i18n="([\w.]+)"/g)].map((m) => m[1]);

for (const k of htmlKeys) {
  if (!zhKeys.has(k)) errors.push(`data-i18n="${k}" 在中文字典中缺失`);
  if (!enKeys.has(k)) errors.push(`data-i18n="${k}" 在英文字典中缺失`);
}
for (const k of zhKeys) if (!enKeys.has(k)) errors.push(`字典键 "${k}" 只有中文，缺英文`);

console.log('counts:', JSON.stringify(counts));
console.log(`kinds=${kindKeys.length} lessons=${lessonKeys.length} i18n zh=${zhKeys.size} en=${enKeys.size} htmlRefs=${htmlKeys.length}`);

if (errors.length) {
  console.error('\n自检未通过：');
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
console.log('\n数据与文案自检通过');
