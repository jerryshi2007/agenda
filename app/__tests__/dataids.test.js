// app/__tests__/dataids.test.js
// WXML data-id 可测试性契约校验 —— 逐文件读取 WXML，断言必需 data-id 齐全
// 这是 data-id 契约的「文本级」锁定：交互元素必须有稳定标识符，测试据此定位

const fs = require('fs');
const path = require('path');

const APP_ROOT = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(APP_ROOT, relPath), 'utf8');
}

describe('WXML data-id 契约', () => {
  test('privacy-dialog 组件含 6 个必需 data-id', () => {
    const wxml = readFile('components/privacy-dialog/index.wxml');
    [
      'privacy-dialog-checkbox',
      'privacy-dialog-checkbox-input',
      'privacy-dialog-agree-btn',
      'privacy-dialog-decline-btn',
      'privacy-dialog-policy-link',
      'privacy-dialog-loading'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('privacy-prompt 页面含 1 个必需 data-id', () => {
    const wxml = readFile('pages/privacy-prompt/index.wxml');
    expect(wxml).toContain('data-id="privacy-prompt-review-btn"');
  });

  test('profile-collection 组件含 4 个必需 data-id', () => {
    const wxml = readFile('components/profile-collection/index.wxml');
    [
      'profile-collection-avatar',
      'profile-collection-nickname-input',
      'profile-collection-start-btn',
      'profile-collection-loading'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('profile-edit 页面含 5 个必需 data-id', () => {
    const wxml = readFile('pages/profile-edit/index.wxml');
    [
      'profile-edit-avatar',
      'profile-edit-nickname-input',
      'profile-edit-save-btn',
      'profile-edit-cancel-btn',
      'profile-edit-error'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('mine 页面含全部必需 data-id（含动态 family-id 前缀）', () => {
    const wxml = readFile('pages/mine/index.wxml');
    [
      'mine-avatar-area',
      'mine-switch-family',
      'mine-create-family',
      'mine-join-family',
      'mine-settings',
      'mine-loading',
      'mine-error',
      'mine-empty-family'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 动态列表项：data-id 包含唯一 familyId
    expect(wxml).toContain('data-id="mine-family-info-{{currentFamily.familyId}}"');
    // 回归防护：role 枚举值为 PascalCase，WXML 比对必须是 'Parent'（H2 修复）
    expect(wxml).toContain("role === 'Parent'");
    expect(wxml).not.toContain("role === 'parent'");
  });

  test('settings 页面含注销相关 data-id', () => {
    const wxml = readFile('pages/settings/index.wxml');
    [
      'settings-delete-account',
      'settings-delete-dialog',
      'settings-delete-confirm-btn',
      'settings-delete-cancel-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('deleted-recovery 页面含 4 个必需 data-id', () => {
    const wxml = readFile('pages/deleted-recovery/index.wxml');
    [
      'deleted-recovery-restore-btn',
      'deleted-recovery-dismiss-btn',
      'deleted-recovery-countdown',
      'deleted-recovery-loading'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('schedule-detail 页面含打卡状态机全部必需 data-id', () => {
    const wxml = readFile('pages/schedule-detail/index.wxml');
    [
      'schedule-detail-checkin-btn',
      'schedule-detail-checkin-btn-disabled',
      'schedule-detail-checkin-countdown',
      'schedule-detail-undo-btn',
      'schedule-detail-checkin-loading',
      'schedule-detail-checkin-error',
      'schedule-detail-status-completed',
      'schedule-detail-status-ended',
      'schedule-detail-status-incomplete',
      'schedule-detail-status-overdue',
      'schedule-detail-status-cancelled'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('隐私政策拒绝页不包含任何 API 调用（无 wx.login / wx.request）', () => {
    const js = readFile('pages/privacy-prompt/index.js');
    expect(js).not.toContain('wx.login(');
    expect(js).not.toContain('wx.request(');
  });

  test('family-welcome 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-welcome/index.wxml');
    [
      'welcome-create-btn',
      'welcome-join-btn',
      'welcome-retry-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('family-create 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-create/index.wxml');
    [
      'create-family-name-input',
      'create-family-role-parent',
      'create-family-role-child',
      'create-family-submit-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 回归防护：role-mask 死链模式必须被移除
    expect(wxml).not.toContain('create-family-role-mask');
    expect(wxml).not.toContain('create-family-role-picker');
  });

  test('family-join 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-join/index.wxml');
    [
      'join-family-code-input',
      'join-family-submit-btn',
      'join-family-back-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });

  test('family-invite 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-invite/index.wxml');
    [
      'invite-member-parent-card',
      'invite-member-child-card',
      'invite-member-child-name',
      'invite-member-mode-picker',
      'invite-member-generate-btn',
      'invite-code-display',
      'invite-code-copy-btn',
      'invite-member-share-btn',
      'invite-code-regenerate-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 动态展示模式项
    expect(wxml).toContain('data-id="invite-member-mode-{{item.mode === \'Preschool\' ? \'preschool\' : (item.mode === \'Primary\' ? \'primary\' : \'senior\')}}"');
  });

  test('family-invite-list 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-invite-list/index.wxml');
    [
      'invite-list-retry-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 动态邀请行
    expect(wxml).toContain('data-id="invite-list-row-{{item.id}}"');
    expect(wxml).toContain('data-id="invite-list-revoke-btn-{{item.id}}"');
  });

  test('family-members 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-members/index.wxml');
    [
      'family-members-invite-btn',
      'family-members-invite-list-btn',
      'family-members-retry-btn',
      'family-members-leave-btn',
      'family-members-disband-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 动态成员行
    expect(wxml).toContain('data-id="family-members-row-{{item.memberId}}"');
  });

  test('family-display-mode 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-display-mode/index.wxml');
    [
      'family-display-mode-error',
      'family-display-mode-success',
      'family-display-mode-save-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 动态模式卡（含 {{item.mode}} 模板）
    expect(wxml).toContain('data-id="family-display-mode-card-{{item.mode}}"');
  });

  test('family-switch 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-switch/index.wxml');
    [
      'family-switch-retry-btn'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
    // 动态家庭行
    expect(wxml).toContain('data-id="family-switch-row-{{item.familyId}}"');
  });

  test('family-restore 页面含全部必需 data-id', () => {
    const wxml = readFile('pages/family-restore/index.wxml');
    [
      'family-restore-btn',
      'family-restore-skip-btn',
      'family-restore-error',
      'family-restore-success'
    ].forEach(id => expect(wxml).toContain(`data-id="${id}"`));
  });
});
