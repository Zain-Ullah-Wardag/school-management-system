import 'dotenv/config';
import { getDatabase, closeDatabase } from '../database';
import { createApp } from './app';
import { startAttendanceAlertScheduler } from './services/attendance-alert.scheduler';
import { startFeeReminderScheduler } from './services/fee-reminder.scheduler';

const port = Number(process.env.PORT || 3299);
getDatabase();
startAttendanceAlertScheduler();
startFeeReminderScheduler();
const server = createApp().listen(port, '0.0.0.0', () => console.log(`School ERP API is running on port ${port}`));

function shutdown() {
  server.close(() => { closeDatabase(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
