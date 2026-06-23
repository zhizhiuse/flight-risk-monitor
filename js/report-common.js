// Shared Report Rendering Functions
// Used by both index.html (dashboard) and report.html

function renderReport(report, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let html = '';

  const p0Events = report.events.filter(e => e.priority === 'P0');
  const p1Events = report.events.filter(e => e.priority === 'P1');
  const p2Events = report.events.filter(e => e.priority === 'P2');

  if (p0Events.length > 0) {
    html += renderPrioritySection('P0', '紧急事件', p0Events);
  }

  if (p1Events.length > 0) {
    html += renderPrioritySection('P1', '重要事件', p1Events);
  }

  if (p2Events.length > 0) {
    html += renderPrioritySection('P2', '关注事件', p2Events);
  }

  if (report.flightAnomalies && report.flightAnomalies.length > 0) {
    html += renderFlightAnomalies(report.flightAnomalies);
  }

  if (report.sources && report.sources.length > 0) {
    html += renderSources(report.sources);
  }

  container.innerHTML = html;
}

function renderPrioritySection(priority, title, events) {
  const priorityClass = priority.toLowerCase();

  const categories = {};
  events.forEach(event => {
    const cat = event.category || '其他';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(event);
  });

  let dimensionsHtml = '';
  for (const [category, categoryEvents] of Object.entries(categories)) {
    dimensionsHtml += `
      <div class="dimension-group">
        <div class="dimension-title">
          ${getCategoryIcon(category)}
          ${category}
        </div>
        ${categoryEvents.map(event => renderEventCard(event)).join('')}
      </div>
    `;
  }

  return `
    <div class="report-section ${priorityClass}">
      <div class="report-section-header">
        <span class="event-priority ${priorityClass}">${priority}</span>
        <h2 class="report-section-title">${title} (${events.length})</h2>
      </div>
      <div class="report-section-body">
        ${dimensionsHtml}
      </div>
    </div>
  `;
}

function renderEventCard(event) {
  const isP2 = event.priority === 'P2';

  // P2事件：一句话总结，不展开详情
  if (isP2) {
    return `
      <div class="event-card p2-compact" id="event-${event.id}">
        <div class="event-card-title">
          <span class="event-priority-badge p2">🟡P2</span>
          ${event.title}
        </div>
        ${event.summary ? `<div class="event-card-summary">${event.summary}</div>` : ''}
      </div>
    `;
  }

  // P0/P1事件：2×2网格信息卡 + 全宽卡 + 蓝色竖线详情段
  const gridFields = [
    { icon: '✈️', label: '影响机场', value: event.affectedAirports ? event.affectedAirports.join(', ') : '-' },
    { icon: '🔀', label: '影响航线', value: event.affectedRoutes ? (Array.isArray(event.affectedRoutes) ? event.affectedRoutes.join(', ') : event.affectedRoutes) : '-' },
    { icon: '🏢', label: '涉及航司', value: event.affectedAirlines ? event.affectedAirlines.join(', ') : '-' },
    { icon: '👥', label: '旅客估算', value: event.estimatedPassengers || '-' }
  ];
  const fullFields = [
    { icon: '⏱️', label: '持续时间', value: event.duration || '-' },
    { icon: '📋', label: 'OTA建议', value: event.otaSuggestion || event.action || '-' }
  ];

  const infoCardsHtml = `
    <div class="card-info-grid">
      ${gridFields.map(f => `
        <div class="card-info-item">
          <div class="card-info-icon">${f.icon}</div>
          <div class="card-info-content">
            <div class="card-info-label">${f.label}</div>
            <div class="card-info-value">${f.value}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="card-info-full">
      ${fullFields.map(f => `
        <div class="card-info-item">
          <div class="card-info-icon">${f.icon}</div>
          <div class="card-info-content">
            <div class="card-info-label">${f.label}</div>
            <div class="card-info-value">${f.value}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 5段详情（蓝色竖线），优先用结构化字段，fallback到description
  const sections = [
    { label: '起因', value: event.cause || null },
    { label: '原因', value: event.reason || null },
    { label: '影响面', value: event.impact || null },
    { label: '当前进展', value: event.currentStatus || null },
    { label: 'OTA影响', value: event.otaImpact || null }
  ];

  const filteredSections = sections.filter(s => s.value);
  let sectionsHtml = filteredSections.map(s => `
    <div class="card-detail-block">
      <div class="card-detail-header">【${s.label}】</div>
      <div class="card-detail-body">${s.value}</div>
    </div>
  `).join('');

  // Fallback: if no structured fields, use description as "事件详情"
  let fallbackSection = '';
  if (filteredSections.length === 0 && event.description) {
    fallbackSection = `
      <div class="card-detail-block">
        <div class="card-detail-header">【事件详情】</div>
        <div class="card-detail-body">${event.description}</div>
      </div>
    `;
  }

  const hasDetail = filteredSections.length > 0 || fallbackSection;

  return `
    <div class="event-card" id="event-${event.id}">
      <div class="event-card-title">
        <span class="event-priority-badge ${event.priority.toLowerCase()}">${event.priority === 'P0' ? '🔴P0' : '🟠P1'}</span>
        ${event.title}
      </div>
      ${event.summary ? `<div class="event-card-summary">${event.summary}</div>` : ''}
      ${infoCardsHtml}
      ${hasDetail ? `
        <div class="card-detail-divider"></div>
        <div class="card-detail-area">
          ${sectionsHtml}
          ${fallbackSection}
        </div>
      ` : ''}
    </div>
  `;
}

function toggleDesc(contentId, btn) {
  const content = document.getElementById(contentId);
  const textEl = btn.querySelector('.toggle-text');
  const svgEl = btn.querySelector('svg');
  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    textEl.textContent = '收起';
    svgEl.style.transform = 'rotate(180deg)';
  } else {
    content.classList.add('collapsed');
    textEl.textContent = '展开详情';
    svgEl.style.transform = 'rotate(0deg)';
  }
}

function renderFlightAnomalies(anomalies) {
  const rows = anomalies.map(group => {
    const flights = group.flights.map(f => {
      const statusClass = f.status === 'cancelled' ? 'cancelled' : 'delayed';
      const statusText = f.status === 'cancelled' ? '取消' : '延误';
      return `
        <tr>
          <td><span class="flight-airport">${group.airport}</span></td>
          <td class="flight-route">${group.airport} → ${group.destination}</td>
          <td><strong>${f.flightNumber}</strong></td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');
    return flights;
  }).join('');

  return `
    <div class="flight-section">
      <div class="section-header">
        <h2 class="section-title">
          <svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          实时航班异常
        </h2>
      </div>
      <div class="flight-table-wrapper">
        <table class="flight-table">
          <thead>
            <tr>
              <th>机场</th>
              <th>航线</th>
              <th>航班号</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSources(sources) {
  return `
    <div class="sources-section">
      <h3 class="sources-title">数据来源</h3>
      <div class="sources-list">
        ${sources.map(source => `
          <span class="source-tag">
            <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            ${source}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function getCategoryIcon(category) {
  const icons = {
    '航空安全': '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    '航司运营': '<svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"/></svg>',
    '极端天气': '<svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM13 3v2h4l-5 10v-6H8l5-10V3h0z"/></svg>',
    '地缘政治': '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-.61.08-1.21.21-1.78L8.99 15v1c0 1.1.9 2 2 2v1.93C7.06 19.43 4 16.07 4 12zm13.89 5.4c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41C17.92 5.77 20 8.65 20 12c0 2.08-.81 3.98-2.11 5.4z"/></svg>'
  };
  return icons[category] || '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
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

function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
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

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Shared map init for report-style pages
function initReportMap(containerId, events) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const map = L.map(containerId, {
    center: [30, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 8,
    worldCopyJump: true,
    zoomControl: true
  });

  const isLight = document.body.classList.contains('light-theme');
  const tileUrl = isLight
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

  L.tileLayer(tileUrl, {
    attribution: '&copy; Esri',
    maxZoom: 16
  }).addTo(map);

  // Add markers
  const markerMap = new Map();
  const priorityColors = { 'P0': '#ef4444', 'P1': '#f59e0b', 'P2': '#eab308' };

  events.forEach(event => {
    if (event.coordinates && Array.isArray(event.coordinates)) {
      event.coordinates.forEach(coord => {
        const key = coord.code;
        if (!markerMap.has(key) || getPriorityWeight(event.priority) > getPriorityWeight(markerMap.get(key).priority)) {
          markerMap.set(key, { lat: coord.lat, lng: coord.lng, priority: event.priority, event: event });
        }
      });
    }
  });

  markerMap.forEach((data, code) => {
    const color = priorityColors[data.priority] || '#6b7280';
    let icon;
    if (data.priority === 'P0') {
      icon = L.divIcon({
        className: 'custom-marker',
        html: `<div class="p0-marker"><div class="p0-pulse" style="background-color:${color};"></div><div class="p0-core" style="background-color:${color};"></div></div>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
      });
    } else {
      const size = data.priority === 'P1' ? 14 : 10;
      icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:${size}px;height:${size}px;background-color:${color};border:2px solid rgba(255,255,255,0.8);border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [size, size], iconAnchor: [size/2, size/2]
      });
    }

    const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);
    marker.bindPopup(`
      <div class="popup-title">${code}</div>
      <span class="popup-priority ${data.priority.toLowerCase()}">${data.priority} ${data.event.category}</span>
      <div class="popup-summary">${data.event.title}</div>
    `, { maxWidth: 260, className: 'dark-popup' });
  });

  // Fit bounds
  if (markerMap.size > 0) {
    const bounds = L.latLngBounds([...markerMap.values()].map(d => [d.lat, d.lng]));
    map.fitBounds(bounds.pad(0.3));
  }

  return map;
}
