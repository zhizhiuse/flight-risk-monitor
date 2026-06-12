// Dashboard Page Logic — Date switching + Stats + Filters + Compact list

let indexMap = null;
let availableDates = [];
let currentDateIndex = -1;
let currentFilter = { priority: 'all', category: 'all', search: '' };

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
  window.addEventListener('themeChanged', (e) => {
    if (indexMap) {
      indexMap.remove();
      indexMap = null;
      if (window._currentReportData) {
        indexMap = initReportMap('indexMap', window._currentReportData.events);
      }
    }
  });
  startPolling();
});

async function initDashboard() {
  try {
    const archive = await fetchData('archive.json');
    availableDates = archive.reports.map(r => r.date).sort();

    const latest = await fetchData('latest.json');
    const latestDate = latest.reportDate;

    currentDateIndex = availableDates.indexOf(latestDate);
    if (currentDateIndex === -1) {
      availableDates.push(latestDate);
      availableDates.sort();
      currentDateIndex = availableDates.indexOf(latestDate);
    }

    updateDateDisplay();
    updateNavButtons();
    await loadCurrentReport();
    bindFilterEvents();
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showError('加载数据失败，请刷新页面重试');
  }
}

function updateDateDisplay() {
  const display = document.getElementById('dateDisplay');
  if (display && currentDateIndex >= 0 && currentDateIndex < availableDates.length) {
    display.textContent = formatDate(availableDates[currentDateIndex]);
  }
}

function updateNavButtons() {
  const prevBtn = document.getElementById('prevDate');
  const nextBtn = document.getElementById('nextDate');
  if (prevBtn) prevBtn.disabled = currentDateIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentDateIndex >= availableDates.length - 1;
}

async function switchDate(direction) {
  const newIndex = currentDateIndex + direction;
  if (newIndex < 0 || newIndex >= availableDates.length) return;
  currentDateIndex = newIndex;
  updateDateDisplay();
  updateNavButtons();
  await loadCurrentReport();
}

async function loadCurrentReport() {
  if (currentDateIndex < 0 || currentDateIndex >= availableDates.length) return;
  const date = availableDates[currentDateIndex];

  try {
    const report = await fetchData(`reports/${date}.json`);
    window._currentReportData = report;
    window._currentReportDate = date;

    document.getElementById('lastUpdate').textContent = formatTime(report.generatedAt);

    // Destroy old map
    if (indexMap) { indexMap.remove(); indexMap = null; }

    // Render stats, map, event list
    renderStats(report);
    indexMap = initReportMap('indexMap', report.events);
    renderEventList(report);

    document.title = `${formatDateShort(date)} 风险日报 - 全球机票风险事件监测`;
  } catch (error) {
    console.error('Error loading report:', error);
    showError('加载报告数据失败');
  }
}

// ============ Stats Cards ============

function renderStats(report) {
  const events = report.events || [];
  const p0 = events.filter(e => e.priority === 'P0').length;
  const p1 = events.filter(e => e.priority === 'P1').length;
  const p2 = events.filter(e => e.priority === 'P2').length;
  const total = events.length;

  const statsEl = document.getElementById('statsGrid');
  if (!statsEl) return;

  statsEl.innerHTML = `
    <div class="stat-card total">
      <div class="stat-label">📊 风险事件总计</div>
      <div class="stat-value">${total}</div>
      <div class="stat-desc">${formatDateShort(report.reportDate)}</div>
    </div>
    <div class="stat-card p0">
      <div class="stat-label">🔴 P0 紧急</div>
      <div class="stat-value">${p0}</div>
      <div class="stat-desc">需立即响应</div>
    </div>
    <div class="stat-card p1">
      <div class="stat-label">🟠 P1 重要</div>
      <div class="stat-value">${p1}</div>
      <div class="stat-desc">需当日处理</div>
    </div>
    <div class="stat-card p2">
      <div class="stat-label">🟡 P2 关注</div>
      <div class="stat-value">${p2}</div>
      <div class="stat-desc">保持监控</div>
    </div>
  `;
}

// ============ Filter Bar ============

function bindFilterEvents() {
  // Priority filter
  document.querySelectorAll('.filter-priority .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-priority .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.priority = btn.dataset.priority;
      applyFilters();
    });
  });

  // Category filter
  document.querySelectorAll('.filter-category .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-category .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.category = btn.dataset.category;
      applyFilters();
    });
  });

  // Search
  const searchInput = document.getElementById('filterSearch');
  if (searchInput) {
