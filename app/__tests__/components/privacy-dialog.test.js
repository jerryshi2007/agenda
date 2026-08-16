// app/__tests__/components/privacy-dialog.test.js
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => { wx = installWxMock(); });

function setup() {
  const { type, config } = loadPage('components/privacy-dialog/index.js');
  expect(type).toBe('component');
  const ctx = createPageContext(config);
  ctx.triggerEvent = jest.fn();
  return ctx;
}

describe('privacy-dialog 组件', () => {
  test('onCheckChange 勾选后 checked 置 true', () => {
    const ctx = setup();
    ctx.onCheckChange({ detail: { value: ['agree'] } });
    expect(ctx.data.checked).toBe(true);
  });

  test('onCheckChange 取消勾选后 checked 置 false', () => {
    const ctx = setup();
    ctx.data.checked = true;
    ctx.onCheckChange({ detail: { value: [] } });
    expect(ctx.data.checked).toBe(false);
  });

  test('未勾选时 onAgree 不触发 agree 事件', () => {
    const ctx = setup();
    ctx.data.checked = false;
    ctx.onAgree();
    expect(ctx.triggerEvent).not.toHaveBeenCalled();
  });

  test('勾选后 onAgree 触发 agree 事件并置 loading', () => {
    const ctx = setup();
    ctx.data.checked = true;
    ctx.onAgree();
    expect(ctx.triggerEvent).toHaveBeenCalledWith('agree');
    expect(ctx.data.loading).toBe(true);
  });

  test('loading 期间 onAgree 不重复触发', () => {
    const ctx = setup();
    ctx.data.checked = true;
    ctx.data.loading = true;
    ctx.onAgree();
    expect(ctx.triggerEvent).not.toHaveBeenCalled();
  });

  test('onDecline 触发 decline 事件', () => {
    const ctx = setup();
    ctx.onDecline();
    expect(ctx.triggerEvent).toHaveBeenCalledWith('decline');
  });

  test('网络不可用时 onOpenPolicy 仅 Toast 提示不阻断', () => {
    const ctx = setup();
    wx.getNetworkType.mockImplementation(({ success }) => success({ networkType: 'none' }));
    ctx.onOpenPolicy();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '网络不可用，请稍后查看', icon: 'none' });
    expect(wx.showModal).not.toHaveBeenCalled();
  });

  test('reset 复位 checked 与 loading', () => {
    const ctx = setup();
    ctx.data.checked = true;
    ctx.data.loading = true;
    ctx.reset();
    expect(ctx.data.checked).toBe(false);
    expect(ctx.data.loading).toBe(false);
  });
});
