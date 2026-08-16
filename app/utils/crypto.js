// app/utils/crypto.js
// 敏感数据对称加密 —— 降低 Storage 中 JWT 明文泄露风险（设备丢失 / 恶意小程序读取）
// 采用 XOR 混淆 + hex 编码（非强加密，满足 dev-miniapp-standards「简单加密」底线）
// 密钥由设备信息 + 固定盐派生，跨启动稳定（同设备解密一致）

const SALT = 'agenda::storage::v1';

/**
 * 派生对称密钥：设备信息 + 固定盐 → 固定长度可打印字符串
 * 设备信息（brand/model/system）同设备稳定，保证重启后仍可解密
 */
function _deriveKey() {
  const info = wx.getSystemInfoSync();
  const seed = [info.brand || '', info.model || '', info.system || '', SALT].join('|');
  let key = '';
  for (let i = 0; i < 32; i++) {
    const code = seed.charCodeAt(i % seed.length) + (i + 1) * 13;
    key += String.fromCharCode(33 + (code % 93));
  }
  return key;
}

/**
 * 加密：XOR 逐字符混淆后转 hex（每个 UTF-16 码元固定 4 位 hex，兼容中文/符号）
 * @param {string} plain 明文
 * @returns {string} hex 密文
 */
function encrypt(plain) {
  const key = _deriveKey();
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const code = plain.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    out += code.toString(16).padStart(4, '0');
  }
  return out;
}

/**
 * 解密：hex 还原后 XOR 逐字符还原
 * @param {string} cipher hex 密文
 * @returns {string} 明文
 */
function decrypt(cipher) {
  const key = _deriveKey();
  let out = '';
  for (let i = 0; i < cipher.length; i += 4) {
    const code = parseInt(cipher.substr(i, 4), 16);
    out += String.fromCharCode(code ^ key.charCodeAt((i / 4) % key.length));
  }
  return out;
}

module.exports = { encrypt, decrypt };
