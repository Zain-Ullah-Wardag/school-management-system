import { getDatabase } from '../../database';
import { CommunicationService } from './communication.service';

function karachiNow() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
}

export function startAttendanceAlertScheduler() {
  const run = async () => {
    try {
      const db = getDatabase();
      const { date, time } = karachiNow();
      const configured = (db.prepare("SELECT value FROM settings WHERE key='attendance.sms_time'").get() as { value: string } | undefined)?.value || '10:15';
      const previous = (db.prepare("SELECT value FROM settings WHERE key='attendance.last_alert_date'").get() as { value: string } | undefined)?.value;
      if (time !== configured || previous === date) return;
      const gateway = new CommunicationService().gateway() as { is_enabled: number };
      if (!gateway.is_enabled) return;
      await new CommunicationService().sendAbsenceAlerts(date);
      await new CommunicationService().sendAttendanceWarnings();
      db.prepare(`INSERT INTO settings (key,value,group_name,updated_at) VALUES ('attendance.last_alert_date',?,'attendance',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).run(date);
    } catch (error) { console.error('Attendance SMS scheduler failed:', error); }
  };
  void run();
  return setInterval(() => void run(), 60_000);
}
