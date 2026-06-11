// Dashboard Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    const response = await fetch('data/latest.json');
    if (!response.ok) throw new Error('Failed to load latest.json');
    const latest = await response.json();
    
    // Update page meta
    document.getElementById('currentDate').textContent = formatDate(latest.reportDate);
    document.getElementById('lastUpdate').textContent = formatTime(latest.generatedAt);
    
    // Load full report
    await loadReport(latest.reportDate);
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('加载数据失败，请刷新页面重试');
  }
}

async function loadReport(date) {
  try {
    const response = await fetch(`data/reports/${date}.json`);
    if (!response.ok) throw new Error('Failed to load report');
    const report = await response.json();
    
    updateStats(report.summary);
    updateEventList(report.events);
    updateMapMarkers(report.events);
    
  } catch (error) {
    console.error('Error loading report:', error);
    showError('加载报告数据失败');
  }
}

function updateStats(summary) {
  document.getElementById('p0Count').textContent = summary.p0;
  document.getElementById('p1Count').textContent = summary.p1;
  document.getElementById('p2Count').textContent = summary.p2;
  document.getElementById('totalCount').textContent = summary.total;
}

function updateEventList(events) {
  const container = document.getElementById('eventList');
  
  // Sort events: P0 > P1 > P2
  const sortedEvents = [...events].sort((a, b) => {
    const weightA = getPriorityWeight(a.priority);
    const weightB = getPriorityWeight(b.priority);
    if (weightA !== weightB) return weightB - weightA;
    return a.id.localeCompare(b.id);
  });
  
  container.innerHTML = sortedEvents.map(event => createEventItem(event)).join('');
  
  // Add click handlers
  container.querySelectorAll('.event-item').forEach(item => {
    item.addEventListener('click', () => {
      const date = getUrlParam('date') || '2026-06-10';
      window.location.href = `report.html?date=${date}`;
    });
  });
}

function createEventItem(event) {
  const priorityClass = event.priority.toLowerCase();
  const airports = event.affectedAirports ? event.affectedAirports.join(', ') : '-';
  const airlines = event.affectedAirlines ? event.affectedAirlines.slice(0, 3).join(', ') : '-';
  
  return `
    <div class="event-item" data-id="${event.id}">
      <div class="event-header">
        <span class="event-priority ${priorityClass}">${event.priority}</span>
        <div>
          <div class="event-title">${event.title}</div>
          <div class="event-category">${event.category}</div>
        </div>
      </div>
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
