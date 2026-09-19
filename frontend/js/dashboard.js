// dashboard.js - today's progress, streak, task list and the 7-day chart.
(async function () {
  const user = await requireAuth();
  if (!user) return;
  buildShell(user, 'dashboard');

  const today = todayStr();
  const RING_LENGTH = 326.73; // circumference of the SVG ring (2 * PI * 52)
  let weekData = {}; // { 'YYYY-MM-DD': { total, completed, progress } } for the last 7 days
  let weekChart = null;

  el('greeting').textContent = `${greeting()}, ${user.name.split(' ')[0]}`;
  el('todayDate').textContent = formatDate(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  el('statDate').textContent = formatDate(today, { weekday: 'short', month: 'short', day: 'numeric' });

  /* ----- Today's numbers (called instantly whenever a task changes) ----- */
  function updateSummary(tasks) {
    const s = summarize(tasks);

    el('percent').textContent = s.progress;
    const ring = el('ringFg');
    ring.style.strokeDashoffset = RING_LENGTH * (1 - s.progress / 100);
    ring.classList.toggle('zero', s.progress === 0);

    el('heroDone').textContent = s.completed;
    el('heroTotal').textContent = s.total;
    el('heroBar').style.width = s.progress + '%';
    el('heroBarWrap').setAttribute('aria-valuenow', s.progress);
    el('heroMsg').textContent =
      s.total === 0 ? 'Nothing planned yet. Add a task to begin.'
      : s.remaining === 0 ? 'Everything is done. Nice work today.'
      : `${plural(s.remaining, 'task')} left to reach 100%.`;

    el('statTotal').textContent = s.total;
    el('statDone').textContent = s.completed;
    el('statLeft').textContent = s.remaining;

    weekData[today] = { total: s.total, completed: s.completed, progress: s.progress };
    drawWeekChart();
  }

  /* ----- Streak ----- */
  async function loadStreak() {
    try {
      const s = await api('/analytics/streak?today=' + today);
      el('statStreak').textContent = plural(s.currentStreak, 'day') + (s.currentStreak > 0 ? ' 🔥' : '');
      el('statLongest').textContent = 'Longest: ' + plural(s.longestStreak, 'day');
    } catch (err) {
      el('statLongest').textContent = 'Could not load streak';
    }
  }

  /* ----- Last 7 days chart ----- */
  async function loadWeek() {
    const dates = [];
    for (let i = 6; i >= 0; i--) dates.push(shiftDate(today, -i));

    // The 7 days can span two months, so fetch each month once.
    const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
    try {
      const results = await Promise.all(months.map((m) => api(`/analytics/month/${Number(m.slice(0, 4))}/${Number(m.slice(5, 7))}`)));
      const saved = weekData[today]; // keep the live value for today if the task list loaded first
      weekData = {};
      results.forEach((r) => r.days.forEach((d) => (weekData[d.date] = d)));
      if (saved) weekData[today] = saved;
      drawWeekChart();
    } catch (err) {
      el('weekBody').innerHTML = emptyState("We couldn't load your history", err.message);
    }
  }

  function drawWeekChart() {
    const body = el('weekBody');
    if (!body || !window.Chart) return;
    const dates = [];
    for (let i = 6; i >= 0; i--) dates.push(shiftDate(today, -i));
    const hasData = dates.some((d) => weekData[d] && weekData[d].total > 0);

    if (!hasData) {
      if (weekChart) { weekChart.destroy(); weekChart = null; }
      body.innerHTML = emptyState('No history yet', 'Complete some tasks to start building your progress history.');
      return;
    }
    if (!el('weekChart')) body.innerHTML = '<div class="chart-box"><canvas id="weekChart"></canvas></div>';

    applyChartDefaults();
    const values = dates.map((d) => (weekData[d] ? weekData[d].progress : 0));
    const colors = dates.map((d) => (d === today ? cssVar('--accent') : cssVar('--accent-muted')));
    const labels = dates.map((d) => formatDate(d, { weekday: 'short' }));

    if (weekChart) {
      weekChart.data.labels = labels;
      weekChart.data.datasets[0].data = values;
      weekChart.data.datasets[0].backgroundColor = colors;
      weekChart.update();
      return;
    }
    weekChart = new Chart(el('weekChart'), {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, maxBarThickness: 30 }] },
      options: {
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => formatDate(dates[items[0].dataIndex], { weekday: 'long', month: 'short', day: 'numeric' }),
              label: (item) => {
                const d = weekData[dates[item.dataIndex]];
                return d && d.total ? `${d.progress}% (${d.completed}/${d.total} completed)` : 'No tasks';
              },
            },
          },
        },
        scales: {
          y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + '%' }, grid: { color: cssVar('--border') } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  // Recreate the chart with new colours when the theme changes.
  window.addEventListener('themechange', () => {
    if (weekChart) { weekChart.destroy(); weekChart = null; }
    drawWeekChart();
  });

  /* ----- Task list ----- */
  const list = mountTaskList(el('taskList'), {
    date: today,
    emptyTitle: 'No tasks for today.',
    emptyText: 'Add your first task and start tracking your progress.',
    onChange: updateSummary,
    onSynced: loadStreak, // the server confirmed a change, so the streak may have changed
  });
  el('addTaskBtn').addEventListener('click', () => list.openAdd());

  list.load();
  loadWeek();
})();
