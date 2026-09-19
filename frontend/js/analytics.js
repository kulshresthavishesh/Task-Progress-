// analytics.js - monthly and yearly analytics (numbers + charts) from the backend.
(async function () {
  const user = await requireAuth();
  if (!user) return;
  buildShell(user, 'analytics');

  const now = new Date();
  const MIN_YEAR = 2020;
  const MAX_YEAR = now.getFullYear() + 3;
  const state = { view: 'month', year: now.getFullYear(), month: now.getMonth() + 1 };
  const body = el('analyticsBody');
  let chart = null;
  let redraw = null; // function that redraws the current chart (used when the theme changes)
  let requestId = 0;

  el('prevPeriod').innerHTML = icon('left');
  el('nextPeriod').innerHTML = icon('right');
  el('monthSelect').innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
  let yearOptions = '';
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) yearOptions += `<option value="${y}">${y}</option>`;
  el('yearSelect').innerHTML = yearOptions;

  function tile(label, value, sub, lead) {
    return `<div class="stat tile${lead ? ' lead' : ''}"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><span class="stat-sub">${sub || '&nbsp;'}</span></div>`;
  }

  function destroyChart() {
    if (chart) { chart.destroy(); chart = null; }
    redraw = null;
  }

  function syncControls() {
    el('monthSelect').value = state.month;
    el('yearSelect').value = state.year;
    el('monthSelect').hidden = state.view === 'year';
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.view === state.view));
  }

  async function load() {
    const id = ++requestId;
    destroyChart();
    syncControls();
    body.innerHTML = '<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:280px"></div>';
    try {
      if (state.view === 'month') {
        const data = await api(`/analytics/month/${state.year}/${state.month}`);
        if (id === requestId) renderMonth(data);
      } else {
        const data = await api(`/analytics/year/${state.year}`);
        if (id === requestId) renderYear(data);
      }
    } catch (err) {
      if (id === requestId) body.innerHTML = `<div class="card">${emptyState("We couldn't load your analytics", err.message)}</div>`;
    }
  }

  /* ----- Monthly ----- */
  function renderMonth(d) {
    if (d.totalTasks === 0) {
      body.innerHTML = `<div class="card">${emptyState(`No data for ${MONTH_NAMES[d.month - 1]} ${d.year}`, 'Complete some tasks to start building your progress history.')}</div>`;
      return;
    }
    const short = (date) => formatDate(date, { month: 'short', day: 'numeric' });
    body.innerHTML = `
      <section class="tiles">
        ${tile('Monthly progress', d.monthlyProgress + '%', `${d.completedTasks} of ${d.totalTasks} tasks`, true)}
        ${tile('Average daily progress', d.averageDailyProgress + '%', `Across ${plural(d.activeDays, 'active day')}`)}
        ${tile('Total tasks', d.totalTasks)}
        ${tile('Completed', d.completedTasks)}
        ${tile('Incomplete', d.incompleteTasks)}
        ${tile('Best day', d.bestDay ? d.bestDay.progress + '%' : '–', d.bestDay ? short(d.bestDay.date) : '')}
        ${tile('Worst day', d.worstDay ? d.worstDay.progress + '%' : '–', d.worstDay ? short(d.worstDay.date) : '')}
      </section>
      <section class="card">
        <div class="card-head"><h2>Daily progress</h2></div>
        <div class="chart-box tall"><canvas id="mainChart"></canvas></div>
        <p class="footnote muted">Monthly progress counts every task equally, so a day with more tasks weighs more. Average daily progress gives every day the same weight.</p>
      </section>`;

    redraw = () => {
      applyChartDefaults();
      chart = new Chart(el('mainChart'), {
        type: 'line',
        data: {
          labels: d.days.map((x) => x.day),
          datasets: [{
            data: d.days.map((x) => (x.total > 0 ? x.progress : null)), // days without tasks stay empty
            borderColor: cssVar('--accent'),
            backgroundColor: cssVar('--accent-soft'),
            fill: true, tension: 0.3, spanGaps: false,
            pointRadius: 3.5, pointHoverRadius: 6, pointBackgroundColor: cssVar('--accent'), borderWidth: 2.5,
          }],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => formatDate(d.days[items[0].dataIndex].date, { weekday: 'short', month: 'long', day: 'numeric' }),
                label: (item) => { const x = d.days[item.dataIndex]; return `${x.progress}% (${x.completed}/${x.total} completed)`; },
              },
            },
          },
          scales: {
            y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + '%' }, grid: { color: cssVar('--border') } },
            x: { grid: { display: false }, title: { display: true, text: `${MONTH_NAMES[d.month - 1]} ${d.year}` }, ticks: { autoSkip: true, maxTicksLimit: 16 } },
          },
        },
      });
    };
    redraw();
  }

  /* ----- Yearly ----- */
  function renderYear(d) {
    if (d.totalTasks === 0) {
      body.innerHTML = `<div class="card">${emptyState(`No data for ${d.year}`, 'Complete some tasks to start building your progress history.')}</div>`;
      return;
    }
    body.innerHTML = `
      <section class="tiles">
        ${tile('Yearly progress', d.yearlyProgress + '%', `${d.completedTasks} of ${d.totalTasks} tasks`, true)}
        ${tile('Total tasks', d.totalTasks)}
        ${tile('Completed', d.completedTasks)}
        ${tile('Incomplete', d.incompleteTasks)}
        ${tile('Best month', d.bestMonth ? d.bestMonth.progress + '%' : '–', d.bestMonth ? MONTH_NAMES[d.bestMonth.month - 1] : '')}
        ${tile('Worst month', d.worstMonth ? d.worstMonth.progress + '%' : '–', d.worstMonth ? MONTH_NAMES[d.worstMonth.month - 1] : '')}
      </section>
      <section class="card">
        <div class="card-head"><h2>Progress by month</h2></div>
        <div class="chart-box tall"><canvas id="mainChart"></canvas></div>
        <p class="footnote muted">Yearly progress is total completed tasks divided by total tasks in the year, not an average of the monthly percentages.</p>
      </section>
      <section class="card">
        <div class="card-head"><h2>Month by month</h2></div>
        <ul class="month-rows">
          ${d.months.map((m) => `
            <li>
              <span class="mr-name">${MONTH_NAMES[m.month - 1]}</span>
              <div class="bar"><div class="bar-fill" style="width:${m.progress}%"></div></div>
              <span class="mr-pct">${m.total ? m.progress + '%' : '–'}</span>
              <span class="mr-count muted">${m.total ? `${m.completed}/${m.total}` : ''}</span>
            </li>`).join('')}
        </ul>
      </section>`;

    redraw = () => {
      applyChartDefaults();
      chart = new Chart(el('mainChart'), {
        type: 'bar',
        data: {
          labels: MONTH_NAMES.map((m) => m.slice(0, 3)),
          datasets: [{ data: d.months.map((m) => m.progress), backgroundColor: cssVar('--accent'), borderRadius: 6, maxBarThickness: 36 }],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => MONTH_NAMES[items[0].dataIndex] + ' ' + d.year,
                label: (item) => { const m = d.months[item.dataIndex]; return m.total ? `${m.progress}% (${m.completed}/${m.total} completed)` : 'No tasks'; },
              },
            },
          },
          scales: {
            y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + '%' }, grid: { color: cssVar('--border') } },
            x: { grid: { display: false } },
          },
        },
      });
    };
    redraw();
  }

  /* ----- Controls ----- */
  function step(delta) {
    if (state.view === 'month') {
      state.month += delta;
      if (state.month < 1) { state.month = 12; state.year--; }
      if (state.month > 12) { state.month = 1; state.year++; }
    } else {
      state.year += delta;
    }
    state.year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, state.year));
    load();
  }
  el('prevPeriod').addEventListener('click', () => step(-1));
  el('nextPeriod').addEventListener('click', () => step(1));
  el('monthSelect').addEventListener('change', (e) => { state.month = Number(e.target.value); load(); });
  el('yearSelect').addEventListener('change', (e) => { state.year = Number(e.target.value); load(); });
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => { state.view = b.dataset.view; load(); })
  );
  window.addEventListener('themechange', () => {
    if (chart && redraw) { const fn = redraw; chart.destroy(); chart = null; fn(); }
  });

  load();
})();
