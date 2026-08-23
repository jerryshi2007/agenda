// app/__tests__/components/member-selector.test.js
// member-selector 组件测试 —— 家长多选 / 孩子仅自己锁定 / change 事件

const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');
const { UserRole } = require('../../contracts/schedule');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

function setup(props = {}) {
  const app = { globalData: {} };
  const { type, config } = loadPage('components/member-selector/index.js', { app });
  expect(type).toBe('component');
  const ctx = createPageContext(config);
  ctx.triggerEvent = jest.fn();
  ctx.properties = Object.assign({
    members: [],
    role: '',
    userId: '',
    selectedIds: []
  }, props);
  if (config.lifetimes && config.lifetimes.attached) {
    config.lifetimes.attached.call(ctx);
  }
  return ctx;
}

const members = [
  { userId: 'u1', role: 'Parent', name: '爸爸' },
  { userId: 'u2', role: 'Child', childName: '小明' },
  { userId: 'u3', role: 'Child', childName: '小红' }
];

describe('member-selector 组件', () => {
  describe('家长视角（多选）', () => {
    test('展示全体成员（含家长+孩子）', () => {
      const ctx = setup({ members, role: UserRole.Parent, userId: 'u1' });
      expect(ctx.data.isChildView).toBe(false);
      expect(ctx.data.displayMembers.length).toBe(3);
      expect(ctx.data.displayMembers[0].name).toBe('爸爸');
      expect(ctx.data.displayMembers[0].roleLabel).toBe('家长');
    });

    test('selectedIds 反映到 _selected', () => {
      const ctx = setup({ members, role: UserRole.Parent, userId: 'u1', selectedIds: ['u2'] });
      expect(ctx.data.displayMembers.find(m => m.userId === 'u2')._selected).toBe(true);
      expect(ctx.data.displayMembers.find(m => m.userId === 'u1')._selected).toBe(false);
    });

    test('onToggle 选中 → change 事件 memberIds 增加', () => {
      const ctx = setup({ members, role: UserRole.Parent, userId: 'u1', selectedIds: [] });
      ctx.onToggle({ currentTarget: { dataset: { index: 1 } } });
      expect(ctx.triggerEvent).toHaveBeenCalledWith('change', expect.objectContaining({
        memberIds: ['u2']
      }));
    });

    test('onToggle 取消已选 → change 事件 memberIds 移除', () => {
      const ctx = setup({ members, role: UserRole.Parent, userId: 'u1', selectedIds: ['u2'] });
      ctx.onToggle({ currentTarget: { dataset: { index: 1 } } });
      expect(ctx.triggerEvent).toHaveBeenCalledWith('change', expect.objectContaining({
        memberIds: []
      }));
    });

    test('change 事件 selectedMembers 含 userId/role/name', () => {
      const ctx = setup({ members, role: UserRole.Parent, userId: 'u1', selectedIds: ['u2'] });
      ctx.onToggle({ currentTarget: { dataset: { index: 2 } } });
      expect(ctx.triggerEvent).toHaveBeenCalledWith('change', expect.objectContaining({
        selectedMembers: [
          { userId: 'u2', role: 'Child', name: '小明' },
          { userId: 'u3', role: 'Child', name: '小红' }
        ]
      }));
    });
  });

  describe('孩子视角（仅自己、锁定）', () => {
    test('仅展示自己，不出现家长/其他孩子', () => {
      const ctx = setup({ members, role: UserRole.Child, userId: 'u2' });
      expect(ctx.data.isChildView).toBe(true);
      expect(ctx.data.displayMembers.length).toBe(1);
      expect(ctx.data.displayMembers[0].userId).toBe('u2');
    });

    test('自己强制选中且锁定', () => {
      const ctx = setup({ members, role: UserRole.Child, userId: 'u2', selectedIds: [] });
      expect(ctx.data.displayMembers[0]._selected).toBe(true);
      expect(ctx.data.displayMembers[0]._locked).toBe(true);
    });

    test('重建时自动 emit 自己为选中成员', () => {
      const ctx = setup({ members, role: UserRole.Child, userId: 'u2' });
      expect(ctx.triggerEvent).toHaveBeenCalledWith('change', expect.objectContaining({
        memberIds: ['u2'],
        selectedMembers: [{ userId: 'u2', role: 'Child', name: '小明' }]
      }));
    });

    test('父组件回传相同 memberIds（新引用）不重复 emit（防反馈循环）', () => {
      const ctx = setup({ members, role: UserRole.Child, userId: 'u2', selectedIds: [] });
      expect(ctx.triggerEvent).toHaveBeenCalledTimes(1);
      ctx.triggerEvent.mockClear();
      // 父组件 setData 回传相同值的新数组引用 → observer 触发 → 重建
      ctx.properties.selectedIds = ['u2'];
      ctx._rebuild();
      expect(ctx.triggerEvent).not.toHaveBeenCalled();
    });

    test('onToggle 被忽略（锁定不可改）', () => {
      const ctx = setup({ members, role: UserRole.Child, userId: 'u2', selectedIds: ['u2'] });
      ctx.triggerEvent.mockClear();
      ctx.onToggle({ currentTarget: { dataset: { index: 0 } } });
      expect(ctx.triggerEvent).not.toHaveBeenCalled();
    });
  });

  describe('空成员列表', () => {
    test('displayMembers 为空，家长视角不 emit', () => {
      const ctx = setup({ members: [], role: UserRole.Parent, userId: 'u1' });
      expect(ctx.data.displayMembers.length).toBe(0);
      expect(ctx.triggerEvent).not.toHaveBeenCalled();
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../components/member-selector/index.wxml'), 'utf8');
    }

    test('WXML 含成员项/空态 data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="member-selector-item-{{item.userId}}"');
      expect(wxml).toContain('data-id="member-selector-empty"');
    });
  });
});
