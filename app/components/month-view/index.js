// components/month-view/index.js

Component({
  properties: {
    cells: {
      type: Array,
      value: []
    }
  },

  methods: {
    onCellTap(e) {
      const { date, current } = e.currentTarget.dataset;
      this.triggerEvent('celltap', { date, current });
    }
  }
});
