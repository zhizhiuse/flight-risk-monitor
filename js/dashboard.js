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
    availableDates = archive.reports.map(r => r.reportDate || r.date).filter(Boolean).sort();

    const latest = await fetchData('latest.json');
    const latestDate = latest.reportDate || latest.date;

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
    // Normalize events: support both old format (affectedAirports etc) and new format (level + fields)
    if (report.events) {
      report.events = report.events.map(e => {
        const normalized = { ...e, priority: e.priority || e.level };
        if (e.fields && !e.affectedAirports) {
          normalized.affectedAirports = e.fields['影响机场'] ? [e.fields['影响机场']] : [];
          normalized.affectedRoutes = e.fields['影响航线'] ? [e.fields['影响航线']] : [];
          normalized.affectedAirlines = e.fields['影响航司'] ? [e.fields['影响航司']] : [];
          normalized.estimatedPassengers = e.fields['影响旅客估算'] || e.fields['影响旅客'] || '-';
          normalized.duration = e.fields['持续时间'] || '-';
          normalized.action = e.fields['OTA行动建议'] || e.fields['OTA建议'] || '-';
        }
        // Middle East special format
        if (e.impact_airports && !e.affectedAirports) {
          normalized.affectedAirports = [e.impact_airports];
          normalized.affectedRoutes = [e.impact_routes || '-'];
          normalized.affectedAirlines = [e.airlines || '-'];
          normalized.estimatedPassengers = e.passengers_est || '-';
          normalized.duration = e.duration || '-';
          normalized.action = e.ota_advice || '-';
        }
        return normalized;
      });
    }
    window._currentReportData = report;
    window._currentReportDate = date;

    document.getElementById('lastUpdate').textContent = formatTime(report.generatedAt || report.generated_at);

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
  const events = (report.events || []).map(e => ({ ...e, priority: e.priority || e.level }));
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
  let events = (report.events || []).map(e => ({ ...e, priority: e.priority || e.level }));

  if (currentFilter.priority !== 'all') {
    events = events.filter(e => e.priority === currentFilter.priority);
  }

  if (currentFilter.category !== 'all') {
    events = events.filter(e => {
      const cat = e.category || '其他';
      // 包含匹配：选"中东局势"也能匹配"地缘政治-中东局势"
      return cat === currentFilter.category || cat.includes(currentFilter.category) || currentFilter.category.includes(cat);
    });
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
}

function renderCompactEvent(event) {
  const category = event.category || '其他';
  const airports = event.affectedAirports ? event.affectedAirports.join(', ') : '-';

  return `
    <div class="event-item-compact" data-id="${event.id}" onclick="showEventDetail('${event.id}')">
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
      <div class="event-item-detail" onclick="event.stopPropagation()">
        ${event.summary ? `<div class="detail-summary">${event.summary}</div>` : ''}
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">✈️ 影响机场</div><div class="detail-value">${event.affectedAirports ? event.affectedAirports.join(', ') : '-'}</div></div>
          <div class="detail-item"><div class="detail-label">🏢 影响航司</div><div class="detail-value">${event.affectedAirlines ? event.affectedAirlines.join(', ') : '-'}</div></div>
          <div class="detail-item"><div class="detail-label">👥 影响旅客</div><div class="detail-value">${event.estimatedPassengers || '-'}</div></div>
          <div class="detail-item"><div class="detail-label">⏱️ 持续时间</div><div class="detail-value">${event.duration || '-'}</div></div>
        </div>
        ${event.action ? `<div class="action-box"><div class="action-label">📋 OTA建议</div><div class="action-text">${event.action}</div></div>` : ''}
        <div class="detail-view-btn" onclick="event.stopPropagation(); showEventDetail('${event.id}')">查看详情 →</div>
      </div>
    </div>
  `;
}

// ============ Event Detail Modal ============

function showEventDetail(eventId) {
  const report = window._currentReportData;
  if (!report) return;

  const event = report.events.find(e => e.id === eventId);
  if (!event) return;

  const modal = document.getElementById('eventModal');
  const body = document.getElementById('modalBody');
  if (!modal || !body) return;

  const category = event.category || '其他';
  const priorityClass = event.priority.toLowerCase();
  const priorityLabels = { 'p0': '🔴 紧急', 'p1': '🟠 重要', 'p2': '🟡 关注' };

  // Parse description into sections
  let descHtml = '';
  if (event.description) {
    const lines = event.description.split('\\n').join('\n').split('\n');
    let currentSection = '';
    let sectionHtml = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check if it's a section header like 【起因】
      const sectionMatch = trimmed.match(/^【(.+?)】(.*)$/);
      if (sectionMatch) {
        if (currentSection) {
          descHtml += `<div class="modal-desc-section"><div class="modal-desc-header">${currentSection}</div>${sectionHtml}</div>`;
        }
        currentSection = sectionMatch[1];
        sectionHtml = sectionMatch[2] ? `<p>${sectionMatch[2]}</p>` : '';
      } else if (trimmed.startsWith('- ')) {
        sectionHtml += `<div class="modal-desc-list-item">${trimmed.substring(2)}</div>`;
      } else {
        sectionHtml += `<p>${trimmed}</p>`;
      }
    }
    if (currentSection) {
      descHtml += `<div class="modal-desc-section"><div class="modal-desc-header">${currentSection}</div>${sectionHtml}</div>`;
    }
  }

  // Build sources list
  let sourcesHtml = '';
  if (event.sources && event.sources.length > 0) {
    sourcesHtml = `
      <div class="modal-sources">
        <div class="modal-sources-title">📎 信源链接</div>
        <div class="modal-sources-list">
          ${event.sources.map(s => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="modal-source-link">
              <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="currentColor"/></svg>
              <span>${s.name}</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div class="modal-event-header">
      <span class="event-priority ${priorityClass} modal-priority">${event.priority} ${priorityLabels[priorityClass] || ''}</span>
      <span class="modal-category">${getCategoryIcon(category)} ${category}</span>
    </div>
    <h2 class="modal-title">${event.title}</h2>
    ${event.summary ? `<div class="modal-summary">${event.summary}</div>` : ''}
    
    <div class="modal-detail-grid">
      <div class="modal-detail-item">
        <div class="modal-detail-icon">✈️</div>
        <div class="modal-detail-content">
          <div class="modal-detail-label">影响机场</div>
          <div class="modal-detail-value">${event.affectedAirports ? event.affectedAirports.join(', ') : '-'}</div>
        </div>
      </div>
      <div class="modal-detail-item">
        <div class="modal-detail-icon">🔀</div>
        <div class="modal-detail-content">
          <div class="modal-detail-label">影响航线</div>
          <div class="modal-detail-value">${event.affectedRoutes ? event.affectedRoutes.join(', ') : '-'}</div>
        </div>
      </div>
      <div class="modal-detail-item">
        <div class="modal-detail-icon">🏢</div>
        <div class="modal-detail-content">
          <div class="modal-detail-label">影响航司</div>
          <div class="modal-detail-value">${event.affectedAirlines ? event.affectedAirlines.join(', ') : '-'}</div>
        </div>
      </div>
      <div class="modal-detail-item">
        <div class="modal-detail-icon">👥</div>
        <div class="modal-detail-content">
          <div class="modal-detail-label">影响旅客</div>
          <div class="modal-detail-value">${event.estimatedPassengers || '-'}</div>
        </div>
      </div>
      <div class="modal-detail-item">
        <div class="modal-detail-icon">⏱️</div>
        <div class="modal-detail-content">
          <div class="modal-detail-label">持续时间</div>
          <div class="modal-detail-value">${event.duration || '-'}</div>
        </div>
      </div>
      <div class="modal-detail-item">
        <div class="modal-detail-icon">📋</div>
        <div class="modal-detail-content">
          <div class="modal-detail-label">OTA建议</div>
          <div class="modal-detail-value">${event.action || '-'}</div>
        </div>
      </div>
    </div>

    ${descHtml ? `<div class="modal-description">${descHtml}</div>` : ''}
    ${sourcesHtml}
  `;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click or ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeEventModal();
});

document.getElementById('eventModal').addEventListener('click', (e) => {
  if (e.target.id === 'eventModal') closeEventModal();
});

function updateCategoryButtons(report) {
  const events = (report.events || []).map(e => ({ ...e, priority: e.priority || e.level }));
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
      if ((latest.reportDate || latest.date) !== window._currentReportDate) {
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
