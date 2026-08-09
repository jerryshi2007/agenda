// app/services/api.js
// 统一请求封装 —— 所有 wx.request 调用必须通过此模块

const STORAGE_KEYS = require('../utils/storage-keys');

const BASE_URL = 'http://localhost:5000'; // 开发环境：Docker API 地址
const TIMEOUT = 10000;

let isRefreshingToken = false;
let refreshQueue = [];

/**
 * 发起 HTTP 请求
 * @param {string} method - GET/POST/PUT/DELETE
 * @param {string} url - 相对路径 (不含 baseURL)
 * @param {Object} data - 请求体 (POST/PUT) 或查询参数对象 (GET/DELETE)
 * @param {Object} options - 额外选项
 * @returns {Promise<Object>} { statusCode, data, headers }
 */
function request(method, url, data, options = {}) {
  const token = getToken();
  const header = {
    'Content-Type': 'application/json'
  };
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    url: BASE_URL + url,
    method: method,
    header: header,
    timeout: options.timeout || TIMEOUT,
    success: null,
    fail: null,
    complete: null
  };

  if (method === 'GET' || method === 'DELETE') {
    // 查询参数拼接到 URL
    if (data && typeof data === 'object') {
      const params = Object.keys(data)
        .filter(k => data[k] !== undefined && data[k] !== null && data[k] !== '')
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
        .join('&');
      if (params) {
        config.url += '?' + params;
      }
    }
  } else {
    config.data = data ? JSON.stringify(data) : undefined;
  }

  return new Promise((resolve, reject) => {
    config.success = (res) => {
      if (res.statusCode === 401) {
        // 静默续期
        handle401SilentRefresh().then(() => {
          // 续期成功后重试原请求
          request(method, url, data, options).then(resolve).catch(reject);
        }).catch(() => {
          // 续期失败，清空登录态
          clearToken();
          reject({ statusCode: 401, error: 'TOKEN_INVALID', message: '登录已过期，请重新登录' });
        });
        return;
      }
      resolve({ statusCode: res.statusCode, data: res.data, headers: res.header });
    };
    config.fail = (err) => {
      reject({ error: 'NETWORK_ERROR', message: '网络请求失败，请检查网络', raw: err });
    };
    wx.request(config);
  });
}

function getToken() {
  return wx.getStorageSync(STORAGE_KEYS.TOKEN) || null;
}

function setToken(token) {
  wx.setStorageSync(STORAGE_KEYS.TOKEN, token);
}

function clearToken() {
  wx.removeStorageSync(STORAGE_KEYS.TOKEN);
}

function handle401SilentRefresh() {
  if (isRefreshingToken) {
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }
  isRefreshingToken = true;
  return new Promise((resolve, reject) => {
    wx.login({
      success: (loginRes) => {
        if (loginRes.code) {
          request('POST', '/api/v1/auth/refresh', { code: loginRes.code })
            .then((res) => {
              if (res.data && res.data.token) {
                setToken(res.data.token);
                resolve();
                refreshQueue.forEach(q => q.resolve());
              } else {
                reject();
                refreshQueue.forEach(q => q.reject());
              }
            })
            .catch(() => {
              reject();
              refreshQueue.forEach(q => q.reject());
            });
        } else {
          reject();
          refreshQueue.forEach(q => q.reject());
        }
      },
      fail: () => {
        reject();
        refreshQueue.forEach(q => q.reject());
      },
      complete: () => {
        isRefreshingToken = false;
        refreshQueue = [];
      }
    });
  });
}

module.exports = {
  get: (url, params, options) => request('GET', url, params, options),
  post: (url, data, options) => request('POST', url, data, options),
  put: (url, data, options) => request('PUT', url, data, options),
  del: (url, data, options) => request('DELETE', url, data, options),
  getToken,
  setToken,
  clearToken,
  BASE_URL
};
