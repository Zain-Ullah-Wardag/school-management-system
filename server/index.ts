import 'dotenv/config';
import type { Server } from 'http';
import { getDatabase, closeDatabase } from '../database';
import { createApp } from './app';
import { startAttendanceAlertScheduler } from './services/attendance-alert.scheduler';
import { startFeeReminderScheduler } from './services/fee-reminder.scheduler';

let server: Server | null = null;
let listeningPort: number | null = null;

export function getListeningPort() {
  return listeningPort;
}

export function startServer(preferredPort = Number(process.env.PORT || 3299)): Promise<Server> {
  if (server) return Promise.resolve(server);
  const port = Number.isFinite(preferredPort) && preferredPort > 0 ? preferredPort : 3299;
  getDatabase();
  startAttendanceAlertScheduler();
  startFeeReminderScheduler();
  return new Promise((resolve, reject) => {
    const instance = createApp().listen(port, '0.0.0.0', () => {
      listeningPort = port;
      console.log(`School ERP API is running on port ${port}`);
      resolve(instance);
    });
    instance.on('error', (error) => {
      server = null;
      listeningPort = null;
      reject(error);
    });
    server = instance;
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) {
      closeDatabase();
      listeningPort = null;
      resolve();
      return;
    }
    server.close(() => {
      closeDatabase();
      server = null;
      listeningPort = null;
      resolve();
    });
  });
}

if (process.env.SCHOOL_ERP_EMBEDDED !== 'true') {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
  const shutdown = () => {
    void stopServer().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
