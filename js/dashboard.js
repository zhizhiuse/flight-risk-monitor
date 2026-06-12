// Dashboard Page Logic — Now shows daily report with date switching

let indexMap = null;
let availableDates = [];
let currentDateIndex = -1;

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
  // Listen for theme changes to update map tiles
  window.addEventListener('themeChanged', (e) => {
    if (indexMap) {
      indexMap.remove();
      indexMap = null;
      const container = document.getElementById('indexMap');
      if (container && window._currentReportData) {
        indexMap = initReportMap('indexMap', window._currentReportData.events);
      }
    }
  });
  startPolling();
});

async function initDashboard() {
  try {
    // Load available dates from archive
    const archive = await fetchData('archive.json');
    availableDates = archive.reports.map(r => r.date).sort();

    // Load latest date
    const latest = await fetchData('latest.json');
    const latestDate = latest.reportDate;

    // Find index of latest date
    currentDateIndex = availableDates.indexOf(latestDate);
    if (currentDateIndex === -1) {
      availableDates.push(latestDate);
      availableDates.sort();
      currentDateIndex = availableDates.indexOf(latestDate);
    }

    // Update date display
    updateDateDisplay();
    updateNavButtons();

    // Load the report
    await loadCurrentReport();

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

    // Destroy old map before re-rendering
    if (indexMap) {
      indexMap.remove();
      indexMap = null;
    }

    // Init map
    indexMap = initReportMap('indexMap', report.events);

    // Render report content (shared function)
    renderReport(report, 'reportContent');

    // Update page title
    document.title = `${formatDateShort(date)} 风险日报 - 全球机票风险事件监测`;

  } catch (error) {
    console.error('Error loading report:', error);
    showError('加载报告数据失败');
  }
}

// ============ Polling ============

function startPolling() {
  setInterval(async () => {
    try {
      const latest = await fetchData('latest.json');
      if (latest.reportDate !== window._currentReportDate) {
        showUpdateNotification(latest);
      }
    } catch (e) {}
  }, SITE_CONFIG.pollInterval);
}

function showUpdateNotification(latest) {
  const existing = document.getElementById('updateNotification');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'updateNotification';
  banner.className = 'update-notification';
  banner.innerHTML = `
    <span>📡 检测到新的风险数据更新</span>
    <button onclick="refreshDashboard()">立即刷新</button>
    <button onclick="this.parentElement.remove()" class="btn-dismiss">稍后</button>
  `;
  document.body.appendChild(banner);

  window._pendingUpdate = latest;
}

async function refreshDashboard() {
  const notification = document.getElementById('updateNotification');
  if (notification) notification.remove();

  if (window._pendingUpdate) {
    const latest = window._pendingUpdate;
    const newDate = latest.reportDate;

    // Add new date to available dates if needed
    if (!availableDates.includes(newDate)) {
      availableDates.push(newDate);
      availableDates.sort();
    }
    currentDateIndex = availableDates.indexOf(newDate);

    updateDateDisplay();
    updateNavButtons();
    await loadCurrentReport();

    window._pendingUpdate = null;
  }
}

function showError(message) {
  const container = document.getElementById('reportContent');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>${message}</p>
      </div>
    `;
  }
}
