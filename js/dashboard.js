// Dashboard Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  initFilters();
  await loadDashboardData();
  startPolling();
  // Listen for theme changes to update map tiles
  window.addEventListener('themeChanged', (e) => {
    if (riskMap) riskMap.updateBaseLayer(e.detail.isLight);
  });
});

// ============ Filters ============
let allEvents = [];

function initFilters() {
  const priorityBtns = document.querySelectorAll('.filter-priority .filter-btn');
  const categoryBtns = document.querySelectorAll('.filter-category .filter-btn');
  const searchInput = document.getElementById('searchInput');

  priorityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      priorityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
  }
}

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function applyFilters() {
  const priorityFilter = document.querySelector('.filter-priority .filter-btn.active')?.dataset.value || 'all';
  const categoryFilter = document.querySelector('.filter-category .filter-btn.active')?.dataset.value || 'all';
  const searchText = document.getElementById('searchInput')?.value?.trim().toLowerCase() || '';

  let filtered = [...allEvents];

  if (priorityFilter !== 'all') {
    filtered = filtered.filter(e => e.priority === priorityFilter);
  }

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(e => e.category === categoryFilter);
  }

  if (searchText) {
    filtered = filtered.filter(e =>
      (e.title && e.title.toLowerCase().includes(searchText)) ||
      (e.summary && e.summary.toLowerCase().includes(searchText)) ||
      (e.description && e.description.toLowerCase().includes(searchText)) ||
      (e.affectedAirports && e.affectedAirports.some(a => a.toLowerCase().includes(searchText))) ||
      (e.affectedAirlines && e.affectedAirlines.some(a => a.toLowerCase().includes(searchText)))
    );
  }

  // Sort
  filtered.sort((a, b) => {
    const weightA = getPriorityWeight(a.priority);
    const weightB = getPriorityWeight(b.priority);
    if (weightA !== weightB) return weightB - weightA;
    return a.id.localeCompare(b.id);
  });

  updateFilteredEventList(filtered);
  updateMapMarkers(filtered);

  // Update count
  const countEl = document.getElementById('filteredCount');
  if (countEl) {
    countEl.textContent = `${filtered.length}/${allEvents.length}`;
  }
}

function updateFilteredEventList(events) {
  const container = document.getElementById('eventList');

  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <p>没有匹配的事件</p>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(event => createEventItem(event)).join('');
}

// ============ Data Loading ============
async function loadDashboardData() {
  try {
    const latest = await fetchData('latest.json');

    document.getElementById('currentDate').textContent = formatDate(latest.reportDate);
    document.getElementById('lastUpdate').textContent = formatTime(latest.generatedAt);

    await loadReport(latest.reportDate);

    window._currentReportDate = latest.reportDate;
    window._lastGeneratedAt = latest.generatedAt;

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('加载数据失败，请刷新页面重试');
  }
}

function startPolling() {
  setInterval(async () => {
    try {
      const latest = await fetchData('latest.json');
      if (latest.reportDate !== window._currentReportDate ||
          latest.generatedAt !== window._lastGeneratedAt) {
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
    document.getElementById('currentDate').textContent = formatDate(latest.reportDate);
    document.getElementById('lastUpdate').textContent = formatTime(latest.generatedAt);
    await loadReport(latest.reportDate);
    window._currentReportDate = latest.reportDate;
    window._lastGeneratedAt = latest.generatedAt;
    window._pendingUpdate = null;
  }
}

async function loadReport(date) {
  try {
    const report = await fetchData(`reports/${date}.json`);

    allEvents = report.events;
    updateStats(report.summary);
    updateEventList(report.events);
    updateMapMarkers(report.events);

    // Populate category filter buttons dynamically
    populateCategoryFilters(report.events);

  } catch (error) {
    console.error('Error loading report:', error);
    showError('加载报告数据失败');
  }
}

function populateCategoryFilters(events) {
  const container = document.querySelector('.filter-category');
  if (!container) return;

  const categories = [...new Set(events.map(e => e.category).filter(Boolean))];
  const existing = container.querySelectorAll('.filter-btn');
  // Keep "全部" button, remove others
  existing.forEach(btn => {
    if (btn.dataset.value !== 'all') btn.remove();
  });

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.value = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
    container.appendChild(btn);
  });
}

function updateStats(summary) {
  document.getElementById('p0Count').textContent = summary.p0;
  document.getElementById('p1Count').textContent = summary.p1;
  document.getElementById('p2Count').textContent = summary.p2;
  document.getElementById('totalCount').textContent = summary.total;
}

function updateEventList(events) {
  const container = document.getElementById('eventList');

  const sortedEvents = [...events].sort((a, b) => {
    const weightA = getPriorityWeight(a.priority);
    const weightB = getPriorityWeight(b.priority);
    if (weightA !== weightB) return weightB - weightA;
    return a.id.localeCompare(b.id);
  });

  allEvents = sortedEvents;

  container.innerHTML = sortedEvents.map(event => createEventItem(event)).join('');

  const countEl = document.getElementById('filteredCount');
  if (countEl) {
    countEl.textContent = `${sortedEvents.length}/${sortedEvents.length}`;
  }
}

function createEventItem(event) {
  const priorityClass = event.priority.toLowerCase();
  const airports = event.affectedAirports ? event.affectedAirports.join(', ') : '-';
  const airlines = event.affectedAirlines ? event.affectedAirlines.slice(0, 3).join(', ') : '-';

  const summary = event.summary ? `<div class="event-summary">${event.summary.length > 80 ? event.summary.substring(0, 80) + '...' : event.summary}</div>` : (event.description ? `<div class="event-summary">${event.description.length > 60 ? event.description.substring(0, 60) + '...' : event.description}</div>` : '');

  return `
    <div class="event-item" data-id="${event.id}">
      <div class="event-header">
        <span class="event-priority ${priorityClass}">${event.priority}</span>
        <div>
          <div class="event-title">${event.title}</div>
          <div class="event-category">${event.category}</div>
        </div>
      </div>
      ${summary}
      <div class="event-meta">
        <span class="event-meta-item">
          <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          ${airports}
        </span>
        <span class="event-meta-item">
          <svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          ${airlines}${event.affectedAirlines && event.affectedAirlines.length > 3 ? '...' : ''}
        </span>
        <span class="event-meta-item">
          <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          ${event.estimatedPassengers}
        </span>
      </div>
    </div>
  `;
}

function getPriorityWeight(priority) {
  const weights = { 'P0': 3, 'P1': 2, 'P2': 1 };
  return weights[priority] || 0;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function showError(message) {
  document.getElementById('eventList').innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <p>${message}</p>
    </div>
  `;
}
