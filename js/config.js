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

/**
 * 主题切换（全局共享）
 */
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.body.classList.add('light-theme');
  }
  updateThemeIcon();
}

function toggleTheme() {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
  // Notify map to update tiles
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { isLight } }));
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isLight = document.body.classList.contains('light-theme');
  btn.innerHTML = isLight
    ? '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>';
}

// Auto-init theme on load
document.addEventListener('DOMContentLoaded', initTheme);
