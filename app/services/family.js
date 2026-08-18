// app/services/family.js
// 家庭管理模块 API 封装 —— 15 个端点，全部通过 services/api.js 统一封装
// 错误码与枚举值一律引用 app/contracts/family.js，禁止手写字符串字面量
// X-Family-Id Header 由 services/api.js request() 统一从 CURRENT_FAMILY_ID 注入
// 无需家庭上下文的端点（getMyFamilies/joinByCode/getShareInfo/createFamily）显式 skipFamilyHeader:true

const api = require('./api');

/**
 * 获取当前用户所有家庭列表
 * GET /api/v1/families/me（需鉴权；无需 X-Family-Id）
 */
function getMyFamilies() {
  return api.get('/api/v1/families/me', undefined, { skipFamilyHeader: true }).then(res => res.data);
}

/**
 * 创建家庭
 * POST /api/v1/families（需鉴权；无需 X-Family-Id —— 用户尚未属于任何家庭）
 * @param {{name:string, role:string}} data
 */
function createFamily(data) {
  return api.post('/api/v1/families', data, { skipFamilyHeader: true }).then(res => res.data);
}

/**
 * 修改家庭名称
 * PUT /api/v1/families/{id}/name（需鉴权 + X-Family-Id 自动注入）
 */
function updateFamilyName(familyId, name) {
  return api.put(`/api/v1/families/${familyId}/name`, { name }).then(res => res.data);
}

/**
 * 获取家庭成员列表
 * GET /api/v1/families/{id}/members（需鉴权 + X-Family-Id 自动注入）
 */
function getMembers(familyId) {
  return api.get(`/api/v1/families/${familyId}/members`).then(res => res.data);
}

/**
 * 生成邀请码
 * POST /api/v1/families/{id}/invite-code（需鉴权 + X-Family-Id 自动注入）
 * @param {string} familyId
 * @param {{targetRole:string, targetChildName?:string, targetDisplayMode?:string}} data
 */
function generateInviteCode(familyId, data) {
  return api.post(`/api/v1/families/${familyId}/invite-code`, data).then(res => res.data);
}

/**
 * 获取邀请记录列表
 * GET /api/v1/families/{id}/invites（需鉴权 + X-Family-Id 自动注入）
 */
function getInvites(familyId) {
  return api.get(`/api/v1/families/${familyId}/invites`).then(res => res.data);
}

/**
 * 撤销邀请码
 * DELETE /api/v1/families/{id}/invites/{codeId}（需鉴权 + X-Family-Id 自动注入）
 */
function revokeInvite(familyId, codeId) {
  return api.del(`/api/v1/families/${familyId}/invites/${codeId}`).then(res => res.data);
}

/**
 * 通过邀请码加入家庭
 * POST /api/v1/families/join-by-code（需鉴权；无需 X-Family-Id —— 用户尚未属于该家庭）
 * @param {string} code 6 位邀请码
 */
function joinByCode(code) {
  return api.post('/api/v1/families/join-by-code', { code }, { skipFamilyHeader: true }).then(res => res.data);
}

/**
 * 移除成员
 * DELETE /api/v1/families/{id}/members/{memberId}（需鉴权 + X-Family-Id 自动注入）
 */
function removeMember(familyId, memberId) {
  return api.del(`/api/v1/families/${familyId}/members/${memberId}`).then(res => res.data);
}

/**
 * 转让创建者
 * POST /api/v1/families/{id}/transfer-creator/{newCreatorId}（需鉴权 + X-Family-Id 自动注入）
 */
function transferCreator(familyId, newCreatorId) {
  return api.post(
    `/api/v1/families/${familyId}/transfer-creator/${newCreatorId}`
  ).then(res => res.data);
}

/**
 * 设置孩子展示模式
 * PUT /api/v1/families/members/{memberId}/display-mode（需鉴权 + X-Family-Id 自动注入）
 */
function setDisplayMode(memberId, displayMode) {
  return api.put(
    `/api/v1/families/members/${memberId}/display-mode`,
    { displayMode }
  ).then(res => res.data);
}

/**
 * 退出家庭
 * POST /api/v1/families/{id}/exit（需鉴权 + X-Family-Id 自动注入）
 */
function exitFamily(familyId) {
  return api.post(`/api/v1/families/${familyId}/exit`).then(res => res.data);
}

/**
 * 解散家庭
 * POST /api/v1/families/{id}/dissolve（需鉴权 + X-Family-Id 自动注入）
 * @param {string} familyName 用于二次确认
 */
function dissolveFamily(familyId, familyName) {
  return api.post(
    `/api/v1/families/${familyId}/dissolve`,
    { familyName }
  ).then(res => res.data);
}

/**
 * 恢复已解散家庭
 * POST /api/v1/families/{id}/restore（需鉴权；无需 X-Family-Id —— 家庭已解散无上下文）
 */
function restoreFamily(familyId) {
  return api.post(`/api/v1/families/${familyId}/restore`, undefined, { skipFamilyHeader: true }).then(res => res.data);
}

/**
 * 获取分享卡片信息（微信分享入口）
 * GET /api/v1/families/get-share-info/{code}（需鉴权；无需 X-Family-Id）
 * @param {string} code 邀请码
 */
function getShareInfo(code) {
  return api.get(`/api/v1/families/get-share-info/${code}`, undefined, { skipFamilyHeader: true }).then(res => res.data);
}

module.exports = {
  getMyFamilies,
  createFamily,
  updateFamilyName,
  getMembers,
  generateInviteCode,
  getInvites,
  revokeInvite,
  joinByCode,
  removeMember,
  transferCreator,
  setDisplayMode,
  exitFamily,
  dissolveFamily,
  restoreFamily,
  getShareInfo
};
