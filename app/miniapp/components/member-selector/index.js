// components/member-selector/index.js
// 关联成员选择器 —— 家长视角全体成员多选；孩子视角仅自己、锁定不可改
// 成员数据由父组件传入（members 含 userId/role/name），选中态为受控组件（selectedIds）

const { UserRole } = require('../../contracts/schedule');

/**
 * 归一化成员项为选择器所需的稳定形状
 * 兼容 family.getMembers()（{ userId, role, childName, nickname }）与旧 childList（{ userId, childName }）
 */
function normalizeMember(m) {
  const role = m.role || '';
  const name = m.name || m.childName || m.nickname || '';
  let roleLabel = '';
  if (role === UserRole.Parent) roleLabel = '家长';
  else if (role === UserRole.Child) roleLabel = '孩子';
  return {
    userId: m.userId || m.memberId || '',
    role: role,
    name: name,
    avatarUrl: m.avatarUrl || '',
    roleLabel: roleLabel,
    avatarLetter: name.charAt(0) || '?'
  };
}

Component({
  properties: {
    members: { type: Array, value: [] },
    role: { type: String, value: '' },
    userId: { type: String, value: '' },
    selectedIds: { type: Array, value: [] }
  },

  data: {
    displayMembers: [],
    isChildView: false
  },

  lifetimes: {
    attached() {
      this._rebuild();
    }
  },

  observers: {
    'members, role, userId, selectedIds': function () {
      this._rebuild();
    }
  },

  methods: {
    _isChildView() {
      return this.properties.role === UserRole.Child;
    },

    _rebuild() {
      const isChildView = this._isChildView();
      const members = (this.properties.members || []).map(normalizeMember);
      const selected = new Set(this.properties.selectedIds || []);

      let list = members;
      if (isChildView) {
        list = members.filter(m => m.userId === this.properties.userId);
      }

      const displayMembers = list.map((m, i) => {
        const locked = isChildView;
        const isSelected = isChildView ? true : selected.has(m.userId);
        return Object.assign({}, m, {
          _color: ['#10AEFF', '#FF9500', '#07C160', '#FA5151'][i % 4],
          _selected: isSelected,
          _locked: locked
        });
      });

      this.setData({ displayMembers, isChildView });

      // 孩子视角：仅自己、强制选中，重建时同步一次选中态给父组件（父组件据此提交 memberIds）。
      // 去重守卫：仅当计算出的 memberIds 与当前 selectedIds 不同才 emit，
      // 避免「父组件 setData 回传新数组引用 → observer 再触发 → 再 emit」的无界反馈循环。
      if (isChildView) {
        const ids = displayMembers.map(m => m.userId);
        const prev = this.properties.selectedIds || [];
        const changed = ids.length !== prev.length || ids.some((id, i) => id !== prev[i]);
        if (changed) {
          this._emit(ids);
        }
      }
    },

    onToggle(e) {
      if (this.data.isChildView) return;
      const { index } = e.currentTarget.dataset;
      const member = this.data.displayMembers[index];
      if (!member) return;

      const selected = new Set(this.properties.selectedIds || []);
      if (selected.has(member.userId)) {
        selected.delete(member.userId);
      } else {
        selected.add(member.userId);
      }
      this._emit(Array.from(selected));
    },

    _emit(selectedIds) {
      const selectedMembers = this.data.displayMembers
        .filter(m => selectedIds.indexOf(m.userId) >= 0)
        .map(m => ({ userId: m.userId, role: m.role, name: m.name }));
      this.triggerEvent('change', {
        memberIds: selectedIds,
        selectedMembers: selectedMembers
      });
    }
  }
});
