// app/services/template.js
// 模板模块 API 封装 —— 与 template-module 联调
// 错误码与枚举值一律引用 app/contracts/template.js，禁止手写字符串字面量

const api = require('./api');
const { ErrorCodes, ErrorMessages } = require('../contracts/template');

/**
 * 列表查询：GET /api/v1/templates
 * @param {Object} query
 *   - keyword     string?  按名称模糊搜索
 *   - scheduleType ScheduleType?
 *   - isPreset    boolean?
 *   - page        number
 *   - pageSize    number
 */
function list(query = {}) {
  return api.get('/api/v1/templates', query);
}

/**
 * 模板详情：GET /api/v1/templates/{id}
 */
function getById(templateId) {
  return api.get(`/api/v1/templates/${templateId}`);
}

/**
 * 创建模板：POST /api/v1/templates
 * @param {Object} data 符合 CreateTemplateRequest（dto.json）
 *   - name         string
 *   - scheduleType ScheduleType
 *   - timeSlots    TemplateTimeSlotDto[]?
 *   - repeatEndDate DateOnly?
 *   - location     string?
 *   - notes        string?
 */
function create(data) {
  return api.post('/api/v1/templates', data);
}

/**
 * 更新模板：PUT /api/v1/templates/{id}
 * @param {string} templateId
 * @param {Object} data 符合 UpdateTemplateRequest（dto.json）—— 不含 scheduleType
 */
function update(templateId, data) {
  return api.put(`/api/v1/templates/${templateId}`, data);
}

/**
 * 删除模板（软删除）：DELETE /api/v1/templates/{id}
 */
function remove(templateId) {
  return api.del(`/api/v1/templates/${templateId}`);
}

/**
 * 从模板生成日程：POST /api/v1/templates/{id}/apply
 * @param {string} templateId
 * @param {Object} data 符合 ApplyTemplateRequest（dto.json）
 *   - childId       Guid 必填
 *   - startDate     DateOnly 必填
 *   - name/timeSlots/repeatEndDate/location/notes 可选覆盖
 */
function apply(templateId, data) {
  return api.post(`/api/v1/templates/${templateId}/apply`, data)
    .catch(err => {
      // 关键错误信息透传由 services/api.js 完成；此处仅在不透传时补充（防御性）
      if (err && err.error && ErrorMessages[err.error] && !err.message) {
        throw Object.assign({}, err, { message: ErrorMessages[err.error] });
      }
      throw err;
    });
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  apply,
  // 错误码引用（方便测试断言与上层 UI 展示）
  ErrorCodes
};
