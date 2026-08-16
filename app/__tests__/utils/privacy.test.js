// app/__tests__/utils/privacy.test.js
const privacy = require('../../utils/privacy');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => { wx = installWxMock(); });

describe('privacy.checkConsent', () => {
  test('无同意记录时返回 consented=false, needsReshow=true', () => {
    wx.getStorageSync.mockReturnValue(null);
    expect(privacy.checkConsent()).toEqual({ consented: false, needsReshow: true });
  });

  test('版本匹配时返回 consented=true, needsReshow=false', () => {
    wx.getStorageSync.mockReturnValue({ version: '1.0', time: 1691460000000 });
    expect(privacy.checkConsent()).toEqual({ consented: true, needsReshow: false });
  });

  test('版本不匹配时返回 consented=false, needsReshow=true', () => {
    wx.getStorageSync.mockReturnValue({ version: '0.9', time: 1691460000000 });
    expect(privacy.checkConsent()).toEqual({ consented: false, needsReshow: true });
  });
});

describe('privacy.recordConsent', () => {
  test('写入当前版本号与时间戳到 PRIVACY_CONSENT 键', () => {
    privacy.recordConsent();
    expect(wx.setStorageSync).toHaveBeenCalledWith('privacy_consent', {
      version: '1.0',
      time: expect.any(Number)
    });
  });
});

describe('privacy.PRIVACY_POLICY_VERSION', () => {
  test('导出版本号常量', () => {
    expect(privacy.PRIVACY_POLICY_VERSION).toBe('1.0');
  });
});
