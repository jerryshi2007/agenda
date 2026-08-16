// app/components/privacy-dialog/index.js
// 隐私政策弹窗 —— 首次启动按需展示，勾选后方可同意

const PRIVACY_POLICY_FULL_TEXT =
  '欢迎使用家庭日程协作工具。' +
  '我们仅收集您的微信昵称和头像，用于家庭内成员之间的展示与识别，不会将您的信息分享给任何第三方。' +
  '您的日程数据仅存储为您家庭内部使用，用于家庭成员之间的日程规划与打卡协作。' +
  '您随时可以在"设置 - 注销账户"中删除账户及全部数据。' +
  '注销后数据保留 30 天，期间可随时恢复；30 天后将永久删除。';

Component({
  properties: {
    show: { type: Boolean, value: false }
  },

  data: {
    checked: false,
    loading: false
  },

  methods: {
    onCheckChange(e) {
      this.setData({ checked: e.detail.value.length > 0 });
    },

    onAgree() {
      if (!this.data.checked || this.data.loading) return;
      this.setData({ loading: true });
      this.triggerEvent('agree');
    },

    onDecline() {
      if (this.data.loading) return;
      this.triggerEvent('decline');
    },

    onOpenPolicy() {
      // 网络可用时展示完整隐私政策，不可用时 Toast 提示不阻断流程
      wx.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            wx.showToast({ title: '网络不可用，请稍后查看', icon: 'none' });
            return;
          }
          wx.showModal({
            title: '隐私政策',
            content: PRIVACY_POLICY_FULL_TEXT,
            showCancel: false,
            confirmText: '我知道了'
          });
        },
        fail: () => {
          wx.showToast({ title: '网络不可用，请稍后查看', icon: 'none' });
        }
      });
    },

    // 登录失败后由宿主调用，复位勾选与 loading，重新展示可交互状态
    reset() {
      this.setData({ checked: false, loading: false });
    }
  }
});
