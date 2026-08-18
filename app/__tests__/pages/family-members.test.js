// app/__tests__/pages/family-members.test.js
// family-members 页面测试：按家长/孩子分组、显示展示模式、已注销灰色、
// 家长点击成员弹出操作菜单（移除/转让/设置）、底部退出/解散按钮

const mockFamily = require('../helpers/family-mock');
jest.mock('../../services/family', () => mockFamily);

const family = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { ErrorCodes, ErrorMessages, UserRole, DisplayMode, DisplayModeLabels } = require('../../contracts/family');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  wx.getStorageSync.mockImplementation((k) => k === STORAGE_KEYS.CURRENT_FAMILY_ID ? 'f-current' : null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(opts = {}) {
  const { type, config } = loadPage('pages/family-members/index.js', opts);
  expect(type).toBe('page');
  return createPageContext(config);
}

function getApp_() {
  return { globalData: { currentFamilyId: 'f-current', userId: 'u-self' } };
}

describe('family-members 页面', () => {
  test('onLoad 拉取成员列表并按家长/孩子分组', async () => {
    family.getMembers.mockResolvedValue({
      familyName: '我的家',
      creatorId: 'm-self',
      parents: [
        { memberId: 'm-self', userId: 'u-self', role: 'Parent', nickname: '我', isCreator: true, isDeleted: false, displayMode: 'Primary' }
      ],
      children: [
        { memberId: 'c1', userId: 'u-child', role: 'Child', childName: '小明', nickname: '小明', isCreator: false, isDeleted: false, displayMode: 'Primary' }
      ],
      activeMemberCount: 2,
      maxMemberCount: 10
    });
    const ctx = setup({ app: getApp_() });
    ctx.onLoad();
    await flush();
    expect(family.getMembers).toHaveBeenCalled();
    expect(ctx.data.parents.length).toBe(1);
    expect(ctx.data.children.length).toBe(1);
    expect(ctx.data.familyName).toBe('我的家');
    expect(ctx.data.activeMemberCount).toBe(2);
  });

  test('已注销成员标记 isDeactivated=true', async () => {
    family.getMembers.mockResolvedValue({
      familyName: '我的家',
      creatorId: 'm-self',
      parents: [],
      children: [
        { memberId: 'c1', userId: 'u-child', role: 'Child', childName: '小明', nickname: '小明', isCreator: false, isDeleted: true, displayMode: 'Primary' }
      ],
      activeMemberCount: 0,
      maxMemberCount: 10
    });
    const ctx = setup({ app: getApp_() });
    ctx.onLoad();
    await flush();
    expect(ctx.data.children[0].isDeactivated).toBe(true);
  });

  test('拉取失败时显示错误态', async () => {
    family.getMembers.mockRejectedValue({ error: 'NETWORK_ERROR' });
    const ctx = setup({ app: getApp_() });
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
  });

  test('onMemberAction 展示操作菜单（家长点击其他家长）', async () => {
    wx.showActionSheet.mockImplementation(({ success }) => {
      success({ tapIndex: 0 });
    });
    family.removeMember.mockResolvedValue({ removed: true });
    family.getMembers.mockResolvedValue({
      familyName: '我的家',
      creatorId: 'm-self',
      parents: [
        { memberId: 'm-self', userId: 'u-self', role: 'Parent', nickname: '我', isCreator: true, isDeleted: false, displayMode: 'Primary' },
        { memberId: 'm2', userId: 'u2', role: 'Parent', nickname: '妈', isCreator: false, isDeleted: false, displayMode: 'Primary' }
      ],
      children: [],
      activeMemberCount: 2,
      maxMemberCount: 10
    });
    const ctx = setup({ app: getApp_() });
    ctx.onLoad();
    await flush();
    ctx.onMemberAction({ currentTarget: { dataset: { memberId: 'm2', role: 'Parent' } } });
    await flush();
    expect(wx.showActionSheet).toHaveBeenCalled();
  });

  test('onMemberAction 点击孩子时菜单为「设置展示模式 / 移除成员」', () => {
    wx.showActionSheet.mockImplementation(({ success }) => success({ tapIndex: 1 }));
    const ctx = setup({ app: getApp_() });
    ctx.onMemberAction({ currentTarget: { dataset: { memberId: 'c1', role: 'Child' } } });
    expect(wx.showActionSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        itemList: expect.arrayContaining(['设置展示模式', '移除成员'])
      })
    );
  });

  test('onMemberAction 点击家长时菜单为「移除成员 / 转让创建者」', () => {
    wx.showActionSheet.mockImplementation(({ success }) => success({ tapIndex: 1 }));
    const ctx = setup({ app: getApp_() });
    ctx.onMemberAction({ currentTarget: { dataset: { memberId: 'm2', role: 'Parent' } } });
    expect(wx.showActionSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        itemList: expect.arrayContaining(['移除成员', '转让创建者'])
      })
    );
  });

  test('onInvite 跳转到 family-invite', () => {
    const ctx = setup();
    ctx.onInvite();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-invite/index' });
  });

  test('onInviteList 跳转到 family-invite-list', () => {
    const ctx = setup();
    ctx.onInviteList();
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/family-invite-list/index' });
  });

  test('onLeaveFamily 退出家庭（Task 16 集成入口）', async () => {
    wx.showModal.mockImplementation(({ success }) => success({ confirm: true }));
    family.exitFamily.mockResolvedValue({ exited: true, hasOtherFamilies: false });
    const ctx = setup();
    await ctx.onLeaveFamily();
    expect(family.exitFamily).toHaveBeenCalled();
  });

  test('onDisbandFamily 解散家庭（Task 16 集成入口）', async () => {
    wx.showModal.mockImplementation(({ success }) => success({ confirm: true, content: '我的家' }));
    family.dissolveFamily.mockResolvedValue({ dissolved: true });
    const ctx = setup();
    ctx.setData({ familyName: '我的家' });
    await ctx.onDisbandFamily('我的家');
    expect(family.dissolveFamily).toHaveBeenCalledWith('f-current', '我的家');
  });

  test('onRetry 重新拉取', async () => {
    family.getMembers.mockRejectedValueOnce({ error: 'NETWORK_ERROR' });
    const ctx = setup({ app: getApp_() });
    ctx.onLoad();
    await flush();
    expect(ctx.data.error).toBe(true);
    family.getMembers.mockResolvedValue({ familyName: '家', creatorId: 'm', parents: [], children: [], activeMemberCount: 0, maxMemberCount: 10 });
    ctx.onRetry();
    await flush();
    expect(ctx.data.error).toBe(false);
  });
});
