// app/__tests__/components/schedule-form.test.js
// schedule-form 组件测试 —— 4 mode 渲染 + 校验 + 提交事件

const { loadPage, createPageContext } = require('../helpers/page');
const { installWxMock } = require('../helpers/wx-mock');
const { ScheduleType } = require('../../contracts/template');

let wx;
beforeEach(() => {
  wx = installWxMock();
  jest.resetAllMocks();
});

function setup(props = {}, appOverrides = {}) {
  const app = {
    globalData: {
      childList: [
        { userId: 'c1', childName: '小明' },
        { userId: 'c2', childName: '小红' }
      ],
      ...appOverrides.globalData
    }
  };
  const { type, config } = loadPage('components/schedule-form/index.js', { app });
  expect(type).toBe('component');
  const ctx = createPageContext(config);
  ctx.triggerEvent = jest.fn();
  // 模拟 properties 注入（component 通过 this.properties 读取）
  ctx.properties = Object.assign({
    mode: 'create',
    initialValues: null,
    childSelectorVisible: true,
    startDateVisible: true,
    scheduleTypeLocked: false
  }, props);
  // 触发 attached 生命周期
  if (config.lifetimes && config.lifetimes.attached) {
    config.lifetimes.attached.call(ctx);
  }
  // 测试环境：getApp 在 loadPage 结束后被还原，无法在方法内直接调用；
  // 显式注入 _appRef 模拟 attached 内的缓存
  ctx._appRef = app;
  return ctx;
}

function fieldEvent(field, value) {
  return { currentTarget: { dataset: { field } }, detail: { value } };
}

function typeEvent(type) {
  return { currentTarget: { dataset: { type } } };
}

describe('schedule-form 组件', () => {
  describe('初始化', () => {
    test('properties 默认值正确：mode=create，childSelectorVisible=true，startDateVisible=true', () => {
      const ctx = setup({});
      expect(ctx.properties.mode).toBe('create');
      expect(ctx.properties.childSelectorVisible).toBe(true);
      expect(ctx.properties.startDateVisible).toBe(true);
      expect(ctx.properties.scheduleTypeLocked).toBe(false);
    });

    test('mode=template-create + childSelectorVisible=false + startDateVisible=false', () => {
      const ctx = setup({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      expect(ctx.properties.mode).toBe('template-create');
      expect(ctx.properties.childSelectorVisible).toBe(false);
      expect(ctx.properties.startDateVisible).toBe(false);
    });

    test('mode=template-edit + scheduleTypeLocked=true', () => {
      const ctx = setup({ mode: 'template-edit', scheduleTypeLocked: true, childSelectorVisible: false, startDateVisible: false });
      expect(ctx.properties.scheduleTypeLocked).toBe(true);
    });

    test('initialValues 含 scheduleType 时初始化为该类型', () => {
      const ctx = setup({
        initialValues: { scheduleType: ScheduleType.HomeworkTask, name: '数学作业' },
        childSelectorVisible: false,
        startDateVisible: false
      });
      expect(ctx.data.scheduleType).toBe(ScheduleType.HomeworkTask);
      expect(ctx.data.formData.name).toBe('数学作业');
    });
  });

  describe('类型选择', () => {
    test('onSelectType 切换 scheduleType', () => {
      const ctx = setup({});
      ctx.onSelectType(typeEvent(ScheduleType.AfterSchoolActivity));
      expect(ctx.data.scheduleType).toBe(ScheduleType.AfterSchoolActivity);
      expect(ctx.data.stripeClass).toBe('activity');
    });

    test('scheduleTypeLocked=true 时 onSelectType 忽略', () => {
      const ctx = setup({ mode: 'template-edit', scheduleTypeLocked: true, childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.HomeworkTask;
      ctx.onSelectType(typeEvent(ScheduleType.AfterSchoolActivity));
      expect(ctx.data.scheduleType).toBe(ScheduleType.HomeworkTask);
    });
  });

  describe('字段输入', () => {
    test('onFieldInput 更新 formData.name', () => {
      const ctx = setup({});
      ctx.onFieldInput(fieldEvent('name', '钢琴课'));
      expect(ctx.data.formData.name).toBe('钢琴课');
    });

    test('onFieldInput 清除该字段错误', () => {
      const ctx = setup({});
      ctx.data.errors.name = '请输入名称';
      ctx.onFieldInput(fieldEvent('name', '钢琴'));
      expect(ctx.data.errors.name).toBe('');
    });

    test('onDateChange 更新 formData.repeatEndDate', () => {
      const ctx = setup({});
      ctx.onDateChange(fieldEvent('repeatEndDate', '2026-12-31'));
      expect(ctx.data.formData.repeatEndDate).toBe('2026-12-31');
    });

    test('onTimeChange 更新 formData.suggestedStartTime', () => {
      const ctx = setup({});
      ctx.onTimeChange(fieldEvent('suggestedStartTime', '18:00'));
      expect(ctx.data.formData.suggestedStartTime).toBe('18:00');
    });

    test('onTimeSlotChange 更新 formData.timeSlots', () => {
      const ctx = setup({});
      const timeSlots = [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }];
      ctx.onTimeSlotChange({ detail: { timeSlots } });
      expect(ctx.data.formData.timeSlots).toEqual(timeSlots);
    });
  });

  describe('孩子多选', () => {
    test('_loadChildList 加载 childList（带 _selected）', () => {
      const ctx = setup({ childSelectorVisible: true });
      ctx._loadChildList();
      expect(ctx.data.childList.length).toBe(2);
      expect(ctx.data.childList[0].userId).toBe('c1');
    });

    test('onToggleChild 切换 _selected 状态并同步 childIds', () => {
      const ctx = setup({ childSelectorVisible: true });
      ctx._loadChildList();
      ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
      expect(ctx.data.childList[0]._selected).toBe(true);
      expect(ctx.data.formData.childIds).toEqual(['c1']);
      ctx.onToggleChild({ currentTarget: { dataset: { index: 0 } } });
      expect(ctx.data.childList[0]._selected).toBe(false);
      expect(ctx.data.formData.childIds).toEqual([]);
    });
  });

  describe('校验', () => {
    function setupForValidate(props) {
      const ctx = setup(props);
      ctx.data.minDate = '2026-08-19';
      return ctx;
    }

    test('name 为空 → valid=false，errors.name 非空', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }];
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.name).toBeTruthy();
    });

    test('name 超过 50 字符 → valid=false', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = 'a'.repeat(51);
      ctx.data.formData.timeSlots = [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }];
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.name).toMatch(/50/);
    });

    test('scheduleType 为空 → valid=false', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = '';
      ctx.data.formData.name = '钢琴课';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }];
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.scheduleType).toBeTruthy();
    });

    test('AfterSchoolActivity 无 timeSlots → valid=false', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '钢琴课';
      ctx.data.formData.timeSlots = [];
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.timeSlots).toBeTruthy();
    });

    test('HomeworkTask 有 timeSlots → valid=false', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.HomeworkTask;
      ctx.data.formData.name = '作业';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }];
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.timeSlots).toBeTruthy();
    });

    test('HomeworkTask 无 dueDate → valid=false', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.HomeworkTask;
      ctx.data.formData.name = '作业';
      ctx.data.formData.timeSlots = [];
      ctx.data.formData.dueDate = '';
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.dueDate).toBeTruthy();
    });

    test('childSelectorVisible=true 但 childIds 为空 → valid=false', () => {
      const ctx = setupForValidate({ childSelectorVisible: true, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '钢琴课';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }];
      ctx.data.formData.childIds = [];
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.childIds).toBeTruthy();
    });

    test('startDateVisible=true 但 startDate 为空 → valid=false', () => {
      const ctx = setupForValidate({ childSelectorVisible: true, startDateVisible: true });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '钢琴课';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }];
      ctx.data.formData.childIds = ['c1'];
      ctx.data.formData.startDate = '';
      expect(ctx._validate()).toBe(false);
      expect(ctx.data.errors.startDate).toBeTruthy();
    });

    test('template-create + AfterSchoolActivity 必填全满足 → valid=true', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '钢琴课';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }];
      expect(ctx._validate()).toBe(true);
    });

    test('template-create + HomeworkTask 必填全满足 → valid=true', () => {
      const ctx = setupForValidate({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.HomeworkTask;
      ctx.data.formData.name = '数学作业';
      ctx.data.formData.timeSlots = [];
      ctx.data.formData.dueDate = '2026-08-30';
      expect(ctx._validate()).toBe(true);
    });
  });

  describe('submit 事件', () => {
    test('校验通过触发 submit 事件 detail={formData, valid: true}', () => {
      const ctx = setup({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '钢琴课';
      ctx.data.formData.timeSlots = [{ dayOfWeek: 3, startTime: '16:00', endTime: '17:00' }];
      ctx.onSubmit();
      expect(ctx.triggerEvent).toHaveBeenCalledWith('submit', {
        formData: expect.objectContaining({
          name: '钢琴课',
          scheduleType: ''  // 注意：scheduleType 不在 formData 中，在 data.scheduleType
        }),
        valid: true
      });
    });

    test('校验失败仍触发 submit 事件 detail={formData, valid: false}', () => {
      const ctx = setup({ mode: 'template-create', childSelectorVisible: false, startDateVisible: false });
      ctx.data.scheduleType = ScheduleType.AfterSchoolActivity;
      ctx.data.formData.name = '';
      ctx.onSubmit();
      expect(ctx.triggerEvent).toHaveBeenCalledWith('submit', expect.objectContaining({
        valid: false
      }));
    });
  });

  describe('WXML data-id 契约', () => {
    const fs = require('fs');
    const path = require('path');
    function readWxml() {
      return fs.readFileSync(path.resolve(__dirname, '../../components/schedule-form/index.wxml'), 'utf8');
    }

    test('WXML 含类型卡 data-id（schedule-form-type-*）', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="schedule-form-type-afterschool"');
      expect(wxml).toContain('data-id="schedule-form-type-daily"');
      expect(wxml).toContain('data-id="schedule-form-type-homework"');
    });

    test('WXML 含名称/时间/备注/地点/日期输入 data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="schedule-form-name-input"');
      expect(wxml).toContain('data-id="schedule-form-notes-input"');
      expect(wxml).toContain('data-id="schedule-form-location-input"');
      expect(wxml).toContain('data-id="schedule-form-repeat-end"');
      expect(wxml).toContain('data-id="schedule-form-due-date"');
      expect(wxml).toContain('data-id="schedule-form-suggest-start"');
      expect(wxml).toContain('data-id="schedule-form-suggest-end"');
    });

    test('WXML 含 child-selector / start-date data-id', () => {
      const wxml = readWxml();
      expect(wxml).toContain('data-id="schedule-form-child-');
      expect(wxml).toContain('data-id="schedule-form-start-date"');
    });
  });
});
