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

test.beforeEach(() => {
  resetTasks();
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
