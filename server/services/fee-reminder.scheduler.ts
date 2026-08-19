import { FeeReminderService } from './fee-reminder.service';

export function startFeeReminderScheduler() {
  const run = async () => {
    try { await new FeeReminderService().runScheduled(); }
    catch (error) { console.error('Fee reminder scheduler failed:', error); }
  };
  void run();
  return setInterval(() => void run(), 60_000);
}
