// pages/privacy-prompt/index.js
// 隐私政策拒绝后的静态提示页 —— 不调用任何 API（无 wx.login / wx.request）

Page({
  onReview() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
