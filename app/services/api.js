// app/services/api.js
// 统一请求封装 —— 所有 wx.request / wx.uploadFile 调用必须通过此模块
// 含：请求拦截（JWT 注入）、响应拦截（错误信封解析）、401 静默续期锁（ADR-007）、429 退避重试

const STORAGE_KEYS = require('../utils/storage-keys');
const crypto = require('../utils/crypto');
const { ErrorCodes, ErrorMessages } = require('../contracts/auth');

// 小程序环境自动切换 —— 开发环境连接本地，生产使用正式域名
const ENV_VERSION = (typeof __wxConfig !== 'undefined' && __wxConfig.envVersion) || 'develop';
const BASE_URL = ENV_VERSION === 'release'
  ? 'https://api.agenda.example.com'
  : ENV_VERSION === 'trial'
    ? 'https://staging-api.agenda.example.com'
    : 'http://localhost:5000';
const DEFAULT_TIMEOUT = 10000;

// 429 退避重试等待时长（毫秒）
const RATE_LIMIT_RETRY_DELAY = 60000;

// 续期锁（ADR-007 Promise 级）：并发 401 复用同一个 refreshPromise
let isRefreshing = false;
let refreshPromise = null;

function getToken() {
  const cipher = wx.getStorageSync(STORAGE_KEYS.AUTH_TOKEN);
  return cipher ? crypto.decrypt(cipher) : null;
}

function setToken(token) {
  wx.setStorageSync(STORAGE_KEYS.AUTH_TOKEN, crypto.encrypt(token));
}

function clearToken() {
  wx.removeStorageSync(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * 隐私政策是否已同意 —— 未同意前禁止发起任何需登录态请求，也不触发 wx.login 续期
 * （微信审核红线：用户同意隐私政策前 MUST NOT 调用 wx.login）
 */
function isPrivacyConsented() {
  if (typeof getApp === 'function') {
    const app = getApp();
    if (app && app.globalData) {
      return !app.globalData.pendingPrivacyConsent;
    }
  }
  return true;
}

/**
 * 通知 app 全局更新登录态（供 T19 续期流程调用 app.setLoginData）
 */
function notifyTokenRefreshed(jwt, userId) {
  if (typeof getApp === 'function') {
    const app = getApp();
    if (app && typeof app.setLoginData === 'function') {
      app.setLoginData(jwt, userId);
    }
  }
}

/**
 * 静默续期：wx.login -> POST /auth/refresh -> 存新 JWT
 */
function doRefresh() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          clearToken();
          wx.showToast({ title: '登录已过期，请重新打开小程序', icon: 'none' });
          reject({ error: ErrorCodes.CODE_INVALID, message: ErrorMessages.CODE_INVALID });
          return;
        }
        request({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          data: { code: loginRes.code },
          skipAuth: true,
          retry401: false
        }).then((res) => {
          const body = res.data || {};
          if (body.jwt) {
            setToken(body.jwt);
            notifyTokenRefreshed(body.jwt, body.userId);
            resolve();
          } else {
            reject({ error: ErrorCodes.INTERNAL_ERROR, message: ErrorMessages.INTERNAL_ERROR });
          }
        }).catch((err) => {
          clearToken();
          const isNetworkError = err && err.error === 'NETWORK_ERROR';
          wx.showToast({
            title: isNetworkError ? '网络异常，请检查网络' : ((err && err.message) || ErrorMessages.CODE_INVALID),
            icon: 'none'
          });
          reject(err);
        });
      },
      fail: () => {
        clearToken();
        wx.showToast({ title: '登录已过期，请重新打开小程序', icon: 'none' });
        reject({ error: ErrorCodes.CODE_INVALID, message: ErrorMessages.CODE_INVALID });
      }
    });
  });
}

/**
 * 获取续期锁：并发 401 复用同一个 refreshPromise
 */
function handle401() {
  if (!refreshPromise) {
    isRefreshing = true;
    refreshPromise = doRefresh().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * 统一请求
 * @param {Object} options
 *   - method   'GET'|'POST'|'PUT'|'DELETE'
 *   - url      相对路径（不含 baseURL）
 *   - data     POST/PUT 请求体 或 GET/DELETE 查询参数
 *   - timeout  超时（默认 10000ms）
 *   - skipAuth true 时不注入 Authorization（login/refresh 用）
 *   - retry401 false 时不触发 401 续期（refresh 调用自身用，防递归）
 * @returns {Promise<{statusCode:number,data:Object,headers:Object}>}
 *   2xx 时 resolve；非 2xx reject {statusCode,error,message,traceId}；网络失败 reject {error:'NETWORK_ERROR',...}
 */
function request(options) {
  const method = (options.method || 'GET').toUpperCase();
  const url = options.url;
  const data = options.data;
  const skipAuth = options.skipAuth === true;
  const retry401 = options.retry401 !== false;

  // 隐私政策未同意前拒绝一切需登录态请求（不触发 401 → wx.login 续期，规避审核红线）
  if (!skipAuth && !isPrivacyConsented()) {
    return Promise.reject({ error: 'PRIVACY_NOT_CONSENTED', message: '未同意隐私政策' });
  }

  const token = skipAuth ? null : getToken();
  const header = { 'Content-Type': 'application/json' };
  if (token) header.Authorization = `Bearer ${token}`;

  const config = {
    url: BASE_URL + url,
    method,
    header,
    timeout: options.timeout || DEFAULT_TIMEOUT
  };

  if (method === 'GET' || method === 'DELETE') {
    if (data && typeof data === 'object') {
      const params = Object.keys(data)
        .filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '')
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
        .join('&');
      if (params) config.url += '?' + params;
    }
  } else {
    config.data = data ? JSON.stringify(data) : undefined;
  }

  return new Promise((resolve, reject) => {
    config.success = (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({ statusCode: res.statusCode, data: res.data, headers: res.header });
        return;
      }

      if (res.statusCode === 401 && retry401) {
        if (options._replayed) {
          reject({ statusCode: 401, error: ErrorCodes.TOKEN_INVALID, message: ErrorMessages.TOKEN_INVALID });
          return;
        }
        handle401().then(() => {
          request(Object.assign({}, options, { _replayed: true })).then(resolve).catch(reject);
        }).catch(() => {
          reject({ statusCode: 401, error: ErrorCodes.TOKEN_INVALID, message: ErrorMessages.TOKEN_INVALID });
        });
        return;
      }

      if (res.statusCode === 429 && !options._rateLimitRetried) {
        setTimeout(() => {
          request(Object.assign({}, options, { _rateLimitRetried: true })).then(resolve).catch(reject);
        }, RATE_LIMIT_RETRY_DELAY);
        return;
      }

      const body = res.data || {};
      reject({
        statusCode: res.statusCode,
        error: body.error || ErrorCodes.INTERNAL_ERROR,
        message: body.message || ErrorMessages[body.error] || ErrorMessages.INTERNAL_ERROR,
        traceId: body.traceId
      });
    };

    config.fail = (err) => {
      reject({ error: 'NETWORK_ERROR', message: '网络请求失败，请检查网络', raw: err });
    };

    wx.request(config);
  });
}

/**
 * 文件上传（multipart/form-data，含 JWT 注入与错误信封解析）
 */
function upload(url, filePath, options = {}) {
  const token = getToken();
  const header = {};
  if (token) header.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + url,
      filePath,
      name: options.name || 'file',
      header,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let data = res.data;
          if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
          }
          resolve({ statusCode: res.statusCode, data, headers: res.header });
        } else {
          let body = res.data;
          if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
          }
          reject({
            statusCode: res.statusCode,
            error: (body && body.error) || ErrorCodes.INTERNAL_ERROR,
            message: (body && body.message) || ErrorMessages.INTERNAL_ERROR,
            traceId: body && body.traceId
          });
        }
      },
      fail: (err) => reject({ error: 'NETWORK_ERROR', message: '网络请求失败，请检查网络', raw: err })
    });
  });
}

module.exports = {
  request,
  get: (url, data, options) => request(Object.assign({ method: 'GET', url, data }, options)),
  post: (url, data, options) => request(Object.assign({ method: 'POST', url, data }, options)),
  put: (url, data, options) => request(Object.assign({ method: 'PUT', url, data }, options)),
  del: (url, data, options) => request(Object.assign({ method: 'DELETE', url, data }, options)),
  upload,
  getToken,
  setToken,
  clearToken,
  BASE_URL,
  DEFAULT_TIMEOUT
};
