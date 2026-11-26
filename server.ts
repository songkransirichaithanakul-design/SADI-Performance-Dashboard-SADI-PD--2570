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
      const message = error instanceof Error ? error.message : 'Failed to bulk update projects';
      const status = message.includes('DUPLICATE_CODE') ? 409 : 500;
      return res.status(status).json({
        error: message.replace(/^DUPLICATE_CODE:\s*/, ''),
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
      const status = message.includes('DUPLICATE_CODE')
        ? 409
        : message.includes('not found')
        ? 404
        : 500;
      return res.status(status).json({ error: message.replace(/^DUPLICATE_CODE:\s*/, '') });
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
      const message = error instanceof Error ? error.message : 'Failed to create project';
      const status = message.includes('DUPLICATE_CODE') ? 409 : 500;
      return res.status(status).json({
        error: message.replace(/^DUPLICATE_CODE:\s*/, ''),
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

  // Pull a shared Google Sheet directly via its export URL (fallback when OAuth popup domain is not yet allowlisted)
  app.post('/api/sheets/pull-link', async (req, res) => {
    try {
      const rawId = typeof req.body?.spreadsheetId === 'string' ? req.body.spreadsheetId.trim() : '';
      if (!/^[a-zA-Z0-9_-]{20,80}$/.test(rawId)) {
        return res.status(400).json({
          error:
            'รหัส Google Sheet ไม่ถูกต้อง กรุณาวางลิงก์เต็มจาก Google Sheets (เช่น https://docs.google.com/spreadsheets/d/...)',
        });
      }

      const isAllowedGoogleHost = (hostname: string): boolean => {
        const host = hostname.toLowerCase();
        return (
          host === 'docs.google.com' ||
          host === 'drive.google.com' ||
          host.endsWith('.googleusercontent.com')
        );
      };

      const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap
      const MAX_REDIRECTS = 5;
      let currentUrl = `https://docs.google.com/spreadsheets/d/${rawId}/export?format=xlsx`;
      let response: Response | null = null;

      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        const parsedUrl = new URL(currentUrl);
        if (parsedUrl.protocol !== 'https:' || !isAllowedGoogleHost(parsedUrl.hostname)) {
          return res.status(403).json({
            error:
              'ชีตนี้ตั้งค่าเป็นส่วนตัว (Private) ไม่สามารถดึงผ่านลิงก์โดยตรงได้ กรุณาเข้าสู่ระบบ Google หรือตั้งค่าแชร์ชีตเป็น "ทุกคนที่มีลิงก์ (ผู้มีสิทธิ์อ่าน)" ชั่วคราว แล้วกดดึงข้อมูลอีกครั้ง',
          });
        }

        const resp = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
          headers: {
            'User-Agent': 'SADI-Portal-Sheet-Importer/1.0',
          },
        });

        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get('location');
          if (!location) {
            return res.status(502).json({ error: 'ไม่สามารถติดตามลิงก์ดาวน์โหลดจาก Google Sheets ได้' });
          }
          const nextUrl = new URL(location, currentUrl);
          if (nextUrl.hostname.toLowerCase() === 'accounts.google.com') {
            return res.status(403).json({
              error:
                'ชีตนี้ตั้งค่าเป็นส่วนตัว (Private) ไม่สามารถดึงผ่านลิงก์โดยตรงได้ กรุณาตั้งค่าแชร์ใน Google Sheets เป็น "ทุกคนที่มีลิงก์ (ผู้มีสิทธิ์อ่าน)" แล้วกดดึงข้อมูลอีกครั้ง หรือดาวน์โหลดเป็นไฟล์ .xlsx มาอัปโหลดในแท็บนำเข้าไฟล์จากเครื่อง',
            });
          }
          currentUrl = nextUrl.toString();
          continue;
        }

        response = resp;
        break;
      }

      if (!response) {
        return res.status(502).json({ error: 'การเชื่อมต่อกับ Google Sheets มีการเปลี่ยนเส้นทางมากเกินกำหนด' });
      }

      if (response.status === 401 || response.status === 403) {
        return res.status(403).json({
          error:
            'ชีตนี้ตั้งค่าเป็นส่วนตัว (Private) กรุณากดปุ่ม "แชร์" ใน Google Sheets แล้วเลือก "ทุกคนที่มีลิงก์ (ผู้มีสิทธิ์อ่าน)" จากนั้นกดดึงข้อมูลอีกครั้ง',
        });
      }

      if (response.status === 404) {
        return res.status(404).json({
          error: 'ไม่พบไฟล์ Google Sheet ตามลิงก์ที่ระบุ กรุณาตรวจสอบว่าลิงก์ถูกต้องและไฟล์ยังไม่ถูกลบ',
        });
      }

      if (!response.ok) {
        return res.status(502).json({
          error: `ไม่สามารถดึงไฟล์จาก Google Sheets ได้ (รหัสสถานะ ${response.status})`,
        });
      }

      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalLength += value.byteLength;
            if (totalLength > MAX_BYTES) {
              await reader.cancel();
              return res.status(413).json({
                error: 'ไฟล์ Google Sheet มีขนาดใหญ่เกิน 10 MB กรุณาดาวน์โหลดเป็นไฟล์ .xlsx แล้วนำเข้าจากเครื่องแทน',
              });
            }
            chunks.push(value);
          }
        }
      } else {
        const ab = await response.arrayBuffer();
        if (ab.byteLength > MAX_BYTES) {
          return res.status(413).json({
            error: 'ไฟล์ Google Sheet มีขนาดใหญ่เกิน 10 MB กรุณาดาวน์โหลดเป็นไฟล์ .xlsx แล้วนำเข้าจากเครื่องแทน',
          });
        }
        chunks.push(new Uint8Array(ab));
      }

      const buffer = Buffer.concat(chunks);
      // Verify XLSX (ZIP) signature "PK" (0x50 0x4B) to ensure Google did not return an HTML login/error page
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return res.status(403).json({
          error:
            'ชีตนี้ยังไม่เปิดสิทธิ์ให้เข้าถึงผ่านลิงก์ กรุณากดปุ่ม "แชร์" ใน Google Sheets → เปลี่ยนเป็น "ทุกคนที่มีลิงก์ (ผู้มีสิทธิ์อ่าน)" แล้วกดดึงข้อมูลอีกครั้ง หรือดาวน์โหลดไฟล์ .xlsx จาก Google Sheets มาอัปโหลดในแท็บนำเข้าไฟล์จากเครื่อง',
        });
      }

      return res.json({
        base64: buffer.toString('base64'),
        fileName: `Google Sheet (${rawId.slice(0, 8)}...)`,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      return res.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? 'เชื่อมต่อ Google Sheets ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'
          : 'ไม่สามารถดึงข้อมูลจากลิงก์ Google Sheet ได้ในขณะนี้ กรุณาลองใหม่หรือดาวน์โหลดเป็นไฟล์ .xlsx มาอัปโหลดแทน',
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
