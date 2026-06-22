// Dashboard Page Logic — Full Filter System + Cross-Date Support + Stats + Compact list

let indexMap = null;
let availableDates = [];
let currentDateIndex = -1;

// Current filter state
let currentFilter = {
  priority: 'all',
  category: 'all',
  region: 'all',
  search: '',
  dateStart: '',  // empty = use single date mode (arrow nav)
  dateEnd: ''
};

// Merged events cache (all loaded dates combined, deduped by id)
let mergedEvents = [];
// Map of date -> report data for loaded dates
let reportCache = new Map();
// Whether we are in "custom date range" mode
let isCustomRange = false;

// ============ Category Mapping ============
// Maps raw category values to the 4 main types
const CATEGORY_MAP = {
  '航空安全': '航空安全',
  '航司运营异常': '航司运营异常',
  '航司运营': '航司运营异常',
  '航班异常': '航司运营异常',
  '自然灾害': '自然灾害',
  '自然灾害-暴雨': '自然灾害',
  '自然灾害-地震': '自然灾害',
  '自然灾害-雷雨': '自然灾害',
  '极端天气': '自然灾害',
  '地缘政治': '地缘政治',
  '地缘政治-中东局势': '地缘政治',
  '中东局势': '地缘政治',
};

function mapCategory(rawCategory) {
  if (!rawCategory) return '其他';
  // Exact match first
  if (CATEGORY_MAP[rawCategory]) return CATEGORY_MAP[rawCategory];
  // Fuzzy match: check if any key is included in the raw category
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (rawCategory.includes(key) || key.includes(rawCategory)) return value;
  }
  return '其他';
}

// ============ Region Detection ============
const DOMESTIC_AIRPORT_CODES = new Set([
  'PEK','PKX','SHA','PVG','CAN','CTU','SZX','HGH','TSN','KMG',
  'XIY','FOC','NKG','WUH','CGO','HRB','SHE','TNA','DLC','CSX',
  'CKG','KWL','NNG','HET','LHW','XNN','ZUH','LYA','TAO','YNT',
  'WUX','XNN','LXA','JHG','BPX','ZHA','SYX','HAK','XMN','JJN',
  'WUS','YNZ','CZX','TYN','UCB','BHY','KWE','JGN','AAT','KRL',
  'HTN','KHG','AKU','TCG','NLT','ZHY','GOQ','XIL','HLH','ENH',
  'DAX','JHG','MIG','NAO','ENY','AOG','CHG','NZH','NDG','LNJ',
  'JMU','LYI','SDA','WEH','YIW','HSN','AQG','JDZ','SQJ','GXQ',
  'HUZ','SHJ','JIC','TGO','HMI','BPL','RHT','NZL','KJI','FYN'
]);

const DOMESTIC_ROUTE_KEYWORDS = ['中国', '国内', '大陆'];

function isDomesticEvent(event) {
  // Check affectedAirports field
  const airports = event.affectedAirports ? event.affectedAirports.join(' ') : '';
  const airportField = event.fields ? (event.fields['影响机场'] || '') : '';
  const allAirportText = airports + ' ' + airportField;

  // Check if any domestic airport code appears in the text
  for (const code of DOMESTIC_AIRPORT_CODES) {
    if (allAirportText.includes(code)) return true;
  }

  // Check affectedRoutes field
  const routes = event.affectedRoutes ? event.affectedRoutes.join(' ') : '';
  const routeField = event.fields ? (event.fields['影响航线'] || '') : '';
  const allRouteText = routes + ' ' + routeField;

  for (const keyword of DOMESTIC_ROUTE_KEYWORDS) {
    if (allRouteText.includes(keyword)) return true;
  }

  // Check coordinates for domestic airports
  if (event.coordinates && Array.isArray(event.coordinates)) {
    for (const coord of event.coordinates) {
      if (DOMESTIC_AIRPORT_CODES.has(coord.code)) return true;
    }
  }

  return false;
}

// ============ Init ============

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
  window.addEventListener('themeChanged', (e) => {
    if (indexMap) {
      indexMap.remove();
      indexMap = null;
      const filteredEvents = getFilteredEvents();
      indexMap = initReportMap('indexMap', filteredEvents);
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

    // Set default date range to "today"
    setDateShortcut('today');
    updateDateDisplay();
    updateNavButtons();

    // Set date input min/max bounds
    const startInput = document.getElementById('filterDateStart');
    const endInput = document.getElementById('filterDateEnd');
    if (startInput && endInput && availableDates.length > 0) {
      startInput.min = availableDates[0];
      startInput.max = availableDates[availableDates.length - 1];
      endInput.min = availableDates[0];
      endInput.max = availableDates[availableDates.length - 1];
    }

    await loadAndRender();
    bindFilterEvents();
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showError('加载数据失败，请刷新页面重试');
  }
}

// ============ Date Range Helpers ============

function getTodayStr() {
  if (currentDateIndex >= 0 && currentDateIndex < availableDates.length) {
    return availableDates[currentDateIndex];
  }
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function setDateShortcut(range) {
  const startInput = document.getElementById('filterDateStart');
  const endInput = document.getElementById('filterDateEnd');
  if (!startInput || !endInput) return;

  // Update shortcut button states
  document.querySelectorAll('.filter-shortcut-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.filter-shortcut-btn[data-range="${range}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const today = getTodayStr();

  if (range === 'today') {
    isCustomRange = false;
    currentFilter.dateStart = today;
    currentFilter.dateEnd = today;
    startInput.value = today;
    endInput.value = today;
    enableNavButtons(true);
  } else if (range === '3d') {
    isCustomRange = true;
    const idx = availableDates.indexOf(today);
    const startIdx = Math.max(0, idx - 2);
    currentFilter.dateStart = availableDates[startIdx] || today;
    currentFilter.dateEnd = today;
    startInput.value = currentFilter.dateStart;
    endInput.value = currentFilter.dateEnd;
    enableNavButtons(false);
  } else if (range === '7d') {
    isCustomRange = true;
    const idx = availableDates.indexOf(today);
    const startIdx = Math.max(0, idx - 6);
    currentFilter.dateStart = availableDates[startIdx] || today;
    currentFilter.dateEnd = today;
    startInput.value = currentFilter.dateStart;
    endInput.value = currentFilter.dateEnd;
    enableNavButtons(false);
  } else if (range === 'all') {
    isCustomRange = true;
    currentFilter.dateStart = availableDates[0] || today;
    currentFilter.dateEnd = today;
    startInput.value = currentFilter.dateStart;
    endInput.value = currentFilter.dateEnd;
    enableNavButtons(false);
  }

  loadAndRender();
}

function enableNavButtons(enabled) {
  const prevBtn = document.getElementById('prevDate');
  const nextBtn = document.getElementById('nextDate');
  if (enabled) {
    updateNavButtons();
  } else {
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
  }
}

function onDateInputChange() {
  const startInput = document.getElementById('filterDateStart');
  const endInput = document.getElementById('filterDateEnd');
  if (!startInput || !endInput) return;

  const start = startInput.value;
  const end = endInput.value;

  if (!start || !end) return;

  // Deactivate shortcut buttons
  document.querySelectorAll('.filter-shortcut-btn').forEach(b => b.classList.remove('active'));

  currentFilter.dateStart = start;
  currentFilter.dateEnd = end;

  // If range is a single day that matches current date, use single-day mode
  if (start === end) {
    const idx = availableDates.indexOf(start);
    if (idx !== -1) {
      currentDateIndex = idx;
      isCustomRange = false;
      updateDateDisplay();
      enableNavButtons(true);
    } else {
      isCustomRange = true;
      enableNavButtons(false);
    }
  } else {
    isCustomRange = true;
    enableNavButtons(false);
  }

  loadAndRender();
}

// ============ Date Switcher (arrow nav) ============

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
  if (isCustomRange) return; // Don't switch when in custom range mode
  const newIndex = currentDateIndex + direction;
  if (newIndex < 0 || newIndex >= availableDates.length) return;
  currentDateIndex = newIndex;

  const date = availableDates[currentDateIndex];
  currentFilter.dateStart = date;
  currentFilter.dateEnd = date;

  const startInput = document.getElementById('filterDateStart');
  const endInput = document.getElementById('filterDateEnd');
  if (startInput) startInput.value = date;
  if (endInput) endInput.value = date;

  updateDateDisplay();
  updateNavButtons();
  await loadAndRender();
}

// ============ Data Loading ============

function getDateRange() {
  const start = currentFilter.dateStart;
  const end = currentFilter.dateEnd;
  if (!start || !end) {
    // Default to current date
    if (currentDateIndex >= 0 && currentDateIndex < availableDates.length) {
      return [availableDates[currentDateIndex]];
    }
    return [];
  }
  // Return all available dates within the range
  return availableDates.filter(d => d >= start && d <= end);
}

async function loadReportForDate(date) {
  if (reportCache.has(date)) return reportCache.get(date);
  try {
    const report = await fetchData(`reports/${date}.json`);
    if (report.events) {
      report.events = normalizeEvents(report.events, date);
    }
    reportCache.set(date, report);
    return report;
  } catch (e) {
    console.warn(`Failed to load report for ${date}:`, e);
    return null;
  }
}

function normalizeEvents(events, date) {
  return events.map(e => {
    const normalized = { ...e, priority: e.priority || e.level, _reportDate: date };
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

async function loadAndRender() {
  const dates = getDateRange();
  if (dates.length === 0) return;

  // Load all needed reports
  const reports = [];
  for (const date of dates) {
    const report = await loadReportForDate(date);
    if (report) reports.push(report);
  }

  // Merge events, dedupe by id (keep the latest occurrence)
  const eventMap = new Map();
  for (const report of reports) {
    if (!report.events) continue;
    for (const event of report.events) {
      const id = event.id;
      if (!eventMap.has(id)) {
        eventMap.set(id, event);
      } else {
        // If same id appears on multiple dates, keep the one from the later date
        const existing = eventMap.get(id);
        if (event._reportDate > existing._reportDate) {
          eventMap.set(id, event);
        }
      }
    }
  }

  mergedEvents = [...eventMap.values()];

  // Sort by priority then by date
  mergedEvents.sort((a, b) => {
    const wa = getPriorityWeight(a.priority);
    const wb = getPriorityWeight(b.priority);
    if (wa !== wb) return wb - wa;
    return (b._reportDate || '').localeCompare(a._reportDate || '');
  });

  // Store for backward compatibility
  window._currentReportData = { events: mergedEvents };
  window._currentReportDate = dates[dates.length - 1];

  // Update last update time
  const latestReport = reports[reports.length - 1];
  if (latestReport) {
    document.getElementById('lastUpdate').textContent = formatTime(latestReport.generatedAt || latestReport.generated_at);
  }

  // Render everything
  applyFilters();
}

// ============ Stats Cards ============

function renderStats(events) {
  const p0 = events.filter(e => e.priority === 'P0').length;
  const p1 = events.filter(e => e.priority === 'P1').length;
  const p2 = events.filter(e => e.priority === 'P2').length;
  const total = events.length;

  const statsEl = document.getElementById('statsGrid');
  if (!statsEl) return;

  const dateRange = getDateRange();
  let dateDesc = '';
  if (dateRange.length === 1) {
    dateDesc = formatDateShort(dateRange[0]);
  } else if (dateRange.length > 1) {
    dateDesc = `${formatDateShort(dateRange[0])} ~ ${formatDateShort(dateRange[dateRange.length - 1])}`;
  }

  statsEl.innerHTML = `
    <div class="stat-card total">
      <div class="stat-label">📊 风险事件总计</div>
      <div class="stat-value">${total}</div>
      <div class="stat-desc">${dateDesc}</div>
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

// ============ Filter Logic ============

function bindFilterEvents() {
  // Search
  const searchInput = document.getElementById('filterSearch');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentFilter.search = searchInput.value.trim().toLowerCase();
      applyFilters();
    }, 200));
  }

  // Date inputs
  const startInput = document.getElementById('filterDateStart');
  const endInput = document.getElementById('filterDateEnd');
  if (startInput) {
    startInput.addEventListener('change', onDateInputChange);
  }
  if (endInput) {
    endInput.addEventListener('change', onDateInputChange);
  }
}

function setFilter(type, value) {
  currentFilter[type] = value;

  // Update button active states
  let containerClass;
  let dataAttr;
  if (type === 'priority') {
    containerClass = '.filter-priority';
    dataAttr = 'priority';
  } else if (type === 'category') {
    containerClass = '.filter-category';
    dataAttr = 'category';
  } else if (type === 'region') {
    containerClass = '.filter-region';
    dataAttr = 'region';
  }

  if (containerClass) {
    const container = document.querySelector(containerClass);
    if (container) {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = container.querySelector(`.filter-btn[data-${dataAttr}="${value}"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }
  }

  applyFilters();
}

function applyFilters() {
  const filteredEvents = getFilteredEvents();

  // Update stats
  renderStats(filteredEvents);

  // Update map
  if (indexMap) {
    indexMap.remove();
    indexMap = null;
  }
  if (filteredEvents.length > 0) {
    indexMap = initReportMap('indexMap', filteredEvents);
  } else {
    // Re-init empty map
    indexMap = initReportMap('indexMap', []);
  }

  // Update event list
  renderEventList(filteredEvents);

  // Update count
  const countEl = document.getElementById('filterCount');
  if (countEl) countEl.textContent = `${filteredEvents.length} 条`;
}

function getFilteredEvents() {
  let events = [...mergedEvents];

  // Priority filter
  if (currentFilter.priority !== 'all') {
    events = events.filter(e => e.priority === currentFilter.priority);
  }

  // Category filter (using mapped categories)
  if (currentFilter.category !== 'all') {
    events = events.filter(e => {
      const mappedCat = mapCategory(e.category);
      return mappedCat === currentFilter.category;
    });
  }

  // Region filter
  if (currentFilter.region !== 'all') {
    events = events.filter(e => {
      const domestic = isDomesticEvent(e);
      if (currentFilter.region === 'domestic') return domestic;
      if (currentFilter.region === 'international') return !domestic;
      return true;
    });
  }

  // Search filter
  if (currentFilter.search) {
    const q = currentFilter.search;
    events = events.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.summary || '').toLowerCase().includes(q) ||
      (e.affectedAirports || []).join(' ').toLowerCase().includes(q) ||
      (e.affectedAirlines || []).join(' ').toLowerCase().includes(q) ||
      (e.affectedRoutes || []).join(' ').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q)
    );
  }

  return events;
}

// ============ Event List (Compact) ============

function renderEventList(events) {
  const container = document.getElementById('eventList');
  if (!container) return;

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
  const mappedCat = mapCategory(category);
  const airports = event.affectedAirports ? event.affectedAirports.join(', ') : '-';
  const dateLabel = event._reportDate ? `<span>📅 ${formatDateShort(event._reportDate)}</span>` : '';

  return `
    <div class="event-item-compact" data-id="${event.id}" onclick="showEventDetail('${event.id}')">
      <div class="event-item-header">
        <span class="event-priority ${event.priority.toLowerCase()}">${event.priority}</span>
        <div class="event-item-info">
          <div class="event-item-title">${event.title}</div>
          <div class="event-item-meta">
            <span>${getCategoryIcon(mappedCat)} ${mappedCat}${category !== mappedCat ? ` · ${category}` : ''}</span>
            ${airports !== '-' ? `<span>✈️ ${airports}</span>` : ''}
            ${dateLabel}
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
  // Search in mergedEvents
  const event = mergedEvents.find(e => e.id === eventId);
  if (!event) return;

  const modal = document.getElementById('eventModal');
  const body = document.getElementById('modalBody');
  if (!modal || !body) return;

  const category = event.category || '其他';
  const mappedCat = mapCategory(category);
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

  const dateLabel = event._reportDate ? `<div class="modal-date-label">📅 报告日期：${formatDateShort(event._reportDate)}</div>` : '';

  body.innerHTML = `
    <div class="modal-event-header">
      <span class="event-priority ${priorityClass} modal-priority">${event.priority} ${priorityLabels[priorityClass] || ''}</span>
      <span class="modal-category">${getCategoryIcon(mappedCat)} ${mappedCat}${category !== mappedCat ? ` · ${category}` : ''}</span>
    </div>
    <h2 class="modal-title">${event.title}</h2>
    ${event.summary ? `<div class="modal-summary">${event.summary}</div>` : ''}
    ${dateLabel}
    
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

// ============ Polling ============

function startPolling() {
  setInterval(async () => {
    try {
      const latest = await fetchData('latest.json');
      const latestDate = latest.reportDate || latest.date;
      if (latestDate !== availableDates[availableDates.length - 1]) {
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
    const newDate = latest.reportDate || latest.date;
    if (!availableDates.includes(newDate)) {
      availableDates.push(newDate);
      availableDates.sort();
    }
    // Invalidate cache for the latest date
    reportCache.delete(newDate);

    currentDateIndex = availableDates.indexOf(newDate);
    currentFilter.dateStart = newDate;
    currentFilter.dateEnd = newDate;

    const startInput = document.getElementById('filterDateStart');
    const endInput = document.getElementById('filterDateEnd');
    if (startInput) startInput.value = newDate;
    if (endInput) endInput.value = newDate;

    // Reset shortcut to "today"
    document.querySelectorAll('.filter-shortcut-btn').forEach(b => b.classList.remove('active'));
    const todayBtn = document.querySelector('.filter-shortcut-btn[data-range="today"]');
    if (todayBtn) todayBtn.classList.add('active');

    isCustomRange = false;
    updateDateDisplay();
    enableNavButtons(true);

    await loadAndRender();
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
