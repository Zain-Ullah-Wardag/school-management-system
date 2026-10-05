import 'dotenv/config';
import { getDatabase, closeDatabase } from '../database';
import { createApp } from './app';
import { startAttendanceAlertScheduler } from './services/attendance-alert.scheduler';
import { startFeeReminderScheduler } from './services/fee-reminder.scheduler';

const requestedPort = Number(process.env.PORT || 3299);
getDatabase();
startAttendanceAlertScheduler();
startFeeReminderScheduler();
const server = createApp().listen(requestedPort, '0.0.0.0', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : requestedPort;
  console.log(`School ERP API is running on port ${port}`);

  // Packaged Electron starts the API with PORT=0 so Windows assigns an
  // unused port. Report that exact port to the owning Electron process; this
  // prevents a newly built app from accidentally loading an older instance
  // that still owns the former fixed port.
  process.send?.({ type: 'school-erp-api-ready', port });
});

function shutdown() {
  server.close(() => { closeDatabase(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
