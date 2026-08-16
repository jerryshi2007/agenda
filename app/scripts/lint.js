// app/scripts/lint.js
// 小程序「lint」校验 —— 检查契约合规与安全底线
// 1) services/pages 禁止手写认证错误码字符串字面量（须引用 app/contracts/auth.js）
// 2) 全 app/ 禁止出现 openid
// 3) 除 services/api.js 外禁止裸调 wx.request
// 4) 除 utils/storage-keys.js 外禁止 wx.setStorageSync/getStorageSync 用字符串字面量键

'use strict';

const fs = require('fs');
const path = require('path');

const APP_ROOT = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = new Set(['node_modules', '__tests__', '.git', 'scripts']);
const AUTH_ERROR_CODES = [
  'CODE_INVALID', 'CODE_EXPIRED', 'NICKNAME_EMPTY', 'NICKNAME_TOO_LONG',
  'NICKNAME_SENSITIVE', 'FILE_FORMAT_INVALID', 'FAMILY_STILL_ACTIVE',
  'NOT_DELETED', 'EXPIRED', 'TOKEN_INVALID', 'FILE_TOO_LARGE',
  'RATE_LIMITED', 'WECHAT_API_ERROR', 'WECHAT_API_TIMEOUT', 'INTERNAL_ERROR'
];
// 仅收录打卡域专属错误码；SCHEDULE_NOT_FOUND / NOT_FAMILY_MEMBER 属跨域共享错误，
// 日程模块（无 contracts 契约文件）已按字符串硬编码使用，故不在此清单内。
const CHECKIN_ERROR_CODES = [
  'CHECKIN_WINDOW_CLOSED', 'TERMINAL_STATE', 'NOT_CHECKED_IN',
  'WINDOW_CLOSED', 'SCHEDULE_CANCELLED'
];

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
const rel = f => path.relative(APP_ROOT, f);

for (const f of files) {
  const r = rel(f).replace(/\\/g, '/');
  const isJs = f.endsWith('.js');
  const isWxml = f.endsWith('.wxml');
  if (!isJs && !isWxml) continue;

  const content = fs.readFileSync(f, 'utf8');

  // 2) openid 禁止出现在前端
  if (/openid/i.test(content)) {
    errors.push(`${r}: 检测到 openid（禁止暴露到前端）`);
  }

  if (!isJs) continue;

  // 1) 手写错误码字符串字面量（跳过契约镜像本身）
  if (r.startsWith('services/') || r.startsWith('pages/')) {
    for (const code of AUTH_ERROR_CODES) {
      const re = new RegExp(`['"\`]${code}['"\`]`);
      if (re.test(content)) {
        errors.push(`${r}: 手写错误码字符串 "${code}"，应引用 app/contracts/auth.js`);
      }
    }
    for (const code of CHECKIN_ERROR_CODES) {
      const re = new RegExp(`['"\`]${code}['"\`]`);
      if (re.test(content)) {
        errors.push(`${r}: 手写错误码字符串 "${code}"，应引用 app/contracts/checkin.js`);
      }
    }
  }

  // 3) 裸调 wx.request（跳过 api.js）
  if (r !== 'services/api.js' && /wx\.request\s*\(/.test(content)) {
    errors.push(`${r}: 裸调 wx.request，应通过 services/api.js 统一封装`);
  }

  // 4) Storage 字符串字面量键（跳过 storage-keys.js）
  if (r !== 'utils/storage-keys.js' && /wx\.(setStorageSync|getStorageSync|removeStorageSync)\s*\(\s*['"]/.test(content)) {
    errors.push(`${r}: Storage 用字符串字面量键，应引用 utils/storage-keys.js 常量`);
  }
}

if (errors.length) {
  console.error('Lint 失败:\n' + errors.join('\n'));
  process.exit(1);
}

console.log(`Lint 通过：${files.filter(f => f.endsWith('.js') || f.endsWith('.wxml')).length} 个文件无违规`);
