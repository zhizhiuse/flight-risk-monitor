// Archive Page Logic

let allReports = [];
let activeLines = 'all'; // 'all', 'P0', 'P1', 'P2', 'total'

document.addEventListener('DOMContentLoaded', async () => {
  initTrendFilter();
  await loadArchive();
  // Listen for theme changes
  window.addEventListener('themeChanged', () => {
    renderTrendChart(allReports);
  });
});

function initTrendFilter() {
  const btns = document.querySelectorAll('.trend-filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeLines = btn.dataset.line;
      renderTrendChart(allReports);
    });
  });
}

async function loadArchive() {
  try {
    const archive = await fetchData('archive.json');
    allReports = archive.reports;
    renderArchive(allReports);
    renderTrendChart(allReports);
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

// ============ Line Chart ============

// Store data points for tooltip
let chartDataPoints = [];

function renderTrendChart(reports) {
  const canvas = document.getElementById('trendChart');
  if (!canvas || !reports || reports.length === 0) return;

  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  const data = sorted.slice(-14);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const width = canvas.parentElement.clientWidth;
  const height = 240;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(dpr, dpr);

  const isLight = document.body.classList.contains('light-theme');
  const textMuted = isLight ? '#9ca3af' : '#6b7280';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const lineWhite = isLight ? '#374151' : '#e5e7eb';

  // Line colors
  const lineColors = {
    total: lineWhite,
    P0: '#ef4444',
    P1: '#f59e0b',
    P2: '#eab308'
  };

  const padLeft = 36;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 36;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Build data series
  const series = data.map(d => ({
    date: d.date,
    total: (d.summary.p0 || 0) + (d.summary.p1 || 0) + (d.summary.p2 || 0),
    P0: d.summary.p0 || 0,
    P1: d.summary.p1 || 0,
    P2: d.summary.p2 || 0
  }));

  // Find max
  let maxVal = 0;
  series.forEach(d => {
    const vals = [d.total, d.P0, d.P1, d.P2];
    vals.forEach(v => { if (v > maxVal) maxVal = v; });
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

  const n = data.length;
  if (n < 1) return;

  // X positions
  const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;

  // Date labels
  series.forEach((d, i) => {
    const x = padLeft + (n > 1 ? xStep * i : chartW / 2);
    const dateStr = d.date.slice(5);
    ctx.fillStyle = textMuted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, x, height - 10);
  });

  // Clear data points for tooltip
  chartDataPoints = [];

  // Determine which lines to draw
  let linesToDraw = [];
  if (activeLines === 'all') {
    linesToDraw = ['total', 'P0', 'P1', 'P2'];
  } else {
    linesToDraw = [activeLines];
  }

  // Draw lines (draw non-active as faint first if "all" mode)
  const allLineKeys = ['P2', 'P1', 'P0', 'total']; // draw order (back to front)

  allLineKeys.forEach(key => {
    const isActive = linesToDraw.includes(key);
    const color = lineColors[key];
    const alpha = isActive ? 1 : 0.15;

    const points = series.map((d, i) => ({
      x: padLeft + (n > 1 ? xStep * i : chartW / 2),
      y: padTop + chartH - (d[key] / maxVal) * chartH,
      value: d[key],
      date: d.date,
      key: key
    }));

    if (points.length < 1) return;

    // Draw smooth line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 2.5 : 1;
    ctx.globalAlpha = alpha;

    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Use cardinal spline for smooth curves
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        const tension = 0.3;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.stroke();

      // Draw data point dots
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 4 : 2, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#ffffff' : '#0a0e17';
        ctx.fill();
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.strokeStyle = color;
        ctx.stroke();

        // Store for tooltip (only active lines)
        if (isActive) {
          chartDataPoints.push({
            x: p.x,
            y: p.y,
            value: p.value,
            date: p.date,
            key: key
          });
        }
      });
    }

    ctx.globalAlpha = 1;
  });

  // Legend (drawn on chart)
  const legendY = 8;
  const legendItems = [
    { color: lineColors.total, label: '总计' },
    { color: lineColors.P0, label: 'P0' },
    { color: lineColors.P1, label: 'P1' },
    { color: lineColors.P2, label: 'P2' }
  ];
  let lx = width - padRight;
  ctx.textAlign = 'right';
  ctx.font = '11px sans-serif';
  for (let i = 0; i < legendItems.length; i++) {
    const item = legendItems[i];
    const isActive = linesToDraw.includes(item.key || item.label === '总计' ? (item.label === '总计' ? 'total' : item.label) : '');
    const drawKey = item.label === '总计' ? 'total' : item.label;
    const isItemActive = linesToDraw.includes(drawKey);

    ctx.globalAlpha = isItemActive ? 1 : 0.3;
    ctx.fillStyle = textMuted;
    ctx.fillText(item.label, lx, legendY + 10);
    lx -= ctx.measureText(item.label).width + 4;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(lx - 4, legendY + 7, 4, 0, Math.PI * 2);
    ctx.fill();
    lx -= 18;
    ctx.globalAlpha = 1;
  }
}

// ============ Tooltip Handling ============

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const tooltip = document.getElementById('chartTooltip');
    if (!tooltip) return;

    // Find nearest point
    let nearest = null;
    let minDist = Infinity;
    chartDataPoints.forEach(p => {
      const dist = Math.sqrt((p.x - mouseX) ** 2 + (p.y - mouseY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    });

    if (nearest && minDist < 30) {
      const dateStr = new Date(nearest.date).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit'
      });
      const keyLabel = { total: '总计', P0: 'P0', P1: 'P1', P2: 'P2' }[nearest.key] || nearest.key;
      tooltip.innerHTML = `<div class="tooltip-date">${dateStr}</div><div class="tooltip-value">${keyLabel}: <strong>${nearest.value}</strong></div>`;
      tooltip.style.display = 'block';
      tooltip.style.left = (nearest.x + rect.left + 12) + 'px';
      tooltip.style.top = (nearest.y + rect.top - 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    const tooltip = document.getElementById('chartTooltip');
    if (tooltip) tooltip.style.display = 'none';
  });
});

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
  if (allReports.length > 0) {
    renderTrendChart(allReports);
  }
}, 300));

function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
