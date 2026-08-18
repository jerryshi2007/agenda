// pages/family-invite-list/index.js
// 邀请记录列表页 —— 按状态分组（待使用/已使用/已撤销/已过期）、撤销待使用邀请

const familyService = require('../../services/family');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { InvitationCodeStatus, ErrorMessages } = require('../../contracts/family');

function _isExpired(item, now) {
  if (!item || !item.expiresAt) return false;
  const t = new Date(item.expiresAt).getTime();
  return t > 0 && t < now.getTime();
}

function _group(invites, now) {
  const groups = { pending: [], used: [], redeemed: [], expired: [] };
  for (const item of (invites || [])) {
    // 已使用 / 已撤销：直接归组
    if (item.status === InvitationCodeStatus.Used) {
      groups.used.push(item);
    } else if (item.status === InvitationCodeStatus.Redeemed) {
      groups.redeemed.push(item);
    } else if (item.status === InvitationCodeStatus.Expired || _isExpired(item, now)) {
      // Pending 但已过期 -> expired 分组
      groups.expired.push(item);
    } else {
      groups.pending.push(item);
    }
  }
  return groups;
}

Page({
  data: {
    loading: true,
    error: false,
    errorMessage: '',
    groups: { pending: [], used: [], redeemed: [], expired: [] }
  },

  onLoad() {
    this._load();
  },

  onShow() {
    if (!this.data.loading) this._load();
  },

  onPullDownRefresh() {
    this._load().then(() => wx.stopPullDownRefresh());
  },

  _load() {
    this.setData({ loading: true, error: false, errorMessage: '' });
    const familyId = this._readFamilyId();
    return familyService.getInvites(familyId).then((res) => {
      const invites = (res && res.invites) || [];
      const groups = _group(invites, new Date());
      this.setData({ loading: false, groups });
    }).catch(() => {
      this.setData({ loading: false, error: true, errorMessage: '网络异常' });
    });
  },

  _readFamilyId() {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      return wx.getStorageSync(STORAGE_KEYS.CURRENT_FAMILY_ID) || '';
    }
    return '';
  },

  onRevoke(e) {
    const codeId = e.currentTarget.dataset.codeId;
    if (!codeId) return Promise.resolve();
    const familyId = this._readFamilyId();
    return familyService.revokeInvite(familyId, codeId).then(() => {
      return this._load();
    }).catch((err) => {
      this.setData({
        error: true,
        errorMessage: (err && err.message) || ErrorMessages.INVITATION_CANNOT_REVOKE
      });
    });
  },

  onRetry() {
    return this._load();
  }
});
