// Report Detail Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  const date = getUrlParam('date');
  
  if (!date) {
    showError('未指定报告日期');
    return;
  }
  
  await loadReport(date);
});

async function loadReport(date) {
  try {
    const report = await fetchData(`reports/${date}.json`);
    
    document.getElementById('reportTitle').textContent = `${formatDate(date)} 风险日报`;
    document.title = `${formatDate(date)} 风险日报 - 全球机票风险事件监测`;
    
    renderReport(report);
    
  } catch (error) {
    console.error('Error loading report:', error);
    showError(`无法加载 ${date} 的报告`);
  }
}

function renderReport(report) {
  const container = document.getElementById('reportContent');
  
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
  return `
    <div class="event-card">
      <div class="event-card-title">${event.title}</div>
      ${event.summary ? `<div class="event-card-summary">${event.summary}</div>` : ''}
      <div class="event-details">
        <div class="detail-item">
          <div class="detail-label">✈️ 影响机场</div>
          <div class="detail-value">${event.affectedAirports ? event.affectedAirports.join(', ') : '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">🏢 影响航司</div>
          <div class="detail-value">${event.affectedAirlines ? event.affectedAirlines.join(', ') : '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">👥 影响旅客</div>
          <div class="detail-value">${event.estimatedPassengers || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">⏱️ 持续时间</div>
          <div class="detail-value">${event.duration || '-'}</div>
        </div>
      </div>
      ${event.action ? `
        <div class="action-box">
          <div class="action-label">📋 OTA行动建议</div>
          <div class="action-text">${event.action}</div>
        </div>
      ` : ''}
    </div>
  `;
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
  return icons[category] || '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-8h-2V7h2v2z"/></svg>';
}

function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function showError(message) {
  document.getElementById('reportContent').innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <p>${message}</p>
      <a href="archive.html" class="back-link" style="margin-top: 1rem; display: inline-flex;">查看历史报告</a>
    </div>
  `;
}
