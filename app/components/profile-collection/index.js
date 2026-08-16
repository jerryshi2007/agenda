// app/components/profile-collection/index.js
// 资料收集组件 —— 首次登录后收集昵称/头像，可一键跳过使用默认值
// 上传与更新资料由宿主（index 页）负责，本组件只收集并回传 { nickname, avatarUrl }

Component({
  properties: {
    show: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
    prefillNickname: { type: String, value: '' }
  },

  data: {
    nickname: '',
    avatarUrl: ''
  },

  observers: {
    prefillNickname(nickname) {
      if (nickname && !this.data.nickname) {
        this.setData({ nickname });
      }
    }
  },

  methods: {
    onChooseAvatar(e) {
      this.setData({ avatarUrl: e.detail.avatarUrl });
    },

    onNicknameInput(e) {
      this.setData({ nickname: e.detail.value });
    },

    // 「开始使用」：填了昵称走提交，未填走跳过（使用默认值）
    onStart() {
      if (this.data.loading) return;
      if (this.data.nickname && this.data.nickname.trim()) {
        this.onSubmit();
      } else {
        this.onSkip();
      }
    },

    onSubmit() {
      this.triggerEvent('submit', {
        nickname: this.data.nickname.trim(),
        avatarUrl: this.data.avatarUrl
      });
    },

    onSkip() {
      this.triggerEvent('skip');
    }
  }
});
