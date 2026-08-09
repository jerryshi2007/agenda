// components/edit-scope-switch/index.js

Component({
  properties: {
    scope: {
      type: String,
      value: 'ThisOnly'
    }
  },

  methods: {
    onSwitch(e) {
      const scope = e.currentTarget.dataset.scope;
      if (scope !== this.data.scope) {
        this.triggerEvent('scopechange', { scope });
      }
    }
  }
});
