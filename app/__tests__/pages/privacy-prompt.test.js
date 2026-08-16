// app/__tests__/pages/privacy-prompt.test.js
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => { wx = installWxMock(); });

function setup() {
  const { type, config } = loadPage('pages/privacy-prompt/index.js');
  expect(type).toBe('page');
  return createPageContext(config);
}

describe('privacy-prompt 页面', () => {
  test('onReview 通过 reLaunch 跳回首页（不调用任何 API）', () => {
    const ctx = setup();
    ctx.onReview();
    expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' });
    expect(wx.login).not.toHaveBeenCalled();
    expect(wx.request).not.toHaveBeenCalled();
  });
});
