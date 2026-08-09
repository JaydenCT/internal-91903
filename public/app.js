document.addEventListener('DOMContentLoaded', () => {
  const timetableTableBody = document.querySelector('#timetable-table tbody');
  const subjectSelect = document.getElementById('task-subject');
  const lessonSelect = document.getElementById('task-lesson');
  const taskForm = document.getElementById('task-form');
  const taskList = document.getElementById('task-list');
  const cancelEditButton = document.getElementById('cancel-edit');
  const saveTaskButton = document.getElementById('save-task');
  const autoLessonNote = document.getElementById('auto-lesson-note');
  const taskSearch = document.getElementById('task-search');
  const taskStats = document.getElementById('task-stats');
  const taskSummary = document.getElementById('task-summary');
  const clearCompletedButton = document.getElementById('clear-completed');
  const emptyState = document.getElementById('empty-state');
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const taskPriority = document.getElementById('task-priority');
  const taskDueDate = document.getElementById('task-due-date');
  const taskDueTime = document.getElementById('task-due-time');
  const taskSortSelect = document.getElementById('task-sort');
  const taskFilterButtons = Array.from(document.querySelectorAll('#tasks .filter-chip'));

  // Calendar elements
  const calendarMonthLabel = document.getElementById('calendar-month');
  const calendarGrid = document.getElementById('calendar-grid');
  const prevMonthButton = document.getElementById('prev-month');
  const nextMonthButton = document.getElementById('next-month');
  const calendarEventForm = document.getElementById('calendar-event-form');
  const calendarEventTitle = document.getElementById('calendar-event-title');
  const calendarEventDate = document.getElementById('calendar-event-date');
  const calendarEventDesc = document.getElementById('calendar-event-desc');
  const calendarEventList = document.getElementById('calendar-event-list');
  const calendarSelectedDayLabel = document.getElementById('calendar-selected-day');
  const calendarDayNote = document.getElementById('calendar-day-note');
  const calendarTodayButton = document.getElementById('calendar-today');
  const heroNextLesson = document.getElementById('hero-next-lesson');
  const heroNextEvent = document.getElementById('hero-next-event');
  const heroEventCount = document.getElementById('hero-event-count');
  const heroCompletedToday = document.getElementById('hero-completed-today');
  const heroStreak = document.getElementById('hero-streak');
  const heroTasksDueSoon = document.getElementById('hero-tasks-due-soon');
  const heroProgressRing = document.getElementById('hero-progress-ring');
  const heroProgressPercent = document.getElementById('hero-progress-percent');
  const heroProgressLabel = document.getElementById('hero-progress-label');

  let currentCalendarDate = new Date();
  let calendarSelectedDate = new Date();
  let calendarEvents = [];
  const pageHasTimetable = Boolean(timetableTableBody);
  const pageHasTasks = Boolean(taskForm && taskList && taskSearch && taskStats && taskSummary);
  const pageHasCalendar = Boolean(calendarGrid && calendarEventForm && calendarEventList && calendarSelectedDayLabel && calendarDayNote);
  const pageHasHero = Boolean(heroNextLesson || heroNextEvent || heroTasksDueSoon || heroProgressRing);
  const scrollToTasksButton = document.getElementById('scroll-to-tasks');
  const highlightNextLessonButton = document.getElementById('highlight-next-lesson');
  const shuffleTipButton = document.getElementById('shuffle-tip');
  const studyTipElement = document.getElementById('study-tip');

  if (cancelEditButton) {
    cancelEditButton.addEventListener('click', resetForm);
  }
  let allTasks = [];
  let currentFilter = 'all';
  let timetableRows = [];
  let timetableData = [];
  let viewMode = 'week'; // 'week' or 'day'
  let editingTaskId = null;
  let tipIndex = 0;
  let activeLessonIndex = -1;
  let previousActiveLessonIndex = -1;
  const studyTips = [
    'Start with the hardest task first to build momentum.',
    'Use short focus sprints to keep your energy high.',
    'Check your next lesson before you start studying.',
    'Keep one task visible at a time to avoid overload.'
  ];

  async function fetchCalendarEvents() {
    try {
      const response = await fetch('/api/calendar');
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      return [];
    }
  }

  async function createCalendarEvent(eventPayload) {
    const response = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload)
    });
    return response.ok ? await response.json() : null;
  }

  async function deleteCalendarEvent(eventId) {
    await fetch(`/api/calendar/${eventId}`, { method: 'DELETE' });
  }

  function formatCalendarMonth(date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function isSameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function renderSelectedDayInfo() {
    if (!calendarSelectedDayLabel || !calendarDayNote || !calendarEventList) return;
    const selectedDate = calendarSelectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    calendarSelectedDayLabel.textContent = selectedDate;
    const eventsForDay = calendarEvents.filter(event => event.date === calendarSelectedDate.toISOString().slice(0, 10));
    if (eventsForDay.length === 0) {
      calendarDayNote.textContent = 'No events yet for this date. Add one to keep track of the important stuff.';
      calendarEventList.innerHTML = '';
      return;
    }
    calendarDayNote.textContent = `${eventsForDay.length} event${eventsForDay.length === 1 ? '' : 's'} scheduled for this date.`;
    calendarEventList.innerHTML = eventsForDay.map(event => `
      <li class="event-item">
        <div>
          <strong>${event.title}</strong>
          <p>${event.description || 'No description provided.'}</p>
        </div>
        <button type="button" class="event-delete-button" data-event-id="${event.id}">Remove</button>
      </li>
    `).join('');

    calendarEventList.querySelectorAll('.event-delete-button').forEach(button => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.eventId);
        await deleteCalendarEvent(id);
        calendarEvents = await fetchCalendarEvents();
        renderCalendar();
      });
    });
  }

  function getNextDashboardLesson() {
    if (!timetableData || timetableData.length === 0) return 'No lessons available.';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let currentLesson = null;
    let nextLesson = null;
    for (const row of timetableData) {
      if (!row.time) continue;
      const parts = row.time.split(' - ');
      if (parts.length !== 2) continue;
      const [sh, sm] = parts[0].split(':').map(Number);
      const [eh, em] = parts[1].split(':').map(Number);
      const start = timeToMinutes(sh, sm);
      const end = timeToMinutes(eh, em);
      if (currentMinutes >= start && currentMinutes < end) {
        currentLesson = row;
        break;
      }
      if (currentMinutes < start && !nextLesson) {
        nextLesson = row;
      }
    }
    if (currentLesson) {
      return `Now: ${currentLesson.lesson} • ${currentLesson.time}`;
    }
    if (nextLesson) {
      return `Next: ${nextLesson.lesson} • ${nextLesson.time}`;
    }
    return 'No more lessons today.';
  }

  function getDayKey(date = new Date()) {
    const idx = date.getDay();
    const map = {1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'};
    return map[idx] || 'mon';
  }

  function getLessonSubject(row, date = new Date()) {
    const dayKey = getDayKey(date);
    return (row.days && row.days[dayKey]) ? row.days[dayKey] : `Lesson ${row.lesson}`;
  }

  function getNextDashboardEvent() {
    const todayKey = new Date().toISOString().slice(0, 10);
    const upcomingEvents = [...calendarEvents].filter(event => event.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date));
    if (upcomingEvents.length === 0) return 'No events scheduled.';
    const nextEvent = upcomingEvents[0];
    return `${nextEvent.title} • ${formatDueDate(nextEvent.date)}`;
  }

  function getEventCountText() {
    if (!calendarEvents) return 'Loading events…';
    const todayKey = new Date().toISOString().slice(0, 10);
    const upcoming = calendarEvents.filter(event => event.date >= todayKey).length;
    return upcoming > 0 ? `${upcoming} upcoming event${upcoming === 1 ? '' : 's'}` : 'No upcoming events';
  }

  function getTasksDueSoon() {
    if (!allTasks) return 'Loading tasks…';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueToday = allTasks.filter(task => !task.completed && task.dueDate && new Date(`${task.dueDate}T00:00:00`).getTime() === today.getTime()).length;
    const dueSoon = allTasks.filter(task => {
      if (task.completed || !task.dueDate) return false;
      const due = new Date(`${task.dueDate}T00:00:00`);
      const diffDays = Math.round((due - today) / 86400000);
      return diffDays > 0 && diffDays <= 3;
    }).length;
    if (dueToday > 0) return `${dueToday} task${dueToday === 1 ? '' : 's'} due today`;
    if (dueSoon > 0) return `${dueSoon} due soon`;
    return 'No tasks due soon.';
  }

  function getTaskProgress() {
    if (!allTasks || allTasks.length === 0) return { percent: 0, label: 'No tasks yet.' };
    const completedCount = allTasks.filter(task => task.completed).length;
    const percent = Math.round((completedCount / allTasks.length) * 100);
    return { percent, label: `${completedCount}/${allTasks.length} complete` };
  }

  function getCompletedToday() {
    if (!allTasks) return 0;
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    return allTasks.filter(task => task.completed && task.completedAt && task.completedAt.slice(0, 10) === todayKey).length;
  }

  function getStudyStreak() {
    if (!allTasks || allTasks.length === 0) return 0;
    const completedDays = new Set(allTasks
      .filter(task => task.completed && task.completedAt)
      .map(task => task.completedAt.slice(0, 10)));

    let streak = 0;
    const current = new Date();
    current.setHours(0, 0, 0, 0);

    while (true) {
      const key = current.toISOString().slice(0, 10);
      if (!completedDays.has(key)) break;
      streak += 1;
      current.setDate(current.getDate() - 1);
    }

    return streak;
  }

  function updateTaskProgress() {
    const { percent, label } = getTaskProgress();
    if (heroProgressPercent) heroProgressPercent.textContent = `${percent}%`;
    if (heroProgressLabel) heroProgressLabel.textContent = label;
    if (heroProgressRing) {
      heroProgressRing.style.background = `conic-gradient(var(--accent) ${percent}%, rgba(79, 70, 229, 0.12) ${percent}% 100%)`;
    }
  }

  function getNextDashboardLesson() {
    if (!timetableData || timetableData.length === 0) return 'No lessons available.';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let currentLesson = null;
    let nextLesson = null;
    for (const row of timetableData) {
      if (!row.time) continue;
      const parts = row.time.split(' - ');
      if (parts.length !== 2) continue;
      const [sh, sm] = parts[0].split(':').map(Number);
      const [eh, em] = parts[1].split(':').map(Number);
      const start = timeToMinutes(sh, sm);
      const end = timeToMinutes(eh, em);
      if (currentMinutes >= start && currentMinutes < end) {
        currentLesson = row;
        break;
      }
      if (currentMinutes < start && !nextLesson) {
        nextLesson = row;
      }
    }
    if (currentLesson) {
      return `Now: ${getLessonSubject(currentLesson)} • ${currentLesson.time}`;
    }
    if (nextLesson) {
      return `Next: ${getLessonSubject(nextLesson)} • ${nextLesson.time}`;
    }
    return 'No more lessons today.';
  }

  function updateHeroSummary() {
    if (heroNextLesson) heroNextLesson.textContent = getNextDashboardLesson();
    if (heroNextEvent) heroNextEvent.textContent = getNextDashboardEvent();
    if (heroEventCount) heroEventCount.textContent = getEventCountText();
    if (heroCompletedToday) heroCompletedToday.textContent = `${getCompletedToday()} completed`;
    if (heroStreak) heroStreak.textContent = `${getStudyStreak()} days`;
    if (heroTasksDueSoon) heroTasksDueSoon.textContent = getTasksDueSoon();
    updateTaskProgress();
  }

  function renderCalendar() {
    if (!pageHasCalendar) return;
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    if (calendarMonthLabel) calendarMonthLabel.textContent = formatCalendarMonth(currentCalendarDate);
    calendarGrid.innerHTML = '';

    const firstOfMonth = new Date(year, month, 1);
    const startWeekDay = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    weekDayNames.forEach(name => {
      const heading = document.createElement('div');
      heading.className = 'calendar-day-label';
      heading.textContent = name;
      calendarGrid.appendChild(heading);
    });

    for (let i = 0; i < startWeekDay; i += 1) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-day empty';
      calendarGrid.appendChild(emptyCell);
    }

    for (let dayIndex = 1; dayIndex <= daysInMonth; dayIndex += 1) {
      const date = new Date(year, month, dayIndex);
      const dateKey = date.toISOString().slice(0, 10);
      const eventsForDay = calendarEvents.filter(event => event.date === dateKey);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day';
      if (isSameDay(date, new Date())) cell.classList.add('today');
      if (isSameDay(date, calendarSelectedDate)) cell.classList.add('selected');
      cell.innerHTML = `
        <span class="day-number">${dayIndex}</span>
        ${eventsForDay.length > 0 ? '<span class="calendar-event-dot"></span>' : ''}
      `;
      cell.addEventListener('click', () => {
        calendarSelectedDate = date;
        renderCalendar();
        renderSelectedDayInfo();
      });
      calendarGrid.appendChild(cell);
    }

    renderSelectedDayInfo();
    updateHeroSummary();
  }

  function changeCalendarMonth(delta) {
    currentCalendarDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + delta, 1);
    renderCalendar();
  }

  async function addCalendarEvent(event) {
    event.preventDefault();
    if (!calendarEventTitle || !calendarEventDate || !calendarEventDesc) return;
    const title = calendarEventTitle.value.trim();
    const date = calendarEventDate.value;
    const description = calendarEventDesc.value.trim();
    if (!title || !date) return;
    const created = await createCalendarEvent({ title, date, description });
    if (!created) return;
    calendarEvents = await fetchCalendarEvents();
    renderCalendar();
    calendarEventForm.reset();
    calendarEventDate.value = calendarSelectedDate.toISOString().slice(0, 10);
  }

  async function initializeCalendar() {
    if (!pageHasCalendar) return;
    calendarEvents = await fetchCalendarEvents();
    calendarSelectedDate = new Date();
    if (calendarEventDate) {
      calendarEventDate.value = calendarSelectedDate.toISOString().slice(0, 10);
    }
    renderCalendar();
    if (prevMonthButton) prevMonthButton.addEventListener('click', () => changeCalendarMonth(-1));
    if (nextMonthButton) nextMonthButton.addEventListener('click', () => changeCalendarMonth(1));
    if (calendarEventForm) calendarEventForm.addEventListener('submit', addCalendarEvent);
    if (calendarTodayButton) {
      calendarTodayButton.addEventListener('click', () => {
        currentCalendarDate = new Date();
        calendarSelectedDate = new Date();
        renderCalendar();
        renderSelectedDayInfo();
        updateHeroSummary();
      });
    }
  }

  function fetchTimetable() {
    return fetch('/api/timetable').then(r => r.json());
  }

  function fetchSubjects() {
    return fetch('/api/subjects').then(r => r.json());
  }

  function fetchTasks() {
    return fetch('/api/tasks').then(r => r.json());
  }

  function parseTimeHM(timeStr) {
    if (!timeStr) return null;
    const [h,m] = timeStr.split(':').map(Number);
    return { h, m };
  }

  function timeToMinutes(h,m) { return h*60 + m; }

  function dayKeyFromDateString(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T00:00:00`);
    const idx = d.getDay(); // 0 Sun .. 6 Sat
    const map = {1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'};
    return map[idx] || 'mon';
  }

  function findLessonByTimeOnDay(dateStr, timeStr) {
    if (!timeStr) return null;
    const t = parseTimeHM(timeStr);
    if (!t) return null;
    const minutes = timeToMinutes(t.h, t.m);
    const dayKey = dayKeyFromDateString(dateStr) || 'mon';
    if (!timetableData.length) return null;

    let best = null;
    let bestDiff = Infinity;

    for (const row of timetableData) {
      if (!row.time) continue;
      const parts = row.time.split(' - ');
      if (parts.length !== 2) continue;
      const [sh,sm] = parts[0].split(':').map(Number);
      const [eh,em] = parts[1].split(':').map(Number);
      const start = timeToMinutes(sh,sm);
      const end = timeToMinutes(eh,em);
      if (minutes >= start && minutes < end) {
        return row.lesson;
      }
      const diff = minutes < start ? start - minutes : minutes - end;
      if (diff < bestDiff) {
        bestDiff = diff;
        best = row.lesson;
      }
    }
    return best !== null ? best : timetableData[0].lesson;
  }

  function getNextLessonIndex(rows) {
    if (!rows || rows.length === 0) return -1;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.time) continue;
      const parts = row.time.split(' - ');
      if (parts.length !== 2) continue;
      const [sh, sm] = parts[0].split(':').map(Number);
      const [eh, em] = parts[1].split(':').map(Number);
      const start = timeToMinutes(sh, sm);
      const end = timeToMinutes(eh, em);
      if (currentMinutes >= start && currentMinutes < end) {
        return i;
      }
    }
    return -1;
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('study-theme', nextTheme);
    applyTheme(nextTheme);
  }

  function renderTimetable(rows) {
    if (!timetableTableBody) return;
    timetableRows = rows;
    timetableData = rows;
    const thead = document.querySelector('#timetable-table thead');
    const headerRow = document.createElement('tr');
    if (viewMode === 'week') {
      headerRow.innerHTML = '<th>Lesson</th><th>Time</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th>';
    } else {
      headerRow.innerHTML = '<th>Lesson</th><th>Time</th><th>Subject</th>';
    }
    thead.innerHTML = '';
    thead.appendChild(headerRow);

    const dayOrder = ['mon','tue','wed','thu','fri'];
    function getSelectedDayKey() {
      const idx = new Date().getDay() - 1; // 0..4 for Mon..Fri
      return (idx >=0 && idx < 5) ? dayOrder[idx] : dayOrder[0];
    }
    const selectedDay = getSelectedDayKey();

    timetableTableBody.innerHTML = '';
    const newActiveIndex = getNextLessonIndex(rows);
    const activeChanged = newActiveIndex !== activeLessonIndex;
    activeLessonIndex = newActiveIndex;

    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.dataset.lesson = row.lesson;
      if (index === activeLessonIndex) {
        tr.classList.add('current-line');
        if (activeChanged) tr.classList.add('new-current');
      }
      const lessonCell = `<td>${row.lesson}</td>`;
      const timeCell = `<td>${row.time}</td>`;
      if (viewMode === 'week') {
        const dayCells = dayOrder.map(d => {
          const subj = (row.days && row.days[d]) ? row.days[d] : '';
          return `<td class="class-cell" data-lesson="${row.lesson}" data-day="${d}">
            <div class="class-subject">${subj}</div>
            <div class="task-tooltip hidden"></div>
          </td>`;
        }).join('');
        tr.innerHTML = lessonCell + timeCell + dayCells;
      } else {
        const subj = (row.days && row.days[selectedDay]) ? row.days[selectedDay] : '';
        tr.innerHTML = lessonCell + timeCell + `<td class="class-cell" data-lesson="${row.lesson}" data-day="${selectedDay}">
          <div class="class-subject">${subj}</div>
          <div class="task-tooltip hidden"></div>
        </td>`;
      }

      if (index === activeLessonIndex) {
        const currentCell = tr.querySelector(`.class-cell[data-day="${selectedDay}"]`);
        if (currentCell) currentCell.classList.add('current-lesson-cell');
      }

      timetableTableBody.appendChild(tr);
    });

    // attach hover behavior for tooltips (by lesson)
    const classCells = timetableTableBody.querySelectorAll('.class-cell');
    classCells.forEach(cell => {
      const lesson = Number(cell.dataset.lesson);
      const cellDay = cell.dataset.day;
      const tooltip = cell.querySelector('.task-tooltip');
      function refreshTooltip() {
        const tasksForLesson = allTasks.filter(t => {
          const tLessonNum = t.lesson ? Number(t.lesson) : null;
          if (t.dueDate && t.dueTime) {
            const mapped = findLessonByTimeOnDay(t.dueDate, t.dueTime);
            return mapped === lesson && dayKeyFromDateString(t.dueDate) === cellDay;
          }
          if (t.dueDate && tLessonNum !== null) {
            return tLessonNum === lesson && dayKeyFromDateString(t.dueDate) === cellDay;
          }
          return false;
        });
        if (tasksForLesson.length === 0) {
          tooltip.innerHTML = '';
          tooltip.classList.add('hidden');
          return;
        }
        tooltip.innerHTML = tasksForLesson.map(t => `
          <div class="tooltip-task">
            <strong>${t.subject}</strong> <span class="muted">${t.description}</span>
            ${t.dueDate ? `<div class="muted">Due ${formatDueDate(t.dueDate)}${t.dueTime ? ' @ '+t.dueTime : ''}</div>` : ''}
          </div>
        `).join('');
      }
      refreshTooltip();
      cell.addEventListener('mouseenter', () => {
        const has = tooltip.innerHTML.trim().length > 0;
        if (has) tooltip.classList.remove('hidden');
      });
      cell.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
    });
  }

  function renderSubjects(subjects) {
    if (!subjectSelect) return;
    subjectSelect.innerHTML = '';
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      subjectSelect.appendChild(opt);
    });
  }

  function formatDueDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function isOverdue(task) {
    if (!task.dueDate || task.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${task.dueDate}T00:00:00`);
    return due < today;
  }

  function getPriorityLabel(priority) {
    return priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Medium';
  }

  function getPriorityClass(priority) {
    return priority === 'high' ? 'priority-high' : priority === 'low' ? 'priority-low' : 'priority-medium';
  }

  function updateTaskStats(tasks) {
    const completed = tasks.filter(task => task.completed).length;
    const pending = tasks.length - completed;
    taskStats.innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Total</span>
        <strong>${tasks.length}</strong>
      </div>
      <div class="stat-card accent">
        <span class="stat-label">Pending</span>
        <strong>${pending}</strong>
      </div>
      <div class="stat-card success">
        <span class="stat-label">Done</span>
        <strong>${completed}</strong>
      </div>
    `;
  }

  function updateTaskSummary(tasks) {
    const pendingTasks = tasks.filter(task => !task.completed);
    const nextDue = pendingTasks.filter(task => task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const focusText = nextDue
      ? `Next up: ${nextDue.subject} • due ${formatDueDate(nextDue.dueDate)}`
      : 'No due dates yet — add one to stay ahead.';
    taskSummary.innerHTML = `<strong>${pendingTasks.length}</strong> tasks left • ${focusText}`;
  }

  function getVisibleTasks(tasks) {
    const query = taskSearch.value.trim().toLowerCase();
    const filtered = tasks.filter(task => {
      const matchesSearch = !query || `${task.subject} ${task.description} ${task.lesson || ''}`.toLowerCase().includes(query);
      const matchesStatus = currentFilter === 'all' || (currentFilter === 'pending' && !task.completed) || (currentFilter === 'completed' && task.completed);
      return matchesSearch && matchesStatus;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (taskSortSelect.value === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
      }
      if (taskSortSelect.value === 'due') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return sorted;
  }

  function renderTasks(tasks) {
    allTasks = tasks;
    const visibleTasks = getVisibleTasks(tasks);
    taskList.innerHTML = '';
    updateTaskStats(tasks);
    updateTaskSummary(tasks);

    if (visibleTasks.length === 0) {
      emptyState.classList.remove('hidden');
      taskList.classList.add('empty');
      return;
    }

    emptyState.classList.add('hidden');
    taskList.classList.remove('empty');

    visibleTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item${task.completed ? ' completed' : ''}`;

      const main = document.createElement('div');
      main.className = 'task-main';

      const heading = document.createElement('div');
      heading.className = 'task-heading';
      const title = document.createElement('strong');
      title.textContent = task.subject;
      const lessonBadge = document.createElement('span');
      lessonBadge.className = 'pill';
      lessonBadge.textContent = task.lesson ? `Lesson ${task.lesson}` : 'No lesson';
      heading.append(title, lessonBadge);

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const priorityBadge = document.createElement('span');
      priorityBadge.className = `priority-badge ${getPriorityClass(task.priority || 'medium')}`;
      priorityBadge.textContent = getPriorityLabel(task.priority || 'medium');
      meta.appendChild(priorityBadge);

      if (task.dueDate) {
        const dueBadge = document.createElement('span');
        dueBadge.className = `due-badge${isOverdue(task) ? ' overdue' : ''}`;
        dueBadge.textContent = `Due ${formatDueDate(task.dueDate)}${task.dueTime ? ' @ ' + task.dueTime : ''}`;
        meta.appendChild(dueBadge);
      }

      const description = document.createElement('p');
      description.textContent = task.description;
      description.className = 'task-description';

      main.append(heading, meta, description);

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const toggle = document.createElement('button');
      toggle.className = 'task-btn';
      toggle.type = 'button';
      toggle.textContent = task.completed ? 'Undo' : 'Done';
      toggle.addEventListener('click', async () => {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !task.completed })
        });
        loadTasks();
      });

      const edit = document.createElement('button');
      edit.className = 'task-btn';
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => populateTaskForm(task));

      const del = document.createElement('button');
      del.className = 'task-btn danger';
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
        loadTasks();
      });

      actions.append(toggle, edit, del);
      li.append(main, actions);
      taskList.appendChild(li);
    });
    // refresh timetable tooltips when tasks change
    renderTimetable(timetableData);
    updateHeroSummary();
  }

  function populateTaskForm(task) {
    editingTaskId = task.id;
    saveTaskButton.textContent = 'Save Task';
    cancelEditButton.classList.remove('hidden');
    taskDueDate.value = task.dueDate || '';
    taskDueTime.value = task.dueTime || '';
    subjectSelect.value = task.subject;
    lessonSelect.value = task.lesson || '';
    document.getElementById('task-desc').value = task.description;
    taskPriority.value = task.priority || 'medium';
    window.scrollTo({ top: taskForm.offsetTop - 20, behavior: 'smooth' });
  }

  function resetForm() {
    editingTaskId = null;
    saveTaskButton.textContent = 'Add Task';
    cancelEditButton.classList.add('hidden');
    taskForm.reset();
    taskPriority.value = 'medium';
    lessonSelect.value = '';
    if (autoLessonNote) autoLessonNote.textContent = 'Lesson will be chosen automatically based on date and time.';
  }

  async function loadAll() {
    const [tt, subjects, tasks] = await Promise.all([fetchTimetable(), fetchSubjects(), fetchTasks()]);
    if (pageHasTimetable) renderTimetable(tt);
    if (pageHasTasks) {
      renderSubjects(subjects);
      renderTasks(tasks);
    }
    updateHeroSummary();
  }

  // view toggle buttons
  const viewWeekBtn = document.getElementById('view-week');
  const viewDayBtn = document.getElementById('view-day');
  function setView(mode) {
    viewMode = mode;
    viewWeekBtn.classList.toggle('active', mode === 'week');
    viewDayBtn.classList.toggle('active', mode === 'day');
    renderTimetable(timetableData);
  }
  if (viewWeekBtn && viewDayBtn) {
    viewWeekBtn.addEventListener('click', () => setView('week'));
    viewDayBtn.addEventListener('click', () => setView('day'));
  }

  async function loadTasks() {
    const tasks = await fetchTasks();
    renderTasks(tasks);
  }

  function updateAutoLessonNote() {
    const dueDateVal = taskDueDate.value;
    const dueTimeVal = taskDueTime.value;
    if (!dueDateVal || !dueTimeVal) {
      if (autoLessonNote) autoLessonNote.textContent = 'Lesson will be chosen automatically based on date and time.';
      return;
    }
    const lesson = findLessonByTimeOnDay(dueDateVal, dueTimeVal);
    if (autoLessonNote) autoLessonNote.textContent = lesson ? `Auto lesson assigned: Lesson ${lesson}` : 'No matching lesson found yet.';
  }

  if (taskDueDate) taskDueDate.addEventListener('input', updateAutoLessonNote);
  if (taskDueTime) taskDueTime.addEventListener('input', updateAutoLessonNote);

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = subjectSelect.value;
    const dueDateVal = taskDueDate.value;
    const dueTimeVal = taskDueTime.value;
    const description = document.getElementById('task-desc').value.trim();
    if (!subject || !description || !dueDateVal || !dueTimeVal) return;
    const lesson = findLessonByTimeOnDay(dueDateVal, dueTimeVal) || null;
    const existingTask = editingTaskId ? allTasks.find(t => t.id === editingTaskId) : null;
    const payload = {
      subject,
      lesson,
      description,
      completed: existingTask ? existingTask.completed : false,
      priority: taskPriority.value || 'medium',
      dueDate: dueDateVal,
      dueTime: dueTimeVal
    };
    if (editingTaskId) {
      await fetch(`/api/tasks/${editingTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      resetForm();
    } else {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    taskForm.reset();
    if (taskPriority) taskPriority.value = 'medium';
    if (lessonSelect) lessonSelect.value = '';
    if (autoLessonNote) autoLessonNote.textContent = 'Lesson will be chosen automatically based on date and time.';
    const desc = document.getElementById('task-desc');
    if (desc) desc.focus();
    loadTasks();
  });
  }

  if (taskSearch) taskSearch.addEventListener('input', () => renderTasks(allTasks));
  if (taskSortSelect) taskSortSelect.addEventListener('change', () => renderTasks(allTasks));

  taskFilterButtons.forEach(button => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.filter;
      taskFilterButtons.forEach(btn => btn.classList.toggle('active', btn === button));
      renderTasks(allTasks);
    });
  });

  if (clearCompletedButton) {
    clearCompletedButton.addEventListener('click', async () => {
      const completedTasks = allTasks.filter(task => task.completed);
      await Promise.all(completedTasks.map(task => fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })));
      loadTasks();
    });
  }

  if (scrollToTasksButton) {
    scrollToTasksButton.addEventListener('click', () => {
      const tasksSection = document.getElementById('tasks');
      if (tasksSection) tasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (highlightNextLessonButton) {
    highlightNextLessonButton.addEventListener('click', () => {
      const nextRow = timetableTableBody ? timetableTableBody.querySelector('tr.current-line') : null;
      if (nextRow) {
        nextRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  if (shuffleTipButton) {
    shuffleTipButton.addEventListener('click', () => {
      tipIndex = (tipIndex + 1) % studyTips.length;
      if (studyTipElement) studyTipElement.textContent = `Tip: ${studyTips[tipIndex]}`;
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  if (studyTipElement) {
    studyTipElement.textContent = `Tip: ${studyTips[tipIndex]}`;
  }

  const preferredTheme = localStorage.getItem('study-theme') || 'light';
  applyTheme(preferredTheme);

  initializeCalendar();
  loadAll();
  setInterval(() => {
    if (timetableData.length) {
      activeLessonIndex = getNextLessonIndex(timetableData);
      renderTimetable(timetableData);
    }
  }, 60000);
});
