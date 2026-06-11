// Archive Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadArchive();
});

async function loadArchive() {
  try {
    const archive = await fetchData('archive.json');
    renderArchive(archive.reports);
    renderTrendChart(archive.reports);
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

  const sortedReports = [...reports].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = sortedReports.map(report => createArchiveItem(report)).join('');

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

// ============ Trend Chart ============
function renderTrendChart(reports) {
  const canvas = document.getElementById('trendChart');
  if (!canvas || !reports || reports.length === 0) return;

  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  // Show last 14 days max
  const data = sorted.slice(-14);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const width = canvas.parentElement.clientWidth;
  const height = 200;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);

  const isLight = document.body.classList.contains('light-theme');
  const textMuted = isLight ? '#9ca3af' : '#6b7280';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const p0Color = '#ef4444';
  const p1Color = '#f59e0b';
  const p2Color = '#eab308';

  const padLeft = 30;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Find max
  let maxVal = 0;
  data.forEach(d => {
    const total = (d.summary.p0 || 0) + (d.summary.p1 || 0) + (d.summary.p2 || 0);
    if (total > maxVal) maxVal = total;
  });
  maxVal = Math.max(maxVal, 5);
  maxVal = Math.ceil(maxVal * 1.2);

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();

    const val = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillStyle = textMuted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, padLeft - 6, y + 3);
  }

  // Draw stacked area chart: P2(bottom) -> P1 -> P0(top)
  const n = data.length;
  if (n < 1) return;

  const barW = Math.min(24, (chartW / n) * 0.6);
  const gap = (chartW - barW * n) / (n + 1);

  data.forEach((d, i) => {
    const x = padLeft + gap + (barW + gap) * i;
    const p0 = d.summary.p0 || 0;
    const p1 = d.summary.p1 || 0;
    const p2 = d.summary.p2 || 0;

    // P2 (bottom)
    if (p2 > 0) {
      const h = (p2 / maxVal) * chartH;
      ctx.fillStyle = p2Color + '55';
      ctx.fillRect(x, padTop + chartH - h, barW, h);
      ctx.fillStyle = p2Color;
      ctx.fillRect(x, padTop + chartH - h, barW, 2);
    }

    // P1
    if (p1 > 0) {
      const h = (p1 / maxVal) * chartH;
      const base = padTop + chartH - (p2 / maxVal) * chartH;
      ctx.fillStyle = p1Color + '55';
      ctx.fillRect(x, base - h, barW, h);
      ctx.fillStyle = p1Color;
      ctx.fillRect(x, base - h, barW, 2);
    }

    // P0
    if (p0 > 0) {
      const h = (p0 / maxVal) * chartH;
      const base = padTop + chartH - ((p2 + p1) / maxVal) * chartH;
      ctx.fillStyle = p0Color + '55';
      ctx.fillRect(x, base - h, barW, h);
      ctx.fillStyle = p0Color;
      ctx.fillRect(x, base - h, barW, 2);
    }

    // Date label
    const dateStr = d.date.slice(5); // MM-DD
    ctx.fillStyle = textMuted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, x + barW / 2, height - 8);
  });

  // Legend
  const legendY = 8;
  const items = [
    { color: p0Color, label: 'P0' },
    { color: p1Color, label: 'P1' },
    { color: p2Color, label: 'P2' }
  ];
  let lx = width - padRight;
  ctx.textAlign = 'right';
  ctx.font = '11px sans-serif';
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    ctx.fillStyle = textMuted;
    ctx.fillText(item.label, lx, legendY + 10);
    lx -= ctx.measureText(item.label).width + 4;
    ctx.fillStyle = item.color;
    ctx.fillRect(lx - 8, legendY + 2, 8, 8);
    lx -= 16;
  }
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

// Redraw chart on resize
window.addEventListener('resize', debounce(() => {
  const archive = document.getElementById('archiveList');
  if (archive && archive.dataset.reports) {
    renderTrendChart(JSON.parse(archive.dataset.reports));
  }
}, 300));

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
