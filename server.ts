import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileDb, getFormattedNow } from './server/fileDb.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Initialize and verify file-based database on boot
  await fileDb.ensureInitialized();

  // Health & DB Integrity Check
  app.get('/api/health', async (_req, res) => {
    try {
      const health = await fileDb.getHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({
        healthy: false,
        error: error instanceof Error ? error.message : 'Database health check failed',
      });
    }
  });

  // Bootstrap complete verified dataset
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const db = await fileDb.readAll();
      const health = await fileDb.getHealth();
      res.json({
        projects: db.projects,
        authorizedUsers: db.authorizedUsers,
        auditLogs: db.auditLogs,
        health,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load database state',
      });
    }
  });

  // Bulk update or import projects (registered before :id route)
  app.put('/api/projects/bulk', async (req, res) => {
    try {
      const { projects, actorName, actorRole, auditNote } = req.body || {};
      if (!Array.isArray(projects)) {
        return res.status(400).json({ error: 'Invalid projects array' });
      }
      const result = await fileDb.bulkUpdateProjects(projects, actorName, actorRole, auditNote);
      const health = await fileDb.getHealth();
      return res.json({
        projects: result.db.projects,
        auditLogs: result.db.auditLogs,
        health,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to bulk update projects',
      });
    }
  });

  // Update a single project
  app.put('/api/projects/:id', async (req, res) => {
    try {
      const { project, actorName, actorRole, changeNotes } = req.body || {};
      if (!project || typeof project !== 'object') {
        return res.status(400).json({ error: 'Missing project payload' });
      }
      const result = await fileDb.updateSingleProject(
        req.params.id,
        project,
        actorName,
        actorRole,
        changeNotes
      );
      const health = await fileDb.getHealth();
      return res.json({
        project: result.project,
        projects: result.db.projects,
        auditLogs: result.db.auditLogs,
        health,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update project';
      const status = message.includes('not found') ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  });

  // Create new project
  app.post('/api/projects', async (req, res) => {
    try {
      const { project, actorName, actorRole } = req.body || {};
      if (!project || typeof project !== 'object') {
        return res.status(400).json({ error: 'Missing project payload' });
      }
      const result = await fileDb.createProject(project, actorName, actorRole);
      const health = await fileDb.getHealth();
      return res.status(201).json({
        project: result.project,
        projects: result.db.projects,
        auditLogs: result.db.auditLogs,
        health,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create project',
      });
    }
  });

  // Delete project
  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const { actorName, actorRole } = req.body || {};
      const result = await fileDb.removeProject(req.params.id, actorName, actorRole);
      const health = await fileDb.getHealth();
      return res.json({
        projects: result.db.projects,
        auditLogs: result.db.auditLogs,
        health,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project';
      const status = message.includes('not found') ? 404 : 500;
      return res.status(status).json({ error: message });
    }
  });

  // Add authorized user
  app.post('/api/users', async (req, res) => {
    try {
      const { user, actorName, actorRole } = req.body || {};
      if (!user || !user.name) {
        return res.status(400).json({ error: 'Missing user details' });
      }
      const result = await fileDb.addAuthorizedUser(user, actorName, actorRole);
      const health = await fileDb.getHealth();
      return res.status(201).json({
        user: result.user,
        authorizedUsers: result.db.authorizedUsers,
        auditLogs: result.db.auditLogs,
        health,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to add user',
      });
    }
  });

  // Remove authorized user
  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { actorName, actorRole } = req.body || {};
      const result = await fileDb.removeAuthorizedUser(req.params.id, actorName, actorRole);
      const health = await fileDb.getHealth();
      return res.json({
        authorizedUsers: result.db.authorizedUsers,
        auditLogs: result.db.auditLogs,
        health,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to remove user',
      });
    }
  });

  // Reset database to official FY 2570 baseline
  app.post('/api/reset', async (_req, res) => {
    try {
      const db = await fileDb.resetAll();
      const health = await fileDb.getHealth();
      return res.json({
        projects: db.projects,
        authorizedUsers: db.authorizedUsers,
        auditLogs: db.auditLogs,
        health,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to reset database',
      });
    }
  });

  // Record Admin login audit log server-side (never exposes credentials in GET payloads)
  app.post('/api/audit/login', async (req, res) => {
    try {
      const { userName, userRole } = req.body || {};
      const db = await fileDb.appendLog({
        id: `log-${Date.now()}`,
        timestamp: getFormattedNow(),
        userName: userName || 'ผู้ดูแลระบบ (Admin)',
        userRole: userRole || 'admin',
        projectId: 'auth',
        projectName: 'การเข้าสู่ระบบผู้ดูแลระบบ',
        actionType: 'update',
        fieldChanged: 'Admin Sign-In',
        oldValue: '-',
        newValue: 'เข้าสู่ระบบสิทธิ Admin สำเร็จ',
        notes: 'ยืนยันตัวตนผู้ดูแลระบบสำเร็จ',
      });
      return res.json({ auditLogs: db.auditLogs });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to log sign-in',
      });
    }
  });

  // Export verified file-based DB snapshot
  app.get('/api/backup/export', async (_req, res) => {
    try {
      const db = await fileDb.readAll();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="SADI_FileDB_Snapshot_2570_${Date.now()}.json"`
      );
      return res.send(JSON.stringify(db, null, 2));
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to export database',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', async (_req, res) => {
      const indexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
      res.status(200).set({ 'Content-Type': 'text/html' }).end(indexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SADI] Server + Atomic File DB listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SADI] Failed to start server:', err);
  process.exit(1);
});
