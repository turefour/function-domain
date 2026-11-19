/* 把当前源码同步到 GitHub 发布目录并推送
   用法：node publish-gh.mjs [目标目录]
   默认目标：C:\Users\GH\Desktop\function-domain（对应仓库 turefour/function-domain） */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || 'C:/Users/GH/Desktop/function-domain';
const GIT = 'C:/Users/GH/CodeBuddy/20261029081733/.tools/mingit/cmd/git.exe';
const FILES = ['index.html', 'style.css', 'game.js', 'standalone.html', 'build-standalone.mjs', 'publish-gh.mjs'];

if (!existsSync(target)) mkdirSync(target, { recursive: true });
for (const name of FILES) {
  copyFileSync(join(root, name), join(target, name));
  console.log('synced', name);
}

const git = (...args) => execFileSync(GIT, args, { cwd: target, stdio: 'inherit' });

git('add', '-A');
try {
  git('-c', 'user.name=CodeVault', '-c', 'user.email=codevault@local',
    'commit', '-m', `sync: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
} catch (e) {
  console.log('没有新的改动需要提交');
}
git('push');
console.log('pushed -> https://github.com/turefour/function-domain');
