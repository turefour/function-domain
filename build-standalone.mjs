/* 把 index.html / style.css / game.js 打包成单文件 standalone.html
   用法：node build-standalone.mjs           生成
        node build-standalone.mjs --check   只校验产物是否与源码一致（CI/提交前用）
*/

import { readFileSync, writeFileSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(root, name), 'utf8');

const html = read('index.html');
const css = read('style.css');
const js = read('game.js');

if (css.includes('</style')) throw new Error('style.css 含有 </style，无法安全内联');
if (js.includes('</script')) throw new Error('game.js 含有 </script，无法安全内联');

const styleTag = `<style>\n${css.trimEnd()}\n</style>`;
const scriptTag = `<script>\n${js.trimEnd()}\n</script>`;

let out = html
  .replace(/<link rel="stylesheet" href="style\.css"\s*\/>/, styleTag)
  .replace(/<script src="game\.js"><\/script>/, scriptTag);

if (out === html) throw new Error('未找到 style.css / game.js 引用，模板结构可能已变更');

/* 注释不带时间戳，保证 --check 可以做逐字节比较 */
out = out.replace('</head>', '<!-- 单文件构建：由 build-standalone.mjs 生成，请勿手改 -->\n</head>');

const version = (js.match(/const VERSION = '([\d.]+)'/) || [])[1];
if (!version) throw new Error('game.js 缺少 VERSION 常量');

/* 单文件产物按「函数域 + 版本号」命名 */
const target = join(root, `函数域-V${version}.html`);
const legacy = join(root, 'standalone.html');

if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== out) {
    console.error(`${target.split(/[\\/]/).pop()} 与源码不一致，请先运行 node build-standalone.mjs`);
    process.exit(1);
  }
  console.log(`${target.split(/[\\/]/).pop()} 已是最新`);
  process.exit(0);
}

writeFileSync(target, out, 'utf8');
if (existsSync(legacy)) {
  try {
    unlinkSync(legacy);
    console.log('已移除旧的 standalone.html');
  } catch (e) { /* 删不掉就留着，不影响新产物 */ }
}

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`函数域-V${version}.html 已生成：${kb(statSync(target).size)}（html ${kb(html.length)} + css ${kb(css.length)} + js ${kb(js.length)}）`);
