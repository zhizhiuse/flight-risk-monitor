/**
 * 网站配置 - 数据源与轮询设置
 * 方案B：优先从 raw.githubusercontent.com 读取（push后秒级生效），
 * 失败时回退到本地文件
 */
const SITE_CONFIG = {
  // 主数据源：GitHub raw（实时，push后立即可用）
  dataSource: 'https://raw.githubusercontent.com/zhizhiuse/flight-risk-monitor/main/data/',
  // 本地回退（GitHub Pages构建后可用）
  localSource: 'data/',
  // 轮询间隔：5分钟
  pollInterval: 5 * 60 * 1000
};

/**
 * 智能数据获取
 * 1. 优先 raw.githubusercontent.com（实时）
 * 2. 回退本地 data/ 目录
 */
async function fetchData(path) {
  // 主数据源
  try {
    const response = await fetch(SITE_CONFIG.dataSource + path, { cache: 'no-cache' });
    if (response.ok) return await response.json();
  } catch (e) {
    console.warn('主数据源(raw)不可用，尝试本地回退');
  }
  // 本地回退
  try {
    const response = await fetch(SITE_CONFIG.localSource + path);
    if (response.ok) return await response.json();
  } catch (e) {
    console.error('所有数据源均不可用');
  }
  throw new Error('数据加载失败：' + path);
}
