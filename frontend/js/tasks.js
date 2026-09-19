// tasks.js - reusable task UI used by the Dashboard, Tasks and Calendar pages:
//   mountTaskList(container, options)  -> renders one day's tasks, handles check / edit / delete
//   openTaskModal(options)             -> the add / edit form

const CATEGORIES = ['Study', 'Coding', 'Fitness', 'Personal', 'Work', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];

function summarize(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return { total, completed, remaining: total - completed, progress: percent(completed, total) };
}

function taskItemHTML(task) {
  return `
    <li class="task${task.completed ? ' done' : ''}" data-id="${task._id}">
      <label class="check">
        <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark &quot;${escapeHtml(task.title)}&quot; as completed">
        <span class="box">${icon('check', 15)}</span>
      </label>
      <div class="task-body">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-meta">
          <span class="tag">${escapeHtml(task.category)}</span>
          <span class="prio prio-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" class="icon-btn" data-action="edit" aria-label="Edit task" title="Edit">${icon('edit')}</button>
        <button type="button" class="icon-btn danger" data-action="delete" aria-label="Delete task" title="Delete">${icon('trash')}</button>
      </div>
    </li>`;
}

/*
  options:
    date         - the day to show ("YYYY-MM-DD")
    emptyTitle / emptyText - string or function(date) for the empty state
    onChange(tasks)  - called immediately when the list changes (update numbers on screen)
    onSynced(tasks)  - called after the server has confirmed a change (refresh streaks, charts...)
*/
function mountTaskList(container, options) {
  let date = options.date;
  let tasks = [];
  const busy = new Set(); // task ids with a request in flight

  const text = (v) => (typeof v === 'function' ? v(date) : v);

  function render() {
    if (tasks.length === 0) {
      container.innerHTML = emptyState(text(options.emptyTitle) || 'No tasks yet.', text(options.emptyText) || 'Add a task to get started.');
      return;
    }
    container.innerHTML = `<ul class="task-list">${tasks.map(taskItemHTML).join('')}</ul>`;
  }

  function notify(kind) {
    if (kind === 'synced') { if (options.onSynced) options.onSynced(tasks); }
    else if (options.onChange) options.onChange(tasks);
  }

  // load(newDate) = navigating to another day. load() = reloading after a change (also fires onSynced).
  async function load(newDate) {
    const navigating = Boolean(newDate);
    if (newDate) date = newDate;
    container.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const data = await api('/tasks/' + date);
      tasks = data.tasks;
      render();
      notify('change');
      if (!navigating) notify('synced');
    } catch (err) {
      container.innerHTML = emptyState("We couldn't load your tasks", err.message);
    }
  }

  // Check / uncheck: update the screen first, then save. Roll back if the save fails.
  container.addEventListener('change', async (e) => {
    const box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    const li = box.closest('.task');
    const task = tasks.find((t) => t._id === li.dataset.id);
    if (!task) return;
    if (busy.has(task._id)) { box.checked = task.completed; return; }

    busy.add(task._id);
    const wanted = box.checked;
    task.completed = wanted;
    li.classList.toggle('done', wanted);
    notify('change');

    try {
      const data = await api(`/tasks/${task._id}/toggle`, { method: 'PATCH', body: { completed: wanted } });
      task.completed = data.task.completed;
      notify('synced');
    } catch (err) {
      task.completed = !wanted;
      box.checked = !wanted;
      li.classList.toggle('done', !wanted);
      notify('change');
      toast(err.message, 'error');
    } finally {
      busy.delete(task._id);
    }
  });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const li = btn.closest('.task');
    const task = tasks.find((t) => t._id === li.dataset.id);
    if (!task) return;

    if (btn.dataset.action === 'edit') {
      openTaskModal({
        task,
        onSaved: (saved) => {
          if (saved.date !== date) toast(`Task moved to ${formatDate(saved.date, { month: 'short', day: 'numeric' })}.`, 'success');
          else toast('Task updated.', 'success');
          load();
        },
      });
    }

    if (btn.dataset.action === 'delete') {
      const ok = await confirmDialog({ title: 'Delete this task?', message: `"${task.title}" will be removed permanently.` });
      if (!ok) return;
      try {
        await api('/tasks/' + task._id, { method: 'DELETE' });
        tasks = tasks.filter((t) => t._id !== task._id);
        render();
        notify('change');
        notify('synced');
        toast('Task deleted.', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });

  return {
    load,
    getDate: () => date,
    getTasks: () => tasks,
    openAdd() {
      openTaskModal({
        date,
        onSaved: (saved) => {
          if (saved.date === date) toast('Task added.', 'success');
          else toast(`Task added for ${formatDate(saved.date, { month: 'short', day: 'numeric' })}.`, 'success');
          load();
        },
      });
    },
  };
}

// Add / edit dialog. Pass `task` to edit, otherwise it creates a task for `date`.
function openTaskModal({ task = null, date = todayStr(), onSaved }) {
  const isEdit = Boolean(task);
  const cur = task || { title: '', category: 'Other', priority: 'Medium', date };

  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <form novalidate>
      <div class="modal-body">
        <h2>${isEdit ? 'Edit task' : 'Add task'}</h2>
        <label class="field"><span>Task name</span>
          <input name="title" maxlength="200" autocomplete="off" required value="${escapeHtml(cur.title)}" placeholder="e.g. Solve two LeetCode problems">
        </label>
        <div class="field-row">
          <label class="field"><span>Category</span>
            <select name="category">${CATEGORIES.map((c) => `<option${c === cur.category ? ' selected' : ''}>${c}</option>`).join('')}</select>
          </label>
          <label class="field"><span>Date</span>
            <input type="date" name="date" required value="${cur.date}">
          </label>
        </div>
        <fieldset class="field"><legend>Priority</legend>
          <div class="seg">${PRIORITIES.map((p) => `<label><input type="radio" name="priority" value="${p}"${p === cur.priority ? ' checked' : ''}><span>${p}</span></label>`).join('')}</div>
        </fieldset>
        <p class="form-error" role="alert" hidden></p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button type="submit" class="btn primary">${isEdit ? 'Save changes' : 'Add task'}</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);

  const form = dlg.querySelector('form');
  const errorBox = dlg.querySelector('.form-error');
  const submitBtn = dlg.querySelector('[type="submit"]');
  const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };

  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    const body = {
      title: form.elements.title.value.trim(),
      category: form.elements.category.value,
      priority: form.elements.priority.value,
      date: form.elements.date.value,
    };
    if (!body.title) return showError('Task name cannot be empty.');
    if (!body.date) return showError('Please choose a date.');

    submitBtn.disabled = true;
    try {
      const data = isEdit
        ? await api('/tasks/' + task._id, { method: 'PUT', body })
        : await api('/tasks', { method: 'POST', body });
      dlg.close();
      if (onSaved) onSaved(data.task);
    } catch (err) {
      showError(err.message);
      submitBtn.disabled = false;
    }
  });

  dlg.showModal();
  form.elements.title.focus();
}
