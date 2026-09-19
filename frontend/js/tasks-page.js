// tasks-page.js - manage the tasks of any single day (past, today or future).
(async function () {
  const user = await requireAuth();
  if (!user) return;
  buildShell(user, 'tasks');

  const today = todayStr();
  let date = today;

  el('prevDay').innerHTML = icon('left');
  el('nextDay').innerHTML = icon('right');

  function updateSummary(tasks) {
    const s = summarize(tasks);
    el('sumPct').textContent = s.progress + '%';
    el('sumText').textContent = `${s.completed} / ${s.total} completed`;
    el('sumBar').style.width = s.progress + '%';
  }

  const list = mountTaskList(el('taskList'), {
    date,
    emptyTitle: (d) => (d === today ? 'No tasks for today.' : `No tasks for ${formatDate(d, { month: 'long', day: 'numeric' })}.`),
    emptyText: (d) => (d === today ? 'Add your first task and start tracking your progress.' : 'Add a task to plan this day.'),
    onChange: updateSummary,
  });

  function setDate(newDate) {
    date = newDate;
    el('dateInput').value = date;
    el('dateLabel').textContent = formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    el('listTitle').textContent = date === today ? "Today's tasks" : date > today ? 'Planned tasks' : 'Tasks';
    list.load(date);
  }

  el('prevDay').addEventListener('click', () => setDate(shiftDate(date, -1)));
  el('nextDay').addEventListener('click', () => setDate(shiftDate(date, 1)));
  el('todayBtn').addEventListener('click', () => setDate(today));
  el('dateInput').addEventListener('change', (e) => { if (e.target.value) setDate(e.target.value); });
  el('addTaskBtn').addEventListener('click', () => list.openAdd());

  setDate(today);
})();
