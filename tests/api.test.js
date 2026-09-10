const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { app, resetTasks } = require('../index');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const fs = require('node:fs');


test.beforeEach(() => {
  resetTasks();
});

test('GET / renders School Planner in the site header', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /School Planner/);
});

test('GET /login and /register include the shared theme script', async () => {
  const [loginResponse, registerResponse] = await Promise.all([
    fetch(`${baseUrl}/login`),
    fetch(`${baseUrl}/register`)
  ]);

  assert.equal(loginResponse.status, 200);
  assert.equal(registerResponse.status, 200);

  const loginHtml = await loginResponse.text();
  const registerHtml = await registerResponse.text();

  assert.match(loginHtml, /\/app\.js/);
  assert.match(registerHtml, /\/app\.js/);
});

test('profile and welcome views also include the shared theme script', () => {
  const profileHtml = fs.readFileSync(require.resolve('../views/profile.ejs'), 'utf8');
  const welcomeHtml = fs.readFileSync(require.resolve('../views/welcome.ejs'), 'utf8');
  assert.match(profileHtml, /\/app\.js/);
  assert.match(welcomeHtml, /\/app\.js/);
});

test('profile view safely falls back when profile option lists are not provided', () => {
  const profileHtml = fs.readFileSync(require.resolve('../views/profile.ejs'), 'utf8');
  assert.match(profileHtml, /typeof accentOptions !== 'undefined'/);
  assert.match(profileHtml, /typeof themeOptions !== 'undefined'/);
  assert.match(profileHtml, /typeof learningStyles !== 'undefined'/);
});

test('POST /api/tasks stores completed state and returns it', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Maths',
      description: 'Practice algebra',
      lesson: 2,
      completed: true
    })
  });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.subject, 'Maths');
  assert.equal(data.completed, true);
});

test('POST /api/tasks stores priority and due date', async () => {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Science',
      description: 'Revision quiz',
      priority: 'high',
      dueDate: '2026-07-01'
    })
  });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.priority, 'high');
  assert.equal(data.dueDate, '2026-07-01');
});

test('PUT /api/tasks/:id toggles completion state', async () => {
  const createResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'English', description: 'Essay draft', lesson: 1 })
  });
  const created = await createResponse.json();

  const updateResponse = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true })
  });

  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json();
  assert.equal(updated.completed, true);
});
