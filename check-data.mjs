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

const levels = block(/const LEVELS = \[[\s\S]*?\n  \];/);
const sols = block(/const SOLUTIONS = \[[\s\S]*?\n  \];/);
const levelEn = block(/const LEVEL_EN = \[[\s\S]*?\n  \];/);
const roman = block(/const ROMAN = \[[\s\S]*?\];/);
const kinds = block(/const KINDS = \{[\s\S]*?\n  \};/);
const lessons = block(/const LESSONS = \{[\s\S]*?\n  \};/);
const lessonEn = block(/const LESSON_EN = \{[\s\S]*?\n  \};/);
const lessonEnExt = block(/const LESSON_EN_EXT = \{[\s\S]*?\n  \};/);
const kindEn = block(/const KIND_EN = \{[\s\S]*?\n  \};/);

const counts = {
  LEVELS: count(levels, /name: '/g),
  SOLUTIONS: count(sols, /forms: \[/g),
  LEVEL_EN: count(levelEn, /name: '/g),
  ROMAN: count(roman, /'[^']+'/g),
};

for (const [key, value] of Object.entries(counts)) {
  if (value !== counts.LEVELS) {
    errors.push(`${key} 有 ${value} 条，与 LEVELS(${counts.LEVELS}) 不一致`);
  }
}

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

for (const m of levels.matchAll(/tol: ([\d.]+)/g)) {
  const v = parseFloat(m[1]);
  if (!(v > 0.1 && v < 0.8)) errors.push(`tol=${v} 超出合理范围 (0.1, 0.8)`);
}

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
