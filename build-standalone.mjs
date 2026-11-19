/* 把 index.html / style.css / game.js 打包成单文件 standalone.html
   用法：node build-standalone.mjs  （在 function-domain 目录或任意位置执行） */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
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

out = out.replace(
  '</head>',
  `<!-- 单文件构建：${new Date().toISOString().slice(0, 10)} 由 build-standalone.mjs 生成 -->\n</head>`,
);

const target = join(root, 'standalone.html');
writeFileSync(target, out, 'utf8');

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`standalone.html 已生成：${kb(statSync(target).size)}（html ${kb(html.length)} + css ${kb(css.length)} + js ${kb(js.length)}）`);
