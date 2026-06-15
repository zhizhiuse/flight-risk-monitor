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

    document.title = `${formatDateShort(date)} AI预警 - 机票特殊事件AI预警`;
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
    searchInput.addEventListener('input', debounce(() => {
      currentFilter.search = searchInput.value.trim().toLowerCase();
      applyFilters();
    }, 200));
  }
}

function applyFilters() {
  const report = window._currentReportData;
  if (!report) return;
  renderEventList(report);
}

function getFilteredEvents(report) {
  let events = report.events || [];

  if (currentFilter.priority !== 'all') {
    events = events.filter(e => e.priority === currentFilter.priority);
  }

  if (currentFilter.category !== 'all') {
    events = events.filter(e => (e.category || '其他') === currentFilter.category);
  }

  if (currentFilter.search) {
    const q = currentFilter.search;
    events = events.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.summary || '').toLowerCase().includes(q) ||
      (e.affectedAirports || []).join(' ').toLowerCase().includes(q) ||
      (e.affectedAirlines || []).join(' ').toLowerCase().includes(q)
    );
  }

  return events;
}

// ============ Event List (Compact) ============

function renderEventList(report) {
  const container = document.getElementById('eventList');
  if (!container) return;

  const events = getFilteredEvents(report);

  // Update count
  const countEl = document.getElementById('filterCount');
  if (countEl) countEl.textContent = `${events.length} 条`;

  // Update category filter buttons dynamically
  updateCategoryButtons(report);

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <p>暂无匹配的风险事件</p>
      </div>
    `;
    return;
  }

  // Group by priority
  const p0 = events.filter(e => e.priority === 'P0');
  const p1 = events.filter(e => e.priority === 'P1');
  const p2 = events.filter(e => e.priority === 'P2');

  let html = '';

  if (p0.length > 0) {
    html += `<div class="event-group-label p0">🔴 P0 紧急 (${p0.length})</div>`;
    html += p0.map(e => renderCompactEvent(e)).join('');
  }
  if (p1.length > 0) {
    html += `<div class="event-group-label p1">🟠 P1 重要 (${p1.length})</div>`;
    html += p1.map(e => renderCompactEvent(e)).join('');
  }
  if (p2.length > 0) {
    html += `<div class="event-group-label p2">🟡 P2 关注 (${p2.length})</div>`;
    html += p2.map(e => renderCompactEvent(e)).join('');
  }

  container.innerHTML = html;

  // Bind expand/collapse
  container.querySelectorAll('.event-item-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.event-item-compact');
      const detail = card.querySelector('.event-item-detail');
      if (detail) {
        detail.classList.toggle('expanded');
        const arrow = header.querySelector('.expand-arrow');
        if (arrow) arrow.classList.toggle('rotated');
      }
    });
  });
}

function renderCompactEvent(event) {
  const category = event.category || '其他';
  const airports = event.affectedAirports ? event.affectedAirports.join(', ') : '-';

  return `
    <div class="event-item-compact" data-id="${event.id}">
      <div class="event-item-header">
        <span class="event-priority ${event.priority.toLowerCase()}">${event.priority}</span>
        <div class="event-item-info">
          <div class="event-item-title">${event.title}</div>
          <div class="event-item-meta">
            <span>${getCategoryIcon(category)} ${category}</span>
            ${airports !== '-' ? `<span>✈️ ${airports}</span>` : ''}
          </div>
        </div>
        <svg class="expand-arrow" viewBox="0 0 24 24" width="18" height="18"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor"/></svg>
      </div>
      <div class="event-item-detail">
        ${event.summary ? `<div class="detail-summary">${event.summary}</div>` : ''}
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">✈️ 影响机场</div><div class="detail-value">${event.affectedAirports ? event.affectedAirports.join(', ') : '-'}</div></div>
          <div class="detail-item"><div class="detail-label">🏢 影响航司</div><div class="detail-value">${event.affectedAirlines ? event.affectedAirlines.join(', ') : '-'}</div></div>
          <div class="detail-item"><div class="detail-label">👥 影响旅客</div><div class="detail-value">${event.estimatedPassengers || '-'}</div></div>
          <div class="detail-item"><div class="detail-label">⏱️ 持续时间</div><div class="detail-value">${event.duration || '-'}</div></div>
        </div>
        ${event.action ? `<div class="action-box"><div class="action-label">📋 OTA建议</div><div class="action-text">${event.action}</div></div>` : ''}
      </div>
    </div>
  `;
}

function updateCategoryButtons(report) {
  const events = report.events || [];
  const categories = [...new Set(events.map(e => e.category || '其他'))];
  const container = document.querySelector('.filter-category');
  if (!container) return;

  const currentActive = currentFilter.category;
  let html = `<button class="filter-btn ${currentActive === 'all' ? 'active' : ''}" data-category="all">全部</button>`;
  categories.forEach(cat => {
    html += `<button class="filter-btn ${currentActive === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>`;
  });
  container.innerHTML = html;

  // Rebind click events
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.category = btn.dataset.category;
      applyFilters();
    });
  });
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
  const container = document.getElementById('statsGrid');
  if (container) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>${message}</p>
      </div>
    `;
  }
}
