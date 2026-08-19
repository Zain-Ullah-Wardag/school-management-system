import { getDatabase } from '../../database';
import { bool, today } from '../utils/serializers';
import { CommunicationService } from './communication.service';
import { MessagingService } from './messaging.service';

const setting = (key: string, fallback: string) => (getDatabase().prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value || fallback;
const saveSetting = (key: string, value: string, group = 'fee_reminders') => getDatabase().prepare(`INSERT INTO settings (key,value,group_name,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,group_name=excluded.group_name,updated_at=CURRENT_TIMESTAMP`).run(key, value, group);
const nextScheduledDate = (reminderDay: number, from = today()) => {
  const candidate = `${from.slice(0, 7)}-${String(reminderDay).padStart(2, '0')}`;
  if (candidate >= from) return candidate;
  const nextMonth = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return `${nextMonth.toISOString().slice(0, 7)}-${String(reminderDay).padStart(2, '0')}`;
};

export class FeeReminderService {
  status() {
    const enabled = bool(setting('fee.reminder_enabled', 'false'));
    const reminderDay = Math.min(28, Math.max(1, Number(setting('fee.reminder_day', '5')) || 5));
    const templateCode = setting('fee.reminder_template_code', 'fee_due');
    const channel = setting('fee.reminder_channel', 'sms') === 'whatsapp' ? 'whatsapp' : 'sms';
    const lastReminderDate = setting('fee.reminder_last_date', '');
    const providerConfigurationId = Number(setting('fee.reminder_provider_configuration_id', '0')) || null;
    const db = getDatabase();
    const outstanding = db.prepare(`SELECT COUNT(DISTINCT student_id) total_students,COALESCE(SUM(total-paid_amount),0) total_due FROM invoices WHERE status IN ('unpaid','partial','overdue')`).get() as { total_students: number; total_due: number };
    const history = providerConfigurationId
      ? db.prepare(`SELECT id,recipient_id AS student_id,phone_number AS phone,message,channel,status,created_at,sent_at,error_message FROM message_logs WHERE template_code=? ORDER BY created_at DESC LIMIT 20`).all(templateCode)
      : db.prepare(`SELECT id,student_id,phone,message,channel,status,created_at,sent_at,provider_response AS error_message FROM sms_logs WHERE template_code=? ORDER BY created_at DESC LIMIT 20`).all(templateCode);
    const next = nextScheduledDate(reminderDay);
    const provider_configuration = providerConfigurationId ? db.prepare(`SELECT c.id,c.name,p.provider_type,c.is_enabled,c.connection_status FROM provider_configurations c JOIN messaging_providers p ON p.id=c.provider_id WHERE c.id=?`).get(providerConfigurationId) : null;
    return { enabled, reminder_day: reminderDay, template_code: templateCode, channel, provider_configuration_id: providerConfigurationId, provider_configuration, gateway: new CommunicationService().gateway(), outstanding, last_reminder_date: lastReminderDate || null, next_scheduled_reminder: next, history };
  }

  configure(input: Record<string, unknown>) {
    const reminderDay = Math.min(28, Math.max(1, Number(input.reminder_day) || 5));
    saveSetting('fee.reminder_enabled', bool(input.enabled) ? 'true' : 'false');
    saveSetting('fee.reminder_day', String(reminderDay));
    saveSetting('fee.reminder_template_code', String(input.template_code || 'fee_due'));
    saveSetting('fee.reminder_channel', input.channel === 'whatsapp' ? 'whatsapp' : 'sms');
    saveSetting('fee.reminder_provider_configuration_id', input.provider_configuration_id ? String(input.provider_configuration_id) : '');
    return this.status();
  }

  async sendNow(userId: number) {
    return this.sendOutstanding(userId, false);
  }

  async runScheduled() {
    const status = this.status();
    if (!status.enabled) return { skipped: 'disabled', total: 0 };
    const date = today();
    const schoolDay = Number(date.slice(-2));
    if (schoolDay !== status.reminder_day) return { skipped: 'not_due', total: 0 };
    if (status.last_reminder_date === date) return { skipped: 'already_sent_today', total: 0 };
    const result = await this.sendOutstanding(0, true);
    saveSetting('fee.reminder_last_date', date);
    return result;
  }

  private async sendOutstanding(userId: number, scheduled: boolean) {
    const status = this.status();
    // If a modern provider configuration is selected, use the provider abstraction.
    // Otherwise retain the legacy gateway workflow so existing school installations keep working.
    const result = status.provider_configuration_id
      ? await new MessagingService().send({ provider_configuration_id: status.provider_configuration_id, channel: status.channel, recipient_type: 'parent', send_to: 'entire_school', only_unpaid: true, template_code: status.template_code, message_type: 'fee_reminder' }, userId)
      : await new CommunicationService().send({ target: 'unpaid', channel: status.channel, template_code: status.template_code }, userId);
    if (!scheduled) saveSetting('fee.reminder_last_manual_at', new Date().toISOString());
    return { ...result, scheduled };
  }
}
