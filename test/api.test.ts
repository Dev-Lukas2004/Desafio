import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.ts';
import { createApp } from '../src/app.ts';

test('API: cadastro, validação, isolamento, redirecionamento e visualizações', async () => {
  const db = openDatabase(':memory:');
  const server = createApp(db, 'http://localhost').listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await post('/users', {})).status, 400);
    assert.equal((await post('/users', { name: 'Lukas', email: 'inválido' })).status, 400);
    const response = await post('/users', { name: ' Lukas ', email: ' LUKAS@example.com ' });
    assert.equal(response.status, 201);
    const user = await response.json();
    assert.equal(user.name, 'Lukas');
    assert.equal(user.email, 'lukas@example.com');
    assert.equal((await post('/users', { name: 'Outro', email: 'lukas@example.com' })).status, 409);
    const other = await (await post('/users', { name: 'Ana', email: 'ana@example.com' })).json();
    const path = `/users/${user.id}/links`;
    assert.deepEqual(await (await fetch(base + path)).json(), []);
    assert.equal((await post('/users/inexistente/links', { url: 'https://example.com' })).status, 404);
    assert.equal((await fetch(base + '/users/inexistente/links')).status, 404);
    for (const url of ['abc', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com']) {
      assert.equal((await post(path, { url })).status, 400);
    }
    const created = await post(path, { url: 'https://example.com/path?x=1' });
    assert.equal(created.status, 201);
    const link = await created.json();
    assert.equal(link.userId, user.id);
    assert.equal(link.shortUrl, `http://localhost/s/${link.code}`);
    assert.equal(link.views, 0);
    const second = await (await post(path, { url: link.originalUrl })).json();
    assert.notEqual(second.code, link.code);
    assert.deepEqual(await (await fetch(`${base}/users/${other.id}/links`)).json(), []);
    assert.equal((await fetch(`${base}/s/${link.code}`, { method: 'HEAD', redirect: 'manual' })).status, 302);
    for (let i = 0; i < 3; i++) {
      const redirect = await fetch(`${base}/s/${link.code}`, { redirect: 'manual' });
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get('location'), link.originalUrl);
      assert.equal(redirect.headers.get('cache-control'), 'no-store');
    }
    const listed = await (await fetch(base + path)).json();
    assert.equal(listed.find((item: { id: string }) => item.id === link.id).views, 3);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM views').get()!.total, 3);
    assert.equal((await fetch(base + '/s/inexistente')).status, 404);
    assert.equal((await fetch(base + '/inexistente')).status, 404);
    const malformed = await fetch(base + '/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(malformed.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
});

test('SQLite mantém usuários, links e visualizações após reabrir o arquivo', () => {
  const directory = mkdtempSync(join(tmpdir(), 'encurtador-test-'));
  const path = join(directory, 'test.sqlite');
  let db = openDatabase(path);
  try {
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('u1', 'Lukas', 'l@example.com', '2026-10-22');
    db.prepare('INSERT INTO links VALUES (?, ?, ?, ?, ?)').run('l1', 'u1', 'https://example.com', 'code', '2026-10-22');
    db.prepare('INSERT INTO views (link_id, viewed_at) VALUES (?, ?)').run('l1', '2026-10-22');
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM users').get()!.total, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM links').get()!.total, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM views').get()!.total, 1);
    assert.throws(() => db.prepare('INSERT INTO views (link_id, viewed_at) VALUES (?, ?)').run('missing', 'now'));
  } finally {
    db.close();
    rmSync(directory, { recursive: true });
  }
});
