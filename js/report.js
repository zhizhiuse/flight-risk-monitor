// Report Detail Page Logic

let reportMap = null;

document.addEventListener('DOMContentLoaded', async () => {
  const date = getUrlParam('date');

  if (!date) {
    showError('未指定报告日期');
    return;
  }

  await loadReport(date);

  // Listen for theme changes to update map tiles
  window.addEventListener('themeChanged', (e) => {
    if (reportMap) {
      reportMap.remove();
      reportMap = null;
      const container = document.getElementById('reportMap');
      if (container && window._currentReportData) {
        reportMap = initReportMap('reportMap', window._currentReportData.events);
      }
    }
  });
});

async function loadReport(date) {
  try {
    const report = await fetchData(`reports/${date}.json`);
    window._currentReportData = report;

    document.getElementById('reportTitle').textContent = `${formatDateShort(date)} 风险日报`;
    document.title = `${formatDateShort(date)} 风险日报 - 全球机票风险事件监测`;

    // Render report content (shared function)
    renderReport(report, 'reportContent');

    // Init mini map
    reportMap = initReportMap('reportMap', report.events);

    // Scroll to anchor if present
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const target = document.querySelector(hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('highlight-card');
          setTimeout(() => target.classList.remove('highlight-card'), 3000);
        }
      }, 300);
    }

  } catch (error) {
    console.error('Error loading report:', error);
    showError(`无法加载 ${date} 的报告`);
  }
}

function showError(message) {
  const container = document.getElementById('reportContent');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <p>${message}</p>
        <a href="archive.html" class="back-link" style="margin-top: 1rem; display: inline-flex;">查看历史报告</a>
      </div>
    `;
  }
}
