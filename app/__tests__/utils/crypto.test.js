// app/__tests__/utils/crypto.test.js
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock({
    getSystemInfoSync: () => ({ brand: 'iPhone', model: 'iPhone 14', system: 'iOS 16.0' })
  });
  jest.resetModules();
});

function loadCrypto() {
  return require('../../utils/crypto');
}

describe('crypto 对称加密', () => {
  test('encrypt 后 decrypt 可还原 JWT', () => {
    const crypto = loadCrypto();
    const plain = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.signature';
    expect(crypto.decrypt(crypto.encrypt(plain))).toBe(plain);
  });

  test('encrypt 结果不等于明文（混淆生效）', () => {
    const crypto = loadCrypto();
    const plain = 'plain-text-jwt-token';
    expect(crypto.encrypt(plain)).not.toBe(plain);
  });

  test('空串往返稳定', () => {
    const crypto = loadCrypto();
    expect(crypto.decrypt(crypto.encrypt(''))).toBe('');
  });

  test('含中文昵称/特殊字符的明文可还原', () => {
    const crypto = loadCrypto();
    const plain = 'token-微信用户-!@#$%^&*()';
    expect(crypto.decrypt(crypto.encrypt(plain))).toBe(plain);
  });
});
