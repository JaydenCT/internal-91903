const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// simple in-memory user store (for demo/dev only)
const users = [];
let nextUserId = 1;

app.locals.siteTitle = 'School Planner';

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session && req.session.userId ? findUserById(req.session.userId) : null;
  next();
});

function findUserById(id) {
  return users.find(u => u.id === id);
}

function findUserByEmail(email) {
  return users.find(u => u.email === email);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  const user = findUserById(req.session.userId);
  if (!user) return res.redirect('/login');
  req.user = user;
  next();
}

function getCurrentDayKey() {
  const idx = new Date().getDay() - 1;
  const dayOrder = ['mon','tue','wed','thu','fri'];
  return (idx >= 0 && idx < dayOrder.length) ? dayOrder[idx] : 'mon';
}

function getCurrentOrNextLesson() {
  const dayKey = getCurrentDayKey();
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let current = null;
  let next = null;
  let nextDiff = Infinity;

  for (const row of timetable) {
    if (!row.days || !row.days[dayKey]) continue;
    const parts = row.time.split(' - ');
    if (parts.length !== 2) continue;
    const [sh, sm] = parts[0].split(':').map(Number);
    const [eh, em] = parts[1].split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (currentMinutes >= start && currentMinutes < end) {
      current = { ...row, subject: row.days[dayKey], status: 'Now' };
      break;
    }
    if (start > currentMinutes && start - currentMinutes < nextDiff) {
      nextDiff = start - currentMinutes;
      next = { ...row, subject: row.days[dayKey], status: 'Next' };
    }
  }

  return current || next || null;
}

function getTaskSummary(userId = null) {
  const userTasks = tasks.filter(task => userOwned(task, userId));
  const total = userTasks.length;
  const completed = userTasks.filter(t => t.completed).length;
  const now = new Date();
  const dueSoon = userTasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const due = new Date(`${t.dueDate}T00:00:00`);
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }).length;
  const overdue = userTasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const due = new Date(`${t.dueDate}T00:00:00`);
    return due < now;
  }).length;
  return { total, completed, pending: total - completed, dueSoon, overdue };
}

function getRecentTasks(userId = null, limit = 5) {
  return [...tasks]
    .filter(task => userOwned(task, userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

function getUserTasks(userId = null) {
  return tasks.filter(task => userOwned(task, userId));
}

function getCompletedTasksForDay(userId = null, date = new Date()) {
  const dayKey = date.toISOString().slice(0, 10);
  return getUserTasks(userId).filter(task => task.completed && task.completedAt && task.completedAt.slice(0, 10) === dayKey);
}

function getStudyStreak(userId = null) {
  const completedDates = new Set(getUserTasks(userId)
    .filter(task => task.completed && task.completedAt)
    .map(task => task.completedAt.slice(0, 10)));

  let streak = 0;
  const current = new Date();
  current.setHours(0, 0, 0, 0);

  while (true) {
    const dayKey = current.toISOString().slice(0, 10);
    if (!completedDates.has(dayKey)) break;
    streak += 1;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function getUpcomingEvents(userId = null) {
  const todayKey = new Date().toISOString().slice(0, 10);
  return calendarEvents.filter(event => userOwned(event, userId) && event.date >= todayKey);
}

function awardBadges(userId = null) {
  const user = findUserById(userId);
  if (!user) return;
  const completed = getUserTasks(userId).filter(task => task.completed).length;
  const streak = getStudyStreak(userId);
  const upcomingEvents = getUpcomingEvents(userId).length;
  const badgeRules = [
    { condition: completed >= 5, name: 'Task Starter' },
    { condition: completed >= 15, name: 'Consistency Champ' },
    { condition: completed >= 30, name: 'Mastermind' },
    { condition: streak >= 3, name: 'Streak Keeper' },
    { condition: streak >= 7, name: 'Study Streaker' },
    { condition: upcomingEvents >= 3, name: 'Event Planner' }
  ];

  badgeRules.forEach(rule => {
    if (rule.condition && !user.badges.includes(rule.name)) {
      user.badges.push(rule.name);
    }
  });
}

app.get('/', (req, res) => {
  const user = req.session.userId ? findUserById(req.session.userId) : null;
  res.render('index', {
    title: 'Home',
    siteTitle: 'School Planner',
    heading: 'Welcome',
    message: 'Your server is running with EJS and Express.',
    user
  });
});

// Auth: register
app.get('/register', (req, res) => {
  const user = req.session.userId ? findUserById(req.session.userId) : null;
  res.render('register', { title: 'Register', siteTitle: 'School Planner', user });
});

app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).send('email and password required');
  if (findUserByEmail(email)) return res.status(400).send('user exists');
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: nextUserId++,
    email,
    passwordHash: hash,
    name: name || '',
    bio: 'Always learning and improving my study routine.',
    learningStyle: 'Balanced',
    themePref: 'System',
    favoriteSubject: '',
    focusGoal: '3 sessions per day',
    accentColor: 'violet',
    badges: ['Rookie Scholar'],
    joinedAt: new Date().toISOString()
  };
  users.push(user);
  req.session.userId = user.id;
  res.redirect('/welcome');
});

// Auth: login
app.get('/login', (req, res) => {
  const user = req.session.userId ? findUserById(req.session.userId) : null;
  res.render('login', { title: 'Login', siteTitle: 'School Planner', user });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user) {
    const cur = req.session.userId ? findUserById(req.session.userId) : null;
    return res.status(401).render('login', { title: 'Login', siteTitle: 'School Planner', error: 'Invalid credentials', user: cur });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const cur = req.session.userId ? findUserById(req.session.userId) : null;
    return res.status(401).render('login', { title: 'Login', siteTitle: 'School Planner', error: 'Invalid credentials', user: cur });
  }
  req.session.userId = user.id;
  res.redirect('/welcome');
});

// Decorated welcome/dashboard for logged in users
app.get('/welcome', requireAuth, (req, res) => {
  res.render('welcome', { title: 'Welcome', user: req.user });
});

app.get('/timetable', requireAuth, (req, res) => {
  res.render('timetable', { title: 'Timetable', siteTitle: 'School Planner', user: req.user });
});

app.get('/tasks', requireAuth, (req, res) => {
  res.render('tasks', { title: 'Tasks', siteTitle: 'School Planner', user: req.user });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Profile (protected)
app.get('/profile', requireAuth, (req, res) => {
  const userId = req.user.id;
  const summary = getTaskSummary(userId);
  const recentTasks = getRecentTasks(userId, 4);
  const nextLesson = getCurrentOrNextLesson();
  const streak = getStudyStreak(userId);
  const upcomingEvents = getUpcomingEvents(userId).length;
  awardBadges(userId);
  res.render('profile', {
    title: 'Profile',
    siteTitle: 'School Planner',
    user: req.user,
    summary,
    recentTasks,
    nextLesson,
    streak,
    upcomingEvents,
    themeOptions: ['System', 'Light', 'Dark'],
    accentOptions: ['violet', 'blue', 'green', 'coral'],
    learningStyles: ['Balanced', 'Focused', 'Creative', 'Review']
  });
});

app.post('/profile', requireAuth, (req, res) => {
  const { name, bio, learningStyle, themePref, favoriteSubject, focusGoal, accentColor } = req.body;
  req.user.name = name || req.user.name;
  req.user.bio = bio || req.user.bio;
  req.user.learningStyle = learningStyle || req.user.learningStyle;
  req.user.themePref = themePref || req.user.themePref;
  req.user.favoriteSubject = favoriteSubject || req.user.favoriteSubject;
  req.user.focusGoal = focusGoal || req.user.focusGoal;
  req.user.accentColor = accentColor || req.user.accentColor || 'violet';

  const userId = req.user.id;
  const summary = getTaskSummary(userId);
  const recentTasks = getRecentTasks(userId, 4);
  const nextLesson = getCurrentOrNextLesson();
  res.render('profile', {
    title: 'Profile',
    siteTitle: 'School Planner',
    user: req.user,
    summary,
    recentTasks,
    nextLesson,
    themeOptions: ['System', 'Light', 'Dark'],
    accentOptions: ['violet', 'blue', 'green', 'coral'],
    learningStyles: ['Balanced', 'Focused', 'Creative', 'Review'],
    message: 'Profile updated successfully'
  });
});

// Timetable and tasks data (in-memory) - supports per-day subjects
// days: { mon, tue, wed, thu, fri }
const timetable = [
  { lesson: 1, time: '09:00 - 10:00', days: { mon: 'English', tue: 'Drama', wed: 'Computing', thu: 'Geography', fri: 'PE' } },
  { lesson: 2, time: '10:00 - 11:00', days: { mon: 'Maths', tue: 'Digital Technologies', wed: 'English', thu: 'Art', fri: 'Science' } },
  { lesson: 3, time: '11:00 - 12:00', days: { mon: 'History', tue: 'PE', wed: 'Music', thu: 'Maths', fri: 'Health' } },
  { lesson: 4, time: '12:00 - 13:00', days: { mon: 'Art', tue: 'Te Reo', wed: 'Science', thu: 'Drama', fri: 'Computing' } },
  { lesson: 5, time: '13:00 - 14:00', days: { mon: 'Science', tue: 'Geography', wed: 'Health', thu: 'Wellbeing', fri: 'Maori' } }
];

const tasks = [];
let nextTaskId = 1;
const calendarEvents = [];
let nextCalendarEventId = 1;

function resetTasks() {
  tasks.length = 0;
  nextTaskId = 1;
}

function currentUserId(req) {
  return req.session && req.session.userId ? req.session.userId : null;
}

function userOwned(item, userId) {
  return userId === null ? !item.userId : item.userId === userId;
}

// API: get timetable
app.get('/api/timetable', (req, res) => {
  res.json(timetable);
});

// API: get subjects
app.get('/api/subjects', (req, res) => {
  const userId = currentUserId(req);
  const set = new Set();
  timetable.forEach(t => {
    Object.values(t.days || {}).forEach(s => { if (s) set.add(s); });
  });
  tasks.filter(task => userOwned(task, userId)).forEach(task => {
    if (task.subject) set.add(task.subject);
  });
  res.json(Array.from(set));
});

// API: tasks CRUD
app.get('/api/tasks', (req, res) => {
  const userId = currentUserId(req);
  res.json(tasks.filter(task => userOwned(task, userId)));
});

app.post('/api/tasks', (req, res) => {
  const userId = currentUserId(req);
  const { subject, description, lesson, completed, priority, dueDate, dueTime } = req.body;
  if (!subject || !description) {
    return res.status(400).json({ error: 'subject and description required' });
  }
  const task = {
    id: nextTaskId++,
    userId,
    subject,
    description,
    lesson: lesson || null,
    completed: Boolean(completed),
    completedAt: Boolean(completed) ? new Date().toISOString() : null,
    priority: priority || 'medium',
    dueDate: dueDate || null,
    dueTime: dueTime || null,
    createdAt: new Date().toISOString()
  };
  tasks.push(task);
  awardBadges(userId);
  res.status(201).json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const userId = currentUserId(req);
  const idx = tasks.findIndex(t => t.id === id && userOwned(t, userId));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  tasks.splice(idx, 1);
  res.status(204).end();
});

app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const userId = currentUserId(req);
  const idx = tasks.findIndex(t => t.id === id && userOwned(t, userId));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const { subject, description, lesson, completed, priority, dueDate, dueTime } = req.body;
  if (subject !== undefined) tasks[idx].subject = subject;
  if (description !== undefined) tasks[idx].description = description;
  if (lesson !== undefined) tasks[idx].lesson = lesson;
  if (completed !== undefined) {
    tasks[idx].completed = Boolean(completed);
    tasks[idx].completedAt = tasks[idx].completed ? tasks[idx].completedAt || new Date().toISOString() : null;
  }
  if (priority !== undefined) tasks[idx].priority = priority;
  if (dueDate !== undefined) tasks[idx].dueDate = dueDate || null;
  if (dueTime !== undefined) tasks[idx].dueTime = dueTime || null;
  awardBadges(userId);
  res.json(tasks[idx]);
});

// API: calendar events
app.get('/api/calendar', (req, res) => {
  const userId = currentUserId(req);
  res.json(calendarEvents.filter(event => userOwned(event, userId)));
});

app.post('/api/calendar', (req, res) => {
  const userId = currentUserId(req);
  const { title, date, description } = req.body;
  if (!title || !date) {
    return res.status(400).json({ error: 'title and date required' });
  }
  const event = {
    id: nextCalendarEventId++,
    userId,
    title,
    date,
    description: description || '',
    createdAt: new Date().toISOString()
  };
  calendarEvents.push(event);
  res.status(201).json(event);
});

app.delete('/api/calendar/:id', (req, res) => {
  const id = Number(req.params.id);
  const userId = currentUserId(req);
  const idx = calendarEvents.findIndex(e => e.id === id && userOwned(e, userId));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  calendarEvents.splice(idx, 1);
  res.status(204).end();
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
  });
}

module.exports = { app, resetTasks };
