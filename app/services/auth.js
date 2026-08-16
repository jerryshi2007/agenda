// app/services/auth.js
// 认证 API 调用层 —— 9 个端点，全部通过 services/api.js 统一封装
// 错误码与中文提示一律引用 app/contracts/auth.js，禁止手写字符串字面量

const api = require('./api');

/**
 * 微信登录：code 换 JWT
 * POST /api/v1/auth/login（匿名）
 * @param {string} code wx.login 返回的一次性凭证
 * @returns {Promise<LoginResponse>} { jwt, userId, isNewUser, needsProfileCollection, isDeleted?, remainingDays? }
 * @throws {Object} CODE_INVALID / CODE_EXPIRED / RATE_LIMITED / WECHAT_API_ERROR / WECHAT_API_TIMEOUT
 */
function login(code) {
  return api.post('/api/v1/auth/login', { code }, { skipAuth: true }).then(res => res.data);
}

/**
 * 续期：新 code 换新 JWT
 * POST /api/v1/auth/refresh（匿名）
 * @param {string} code wx.login 返回的新一次性凭证
 * @returns {Promise<RefreshResponse>} { jwt, userId }
 * @throws {Object} CODE_INVALID / RATE_LIMITED / WECHAT_API_ERROR
 */
function refresh(code) {
  return api.post('/api/v1/auth/refresh', { code }, { skipAuth: true }).then(res => res.data);
}

/**
 * 获取当前用户资料
 * GET /api/v1/auth/profile（需鉴权）
 * @returns {Promise<ProfileResponse>} { userId, nickname, avatarUrl?, createdAt }
 * @throws {Object} TOKEN_INVALID
 */
function getProfile() {
  return api.get('/api/v1/auth/profile').then(res => res.data);
}

/**
 * 更新用户资料（昵称/头像）
 * PUT /api/v1/auth/profile（需鉴权）
 * @param {{nickname:string, avatarUrl?:string}} data
 * @returns {Promise<ProfileResponse>}
 * @throws {Object} NICKNAME_EMPTY / NICKNAME_TOO_LONG / NICKNAME_SENSITIVE / TOKEN_INVALID
 */
function updateProfile(data) {
  return api.put('/api/v1/auth/profile', data).then(res => res.data);
}

/**
 * 查询注销状态与可注销条件
 * GET /api/v1/auth/deletion-status（需鉴权）
 * @returns {Promise<DeletionStatusResponse>} { isDeleted, canDelete, blockReason?, expiresAt?, remainingDays? }
 * @throws {Object} TOKEN_INVALID
 */
function getDeletionStatus() {
  return api.get('/api/v1/auth/deletion-status').then(res => res.data);
}

/**
 * 请求注销账户
 * POST /api/v1/auth/deletion（需鉴权，空请求体）
 * @returns {Promise<DeletionResponse>} { expiresAt, remainingDays }
 * @throws {Object} FAMILY_STILL_ACTIVE / TOKEN_INVALID
 */
function deleteAccount() {
  return api.post('/api/v1/auth/deletion', {}).then(res => res.data);
}

/**
 * 恢复已注销账户（30 天缓冲期内）
 * POST /api/v1/auth/deletion/recover（需鉴权，空请求体）
 * @returns {Promise<RecoverResponse>} { jwt, userId }
 * @throws {Object} NOT_DELETED / EXPIRED / TOKEN_INVALID
 */
function recoverAccount() {
  return api.post('/api/v1/auth/deletion/recover', {}).then(res => res.data);
}

/**
 * 上传头像
 * POST /api/v1/upload/avatar（需鉴权，multipart）
 * @param {string} filePath 本地头像文件路径
 * @returns {Promise<UploadAvatarResponse>} { url }
 * @throws {Object} FILE_FORMAT_INVALID / FILE_TOO_LARGE / TOKEN_INVALID
 */
function uploadAvatar(filePath) {
  return api.upload('/api/v1/upload/avatar', filePath).then(res => res.data);
}

/**
 * 获取当前用户关联的家庭列表
 * GET /api/v1/users/me/families（需鉴权）
 * @returns {Promise<UserFamiliesResponse>} { families: FamilyInfo[] }
 * @throws {Object} TOKEN_INVALID
 */
function getMyFamilies() {
  return api.get('/api/v1/users/me/families').then(res => res.data);
}

module.exports = {
  login,
  refresh,
  getProfile,
  updateProfile,
  getDeletionStatus,
  deleteAccount,
  recoverAccount,
  uploadAvatar,
  getMyFamilies
};
