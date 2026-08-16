// app/scripts/validate.js
// 小程序「构建」校验（原生小程序无编译产物，此脚本验证项目结构健全性）
// 检查：1) 所有 .js 语法合法  2) 所有 .json 可解析  3) app.json 页面四件套齐全

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP_ROOT = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = new Set(['node_modules', '__tests__', '.git']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(APP_ROOT);
const errors = [];

// 1) .js 语法检查
for (const f of files.filter(f => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    errors.push(`语法错误: ${path.relative(APP_ROOT, f)}\n${e.stderr}`);
  }
}

// 2) .json 可解析
for (const f of files.filter(f => f.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    errors.push(`JSON 解析失败: ${path.relative(APP_ROOT, f)} (${e.message})`);
  }
}

// 3) app.json 页面四件套齐全
const appJson = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'app.json'), 'utf8'));
for (const page of appJson.pages || []) {
  for (const ext of ['js', 'wxml', 'wxss', 'json']) {
    const p = path.join(APP_ROOT, `${page}.${ext}`);
    if (!fs.existsSync(p)) errors.push(`页面文件缺失: ${page}.${ext}`);
  }
}

if (errors.length) {
  console.error('构建校验失败:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`构建校验通过：${files.length} 个文件，${appJson.pages.length} 个页面结构完整`);
