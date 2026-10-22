import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';

export function createApp(db: DatabaseSync, baseUrl: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.post('/users', (req, res) => {
    const name = req.body?.name;
    const email = req.body?.email;

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      res.status(400).json({ error: 'Informe um nome entre 1 e 120 caracteres.' });
      return;
    }
    if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'E-mail inválido.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = { id: randomUUID(), name: name.trim(), email: normalizedEmail, createdAt: new Date().toISOString() };
    try {
      db.prepare('INSERT INTO users (id, name, email, created_at) VALUES (?, ?, ?, ?)')
        .run(user.id, user.name, user.email, user.createdAt);
    } catch (error) {
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
        res.status(409).json({ error: 'Já existe um usuário com esse email.' });
        return;
      }
      throw error;
    }
    res.status(201).json(user);
  });

  app.post('/users/:userId/links', (req, res) => {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const url = req.body?.url;
    if (typeof url !== 'string' || !url.trim() || url.trim().length > 4096) {
      res.status(400).json({ error: 'Informe uma URL com até 4096 caracteres.' });
      return;
    }
    const originalUrl = url.trim();
    try {
      const parsed = new URL(originalUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        res.status(400).json({ error: 'Informe uma URL HTTP ou HTTPS válida sem credenciais.' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Informe uma URL HTTP ou HTTPS válida sem credenciais.' });
      return;
    }
    
    for (let attempt = 0; attempt < 5; attempt++) {
      const link = {
        id: randomUUID(), userId: req.params.userId, originalUrl,
        code: randomBytes(6).toString('base64url'), createdAt: new Date().toISOString(),
      };
      try {
        db.prepare('INSERT INTO links (id, user_id, original_url, code, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(link.id, link.userId, link.originalUrl, link.code, link.createdAt);
      } catch (error) {
        if (db.prepare('SELECT id FROM links WHERE code = ?').get(link.code)) continue;
        throw error;
      }
      res.status(201).json({ ...link, shortUrl: `${baseUrl}/s/${link.code}`, views: 0 });
      return;
    }
    res.status(503).json({ error: 'Não foi possível gerar um código. Tente novamente.' });
  });

  app.get('/users/:userId/links', (req, res) => {
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const links = db.prepare(`
      SELECT l.id, l.user_id AS userId, l.original_url AS originalUrl,
             l.code, l.created_at AS createdAt, COUNT(v.id) AS views
      FROM links l LEFT JOIN views v ON v.link_id = l.id
      WHERE l.user_id = ? GROUP BY l.id ORDER BY l.created_at, l.id
    `).all(req.params.userId);
    res.json(links.map(link => ({ ...link, shortUrl: `${baseUrl}/s/${link.code}` })));
  });

  app.get('/s/:code', (req, res) => {
    const link = db.prepare('SELECT id, original_url FROM links WHERE code = ?').get(req.params.code);
    if (!link) {
      res.status(404).json({ error: 'Link não encontrado.' });
      return;
    }
    
    if (req.method === 'GET') {
      db.prepare('INSERT INTO views (link_id, viewed_at) VALUES (?, ?)').run(link.id!, new Date().toISOString());
    }
    res.set('Cache-Control', 'no-store').redirect(302, link.original_url as string);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'JSON inválido.' });
      return;
    }
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Corpo da requisição excede o limite de 16 KB.' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  };
  app.use(errorHandler);
  return app;
}
