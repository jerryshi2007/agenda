// app/__tests__/helpers/page.js
// 页面/组件 JS 逻辑测试辅助 —— 捕获 Page()/Component() 配置，构造可调用上下文

const path = require('path');

/**
 * 加载页面/组件 JS 文件，捕获其 Page()/Component() 配置
 * @param {string} relativePath 相对 app/ 的路径，如 'pages/mine/index.js'
 * @param {Object} opts.app       mock 的 app 实例（getApp() 返回）
 * @param {Object} opts.query     模拟 onLoad query 参数（会注入为页面模块的 module.exports._query，方便直接注入或通过闭包捕获）
 * @param {boolean} opts.clearCache 是否清除 require 缓存（默认 true）
 * @returns {{ type: 'page'|'component', config: Object }}
 */
function loadPage(relativePath, opts = {}) {
  const { app = {}, query = null, clearCache = true } = opts;
  let captured = null;
  const prevPage = global.Page;
  const prevComponent = global.Component;
  const prevGetApp = global.getApp;
  global.Page = (cfg) => { captured = { type: 'page', config: cfg }; };
  global.Component = (cfg) => { captured = { type: 'component', config: cfg }; };
  global.getApp = () => app;
  if (query) {
    // 暴露为 module 级变量，供页面模块在 require 阶段读取以初始化 data
    global.__PAGE_INIT_QUERY__ = query;
  } else {
    delete global.__PAGE_INIT_QUERY__;
  }
  const abs = path.resolve(__dirname, '..', '..', relativePath);
  if (clearCache) {
    // Jest 的 require.cache 是 live registry，delete 不生效；用 resetModules 强制重新执行。
    // 依赖的 mock 服务须用稳定工厂（见 helpers/auth-mock.js）避免 resetModules 后 mock 实例分叉。
    jest.resetModules();
  }
  require(abs);
  global.Page = prevPage;
  global.Component = prevComponent;
  global.getApp = prevGetApp;
  return captured;
}

/**
 * 按路径设置对象属性，支持 'a.b' / 'list[0].x' 路径
 */
function setByPath(obj, key, value) {
  const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null) cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * 构造页面/组件上下文（含 data 快照 + 可用的 setData + 方法绑定）
 * 兼容 Page（方法在顶层）与 Component（方法在 methods 下）
 * @param {Object} config Page()/Component() 配置对象
 */
function createPageContext(config) {
  const ctx = {
    data: JSON.parse(JSON.stringify(config.data || {})),
    setData: jest.fn(function (patch) {
      for (const [k, v] of Object.entries(patch)) setByPath(this.data, k, v);
    })
  };
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'function') ctx[k] = v.bind(ctx);
  }
  const methods = config.methods || {};
  for (const [k, v] of Object.entries(methods)) {
    if (typeof v === 'function') ctx[k] = v.bind(ctx);
  }
  return ctx;
}

module.exports = { loadPage, createPageContext, setByPath };
