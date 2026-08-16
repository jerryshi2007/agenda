// app/__tests__/components/profile-collection.test.js
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => { wx = installWxMock(); });

function setup() {
  const { type, config } = loadPage('components/profile-collection/index.js');
  expect(type).toBe('component');
  const ctx = createPageContext(config);
  ctx.triggerEvent = jest.fn();
  return ctx;
}

describe('profile-collection 组件', () => {
  test('onChooseAvatar 记录头像本地路径', () => {
    const ctx = setup();
    ctx.onChooseAvatar({ detail: { avatarUrl: '/tmp/avatar.png' } });
    expect(ctx.data.avatarUrl).toBe('/tmp/avatar.png');
  });

  test('onNicknameInput 更新昵称', () => {
    const ctx = setup();
    ctx.onNicknameInput({ detail: { value: '小明' } });
    expect(ctx.data.nickname).toBe('小明');
  });

  test('填了昵称点开始使用触发 submit', () => {
    const ctx = setup();
    ctx.data.nickname = ' 小明 ';
    ctx.data.avatarUrl = '/tmp/a.png';
    ctx.onStart();
    expect(ctx.triggerEvent).toHaveBeenCalledWith('submit', {
      nickname: '小明',
      avatarUrl: '/tmp/a.png'
    });
  });

  test('未填昵称点开始使用触发 skip（使用默认值）', () => {
    const ctx = setup();
    ctx.data.nickname = '  ';
    ctx.onStart();
    expect(ctx.triggerEvent).toHaveBeenCalledWith('skip');
  });

  test('loading 期间点开始使用不触发任何事件', () => {
    const ctx = setup();
    ctx.data.loading = true;
    ctx.data.nickname = '小明';
    ctx.onStart();
    expect(ctx.triggerEvent).not.toHaveBeenCalled();
  });
});
