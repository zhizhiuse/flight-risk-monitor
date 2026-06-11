// Archive Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadArchive();
});

async function loadArchive() {
  try {
    const response = await fetch('data/archive.json');
    if (!response.ok) throw new Error('Failed to load archive');
    const archive = await response.json();
    
    renderArchive(archive.reports);
    
  } catch (error) {
    console.error('Error loading archive:', error);
    showError('加载历史报告失败');
  }
}

function renderArchive(reports) {
  const container = document.getElementById('archiveList');
  
  if (!reports || reports.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
        <p>暂无历史报告</p>
      </div>
    `;
    return;
  }
  
  // Sort by date descending
  const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  
  container.innerHTML = sortedReports.map(report => createArchiveItem(report)).join('');
  
  // Add click handlers
  container.querySelectorAll('.archive-item').forEach(item => {
    item.addEventListener('click', () => {
      const date = item.dataset.date;
      window.location.href = `report.html?date=${date}`;
    });
  });
}

function createArchiveItem(report) {
  return `
    <div class="archive-item" data-date="${report.date}">
      <div class="archive-date">${formatDateDisplay(report.date)}</div>
      <div class="archive-stats">
        <span class="archive-stat">
          <span class="dot p0"></span>
          <span>P0: ${report.summary.p0}</span>
        </span>
        <span class="archive-stat">
          <span class="dot p1"></span>
          <span>P1: ${report.summary.p1}</span>
        </span>
        <span class="archive-stat">
          <span class="dot p2"></span>
          <span>P2: ${report.summary.p2}</span>
        </span>
      </div>
      <div class="archive-arrow">
        <svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
      </div>
    </div>
  `;
}

function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function showError(message) {
  document.getElementById('archiveList').innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <p>${message}</p>
    </div>
  `;
}
