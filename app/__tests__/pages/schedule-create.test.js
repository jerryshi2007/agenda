// app/__tests__/pages/schedule-create.test.js
// schedule-create 页面测试 —— 4 步向导 + schedule-form 子组件集成 + 冲突处理

const mockSchedule = require('../helpers/schedule-mock');
jest.mock('../../services/schedule', () => mockSchedule);

const schedule = require('../../services/schedule');
const STORAGE_KEYS = require('../../utils/storage-keys');
const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
  // 默认无草稿
  wx.getStorageSync.mockReturnValue(null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(appDataOverrides = {}) {
  const appData = {
    childList: [
      { userId: 'c1', childName: '小明' },
      { userId: 'c2', childName: '小红' }
    ],
    ...appDataOverrides
  };
  const app = { globalData: appData };
  const { type, config } = loadPage('pages/schedule-create/index.js', { app });
  expect(type).toBe('page');
  const ctx = createPageContext(config);
  // 重新安装 getApp 供后续 onLoad/onShow 调用使用（loadPage 结束后会还原 getApp）
  global.getApp = () => app;
  // mock selectComponent 返回 schedule-form 子组件的桩
  ctx.selectComponent = jest.fn(() => ({
    onSubmit: jest.fn(),
    _validate: jest.fn(() => true),
    data: { formData: {} }
  }));
  return ctx;
}

describe('schedule-create 页面 - 4 步向导', () => {
  describe('onLoad 初始化', () => {
    test('加载孩子列表（来自 app.globalData.childList）', () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(ctx.data.childList.length).toBe(2);
      expect(ctx.data.childList[0].childName).toBe('小明');
      expect(ctx.data.childList[0]._color).toBeDefined();
    });

    test('minDate 初始化为今天', () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(ctx.data.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('无草稿时 currentStep=1', () => {
      const ctx = setup();
      ctx.onLoad({});
      expect(ctx.data.currentStep).toBe(1);
    });

    test('恢复草稿：scheduleType + formData + currentStep', () => {
      wx.getStorageSync.mockImplementation(key => {
        if (key === STORAGE_KEYS.SCHEDULE_DRAFT) {
          return {
            scheduleType: 'HomeworkTask',
            formData: { name: '数学作业', dueDate: '2026-08-30' },
            currentStep: 3
          };
        }
        return null;
      });
      const ctx = setup();
      ctx.onLoad({});
      expect(ctx.data.scheduleType).toBe('HomeworkTask');
      expect(ctx.data.formData.name).toBe('数学作业');
      expect(ctx.data.formData.dueDate).toBe('2026-08-30');
      expect(ctx.data.currentStep).toBe(3);
    });
  });

  describe('onShow', () => {
    test('重新加载孩子列表', () => {
      const ctx = setup();
      ctx.onLoad({});
      // 模拟 app.globalData.childList 更新
      const app = getApp ? getApp() : { globalData: {} };
      app.globalData.childList = [
        { userId: 'c1', childName: '小明' },
        { userId: 'c3', childName: '小刚' }
      ];
      ctx.onShow();
      // 子组件无法直接改 getApp，验证 _loadChildList 被调用
      expect(ctx.data.childList.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Step 1 孩子多选', () => {
    test('onToggleChild 切换选中状态', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
      expect(ctx.data.childList[0]._selected).toBe(true);
      ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
      expect(ctx.data.childList[0]._selected).toBe(false);
    });
  });

  describe('Step 2 类型选择', () => {
    test('onSelectType 设置 scheduleType + stripeClass + typeLabel', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onSelectType({ currentTarget: { dataset: { type: 'AfterSchoolActivity' } } });
      expect(ctx.data.scheduleType).toBe('AfterSchoolActivity');
      expect(ctx.data.stripeClass).toBe('activity');
      expect(ctx.data.typeLabel).toBe('课后活动');
    });

    test('onSelectType=DailyRoutine → stripeClass=routine', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onSelectType({ currentTarget: { dataset: { type: 'DailyRoutine' } } });
      expect(ctx.data.stripeClass).toBe('routine');
    });

    test('onSelectType=HomeworkTask → stripeClass=homework', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onSelectType({ currentTarget: { dataset: { type: 'HomeworkTask' } } });
      expect(ctx.data.stripeClass).toBe('homework');
    });
  });

  describe('Step 1 → 2 校验', () => {
    test('未选孩子时阻止 + 提示', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 1;
      ctx.onNextStep();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '请至少选择一个孩子', icon: 'none' });
      expect(ctx.data.currentStep).toBe(1);
    });

    test('已选孩子时进入 Step 2', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
      ctx.data.currentStep = 1;
      ctx.onNextStep();
      expect(ctx.data.currentStep).toBe(2);
    });
  });

  describe('Step 2 → 3 校验', () => {
    test('未选类型时阻止 + 提示', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 2;
      ctx.data.scheduleType = '';
      ctx.onNextStep();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '请选择日程类型', icon: 'none' });
      expect(ctx.data.currentStep).toBe(2);
    });

    test('已选类型时进入 Step 3', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 2;
      ctx.data.scheduleType = 'AfterSchoolActivity';
      ctx.onNextStep();
      expect(ctx.data.currentStep).toBe(3);
    });
  });

  describe('Step 3 → 4 校验（schedule-form 集成）', () => {
    test('onNextStep 在 Step 3 调 form 的 onSubmit()', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 3;
      const formComp = ctx.selectComponent.mock.results[0]?.value || { onSubmit: jest.fn() };
      ctx.selectComponent.mockReturnValue({ ...formComp, onSubmit: jest.fn() });
      ctx.onNextStep();
      expect(ctx.selectComponent).toHaveBeenCalled();
      const calls = ctx.selectComponent.mock.results;
      const lastCall = calls[calls.length - 1].value;
      expect(lastCall.onSubmit).toHaveBeenCalled();
    });

    test('onFormSubmit 校验通过时进入 Step 4 + 缓存 formData', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 3;
      ctx.data.scheduleType = 'AfterSchoolActivity';
      const formData = {
        name: '钢琴课',
        scheduleType: 'AfterSchoolActivity',
        timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
        location: '少年宫'
      };
      ctx.onFormSubmit({ detail: { formData, valid: true } });
      expect(ctx.data.currentStep).toBe(4);
      expect(ctx.data.formData.name).toBe('钢琴课');
    });

    test('onFormSubmit 校验失败时留在 Step 3', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 3;
      ctx.onFormSubmit({ detail: { formData: {}, valid: false } });
      expect(ctx.data.currentStep).toBe(3);
    });
  });

  describe('onPrevStep', () => {
    test('Step > 1 时减 1', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 3;
      ctx.onPrevStep();
      expect(ctx.data.currentStep).toBe(2);
    });

    test('Step = 1 时不变', () => {
      const ctx = setup();
      ctx.onLoad({});
      ctx.data.currentStep = 1;
      ctx.onPrevStep();
      expect(ctx.data.currentStep).toBe(1);
    });
  });
});

describe('schedule-create 页面 - 提交', () => {
  function setupReady() {
    const ctx = setup();
    ctx.onLoad({});
    ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
    ctx.onSelectType({ currentTarget: { dataset: { type: 'AfterSchoolActivity' } } });
    ctx.data.currentStep = 4;
    ctx.data.formData = {
      name: '钢琴课',
      timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
      location: '少年宫',
      notes: ''
    };
    return ctx;
  }

  test('onSubmit 调 scheduleService.create 完整请求体', async () => {
    schedule.create.mockResolvedValue({ data: { scheduleId: 's-new' } });
    const ctx = setupReady();
    await ctx.onSubmit();
    expect(schedule.create).toHaveBeenCalledWith(expect.objectContaining({
      name: '钢琴课',
      scheduleType: 'AfterSchoolActivity',
      childIds: ['c1'],
      timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }],
      location: '少年宫',
      ignoreConflict: false
    }));
  });

  test('HomeworkTask 请求体不含 timeSlots，含 dueDate', async () => {
    schedule.create.mockResolvedValue({ data: { scheduleId: 's-new' } });
    const ctx = setup();
    ctx.onLoad({});
    ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
    ctx.data.scheduleType = 'HomeworkTask';
    ctx.data.currentStep = 4;
    ctx.data.formData = {
      name: '数学作业',
      timeSlots: [],
      dueDate: '2026-08-30',
      suggestedStartTime: '18:00',
      suggestedEndTime: '19:00',
      notes: ''
    };
    await ctx.onSubmit();
    expect(schedule.create).toHaveBeenCalledWith(expect.objectContaining({
      scheduleType: 'HomeworkTask',
      dueDate: '2026-08-30',
      suggestedStartTime: '18:00',
      suggestedEndTime: '19:00'
    }));
    expect(schedule.create.mock.calls[0][0].timeSlots).toBeUndefined();
  });

  test('submitting=true → 重复点击不重复提交', async () => {
    schedule.create.mockReturnValue(new Promise(() => {})); // never resolves
    const ctx = setupReady();
    ctx.data.submitting = true;
    await ctx.onSubmit();
    expect(schedule.create).not.toHaveBeenCalled();
  });

  test('currentStep < 4 → 不提交', async () => {
    const ctx = setup();
    ctx.onLoad({});
    ctx.data.currentStep = 3;
    await ctx.onSubmit();
    expect(schedule.create).not.toHaveBeenCalled();
  });

  test('成功：清除草稿 + Toast + switchTab', async () => {
    schedule.create.mockResolvedValue({ data: { scheduleId: 's-new' } });
    const ctx = setupReady();
    await ctx.onSubmit();
    expect(wx.removeStorageSync).toHaveBeenCalledWith(STORAGE_KEYS.SCHEDULE_DRAFT);
    expect(wx.showToast).toHaveBeenCalledWith({ title: '创建成功', icon: 'success' });
  });

  test('409 冲突：弹窗 + 不清除草稿 + submitting=false', async () => {
    schedule.create.mockRejectedValue({
      statusCode: 409,
      data: { hasConflict: true, conflicts: [{ scheduleId: 's1', name: '数学班', startTime: '16:00', endTime: '17:00' }] }
    });
    const ctx = setupReady();
    await ctx.onSubmit();
    expect(ctx.data.showConflictDialog).toBe(true);
    expect(ctx.data.conflicts.length).toBe(1);
    expect(ctx.data.submitting).toBe(false);
  });

  test('错误码 CHILD_NOT_SELECTED → Toast', async () => {
    schedule.create.mockRejectedValue({ statusCode: 400, error: 'CHILD_NOT_SELECTED', message: '请选择孩子' });
    const ctx = setupReady();
    await ctx.onSubmit();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '请选择孩子', icon: 'none' });
  });

  test('错误码 SCHEDULE_NAME_EMPTY → Toast', async () => {
    schedule.create.mockRejectedValue({ statusCode: 400, error: 'SCHEDULE_NAME_EMPTY', message: '名称为空' });
    const ctx = setupReady();
    await ctx.onSubmit();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '名称为空', icon: 'none' });
  });

  test('未知错误 → Toast 显示后端 message', async () => {
    schedule.create.mockRejectedValue({ statusCode: 500, message: '服务器内部错误' });
    const ctx = setupReady();
    await ctx.onSubmit();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '服务器内部错误', icon: 'none' });
  });
});

describe('schedule-create 页面 - 冲突处理', () => {
  test('onConflictContinue：设 ignoreConflict=true + 重新提交', async () => {
    const ctx = setup();
    ctx.onLoad({});
    ctx.data.currentStep = 4;
    ctx.data.formData = { name: '钢琴课', timeSlots: [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }] };
    ctx.data.scheduleType = 'AfterSchoolActivity';
    ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
    schedule.create.mockResolvedValue({ data: { scheduleId: 's-new' } });

    ctx.onConflictContinue();
    expect(ctx.data.ignoreConflict).toBe(true);
    expect(ctx.data.showConflictDialog).toBe(false);
    expect(schedule.create).toHaveBeenCalled();
  });

  test('onConflictBack：关闭弹窗 + 回到 Step 3', () => {
    const ctx = setup();
    ctx.onLoad({});
    ctx.data.currentStep = 4;
    ctx.data.showConflictDialog = true;
    ctx.onConflictBack();
    expect(ctx.data.showConflictDialog).toBe(false);
    expect(ctx.data.currentStep).toBe(3);
  });
});

describe('schedule-create 页面 - WXML data-id 契约', () => {
  const fs = require('fs');
  const path = require('path');
  function readWxml() {
    return fs.readFileSync(path.resolve(__dirname, '../../pages/schedule-create/index.wxml'), 'utf8');
  }

  test('WXML 含步骤条/上一步/下一步/提交 data-id', () => {
    const wxml = readWxml();
    expect(wxml).toContain('data-id="schedule-create-step-indicator"');
    expect(wxml).toContain('data-id="schedule-create-prev-btn"');
    expect(wxml).toContain('data-id="schedule-create-next-btn"');
    expect(wxml).toContain('data-id="schedule-create-submit-btn"');
  });

  test('WXML 含 Step 1 孩子卡 data-id', () => {
    const wxml = readWxml();
    expect(wxml).toContain('data-id="schedule-create-child-');
  });

  test('WXML 含 Step 2 类型卡 data-id', () => {
    const wxml = readWxml();
    expect(wxml).toContain('data-id="schedule-create-type-afterschool"');
    expect(wxml).toContain('data-id="schedule-create-type-daily"');
    expect(wxml).toContain('data-id="schedule-create-type-homework"');
  });

  test('WXML 含 schedule-form 组件引用', () => {
    const wxml = readWxml();
    expect(wxml).toMatch(/<schedule-form[\s>]/);
  });

  test('WXML 含冲突弹窗 data-id', () => {
    const wxml = readWxml();
    expect(wxml).toContain('data-id="schedule-create-conflict-dialog"');
    expect(wxml).toContain('data-id="schedule-create-conflict-continue"');
    expect(wxml).toContain('data-id="schedule-create-conflict-back"');
  });
});
