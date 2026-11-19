/* 把当前源码同步到 GitHub 发布目录并推送
   用法：node publish-gh.mjs [目标目录]
   目标目录优先级：命令行参数 > 环境变量 FD_PUBLISH_DIR > ~/Desktop/function-domain
   git 可执行文件：环境变量 GIT_EXE，默认 PATH 中的 git
   对应仓库：https://github.com/turefour/function-domain */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const root = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  || process.env.FD_PUBLISH_DIR
  || join(homedir(), 'Desktop', 'function-domain');
const GIT = process.env.GIT_EXE || 'git';

const jsSrc = readFileSync(join(root, 'game.js'), 'utf8');
const version = (jsSrc.match(/const VERSION = '([\d.]+)'/) || [])[1];
if (!version) throw new Error('game.js 缺少 VERSION 常量');
const bundle = `函数域-V${version}.html`;

const FILES = [
  'index.html', 'style.css', 'game.js', bundle,
  'build-standalone.mjs', 'check-data.mjs', 'publish-gh.mjs',
  'README.md', 'LICENSE',
];

/* 1. 先重建单文件版本，避免把过期的产物推上去 */
execFileSync(process.execPath, [join(root, 'build-standalone.mjs')], { stdio: 'inherit' });

/* 2. 同步到发布目录，并清掉旧版本产物 */
if (!existsSync(target)) mkdirSync(target, { recursive: true });
for (const name of readdirSync(target)) {
  const old = name === 'standalone.html' || (/^函数域-V.*\.html$/.test(name) && name !== bundle);
  if (old) {
    rmSync(join(target, name), { force: true });
    console.log('removed stale', name);
  }
}
for (const name of FILES) {
  copyFileSync(join(root, name), join(target, name));
  console.log('synced', name);
}

/* 3. 提交并推送 */
const git = (...args) => execFileSync(GIT, args, { cwd: target, encoding: 'utf8', stdio: 'pipe' });

try {
  git('add', '-A');
  git('-c', 'user.name=CodeVault', '-c', 'user.email=codevault@local',
    'commit', '-m', `release: v${version}`);
  console.log('committed');
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}`;
  if (/nothing to commit|no changes added/i.test(out)) {
    console.log('没有新的改动需要提交');
  } else {
    console.error('提交失败：\n' + out.trim());
    process.exitCode = 1;
  }
}

try {
  git('push');
  console.log(`pushed v${version} -> https://github.com/turefour/function-domain`);
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}`.trim();
  console.error('推送失败，本地提交已保留：\n' + out.split('\n').slice(-3).join('\n'));
  console.error('网络或凭据恢复后重新运行本脚本即可补推。');
  process.exitCode = 1;
}
