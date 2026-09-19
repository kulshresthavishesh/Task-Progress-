// calendar.js - month calendar coloured by daily progress, with a detail panel for the selected day.
(async function () {
  const user = await requireAuth();
  if (!user) return;
  buildShell(user, 'calendar');

  const today = todayStr();
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12
  let selected = today;
  let days = {}; // { 'YYYY-MM-DD': { total, completed, progress } } for the visible month
  let requestId = 0; // ignore out-of-date responses when the user clicks quickly

  el('prevMonth').innerHTML = icon('left');
  el('nextMonth').innerHTML = icon('right');

  /* ----- Grid ----- */
  async function loadMonth() {
    const id = ++requestId;
    el('monthLabel').textContent = `${MONTH_NAMES[month - 1]} ${year}`;
    try {
      const data = await api(`/analytics/month/${year}/${month}`);
      if (id !== requestId) return;
      days = {};
      data.days.forEach((d) => (days[d.date] = d));
      renderGrid();
    } catch (err) {
      if (id !== requestId) return;
      el('calGrid').innerHTML = `<div style="grid-column:1/-1">${emptyState("We couldn't load this month", err.message)}</div>`;
    }
  }

  function renderGrid() {
    const firstDay = new Date(year, month - 1, 1);
    const offset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const count = new Date(year, month, 0).getDate();
    let html = '<span class="cal-blank"></span>'.repeat(offset);

    for (let d = 1; d <= count; d++) {
      const date = `${year}-${pad(month)}-${pad(d)}`;
      const info = days[date];
      const has = info && info.total > 0;
      const future = date > today;
      const label = has ? (future ? plural(info.total, 'task') : info.progress + '%') : '';
      const aria = `${formatDate(date)}${has ? `, ${info.completed} of ${info.total} tasks completed` : ', no tasks'}`;
      html += `<button type="button" class="cal-day${has ? ' has' : ''}${date === today ? ' today' : ''}${date === selected ? ' selected' : ''}"
        data-date="${date}" style="--p:${has && !future ? info.progress : 0}" aria-label="${aria}" aria-pressed="${date === selected}">
        <span class="d">${d}</span><span class="p">${label}</span></button>`;
    }
    el('calGrid').innerHTML = html;
  }

  el('calGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.cal-day');
    if (!btn) return;
    selectDate(btn.dataset.date);
    if (window.matchMedia('(max-width: 1080px)').matches) el('dayPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function changeMonth(delta) {
    month += delta;
    if (month < 1) { month = 12; year--; }
    if (month > 12) { month = 1; year++; }
    if (year < 2000 || year > 2100) { year = Math.min(2100, Math.max(2000, year)); return; }
    // Keep the panel useful: jump to today if it is in this month, otherwise the 1st.
    const first = `${year}-${pad(month)}-01`;
    selectDate(today.slice(0, 7) === first.slice(0, 7) ? today : first);
    loadMonth();
  }
  el('prevMonth').addEventListener('click', () => changeMonth(-1));
  el('nextMonth').addEventListener('click', () => changeMonth(1));
  el('thisMonth').addEventListener('click', () => {
    year = now.getFullYear();
    month = now.getMonth() + 1;
    selectDate(today);
    loadMonth();
  });

  /* ----- Day panel ----- */
  function updatePanel(tasks) {
    const s = summarize(tasks);
    el('dayPercent').textContent = s.progress + '%';
    el('dayCount').textContent = `${s.completed} / ${s.total} completed`;
    el('dayBar').style.width = s.progress + '%';

    // Keep the calendar cell in step with the list without waiting for the server.
    if (selected.slice(0, 7) === `${year}-${pad(month)}`) {
      days[selected] = { date: selected, total: s.total, completed: s.completed, progress: s.progress };
      renderGrid();
    }
  }

  const list = mountTaskList(el('dayList'), {
    date: selected,
    emptyTitle: (d) => (d === today ? 'No tasks for today.' : 'No tasks on this day.'),
    emptyText: (d) => (d === today ? 'Add your first task and start tracking your progress.' : d > today ? 'Add a task to plan ahead.' : 'Nothing was planned for this day.'),
    onChange: updatePanel,
    onSynced: loadMonth, // an edit may have moved a task to another day, so reload the month
  });

  function selectDate(date) {
    selected = date;
    el('dayWeekday').textContent = formatDate(date, { weekday: 'long' });
    el('dayTitle').textContent = formatDate(date);
    renderGrid();
    list.load(date);
  }

  el('addTaskBtn').addEventListener('click', () => list.openAdd());

  selectDate(today);
  loadMonth();
})();
