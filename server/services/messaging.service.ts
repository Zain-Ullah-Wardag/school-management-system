import { getDatabase } from '../../database';
import { ApiError } from '../utils/errors';
import { pagination, required } from '../utils/http';
import { bool } from '../utils/serializers';
import { providerRegistry } from './messaging/provider-registry';
import type { MessageChannel, ProviderConfiguration, ProviderType } from './messaging/types';

type Recipient = { recipient_type: string; recipient_id: number | null; recipient_name: string; phone: string; values: Record<string, string | number> };
const providerTypes: ProviderType[] = ['disabled', 'gsm_modem', 'sms_gateway_api', 'android_sms_gateway', 'whatsapp_business_api'];
const setting = (key: string, fallback: string) => (getDatabase().prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined)?.value || fallback;

export class MessagingService {
  providers() {
    const db = getDatabase();
    const providers = db.prepare(`SELECT p.*,c.id configuration_id,c.name configuration_name,c.is_enabled,c.is_default,c.connection_status,c.last_connected_at,c.last_tested_at,c.last_error,c.config_json FROM messaging_providers p LEFT JOIN provider_configurations c ON c.provider_id=p.id ORDER BY p.id,c.is_default DESC,c.name`).all() as Record<string, unknown>[];
    return providers.map((row) => ({ ...row, config: this.parseConfig(row.config_json) }));
  }

  configurations() {
    const db = getDatabase();
    const rows = db.prepare(`SELECT c.*,p.code provider_code,p.name provider_name,p.provider_type FROM provider_configurations c JOIN messaging_providers p ON p.id=c.provider_id ORDER BY c.is_default DESC,c.name`).all() as Record<string, unknown>[];
    return rows.map((row) => ({ ...row, config: this.parseConfig(row.config_json) }));
  }

  configuration(id: number) {
    const row = getDatabase().prepare(`SELECT c.*,p.code provider_code,p.name provider_name,p.provider_type FROM provider_configurations c JOIN messaging_providers p ON p.id=c.provider_id WHERE c.id=?`).get(id) as Record<string, unknown> | undefined;
    if (!row) throw new ApiError(404, 'Messaging provider configuration not found');
    return { ...row, config: this.parseConfig(row.config_json) };
  }

  saveConfiguration(input: Record<string, unknown>, userId: number, id?: number) {
    const db = getDatabase();
    const providerCode = required(input.provider_code, 'Provider type') as ProviderType;
    if (!providerTypes.includes(providerCode)) throw new ApiError(422, 'Unsupported messaging provider type');
    const provider = db.prepare('SELECT id FROM messaging_providers WHERE code=?').get(providerCode) as { id: number } | undefined;
    if (!provider) throw new ApiError(422, 'Messaging provider is unavailable');
    const config = input.config && typeof input.config === 'object' ? input.config : {};
    const isDefault = bool(input.is_default);
    const isEnabled = providerCode === 'disabled' ? true : bool(input.is_enabled);
    let configurationId = id;
    db.transaction(() => {
      if (isDefault) db.prepare('UPDATE provider_configurations SET is_default=0').run();
      if (id) {
        const result = db.prepare(`UPDATE provider_configurations SET provider_id=?,name=?,config_json=?,is_enabled=?,is_default=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(provider.id, required(input.name, 'Configuration name'), JSON.stringify(config), isEnabled ? 1 : 0, isDefault ? 1 : 0, id);
        if (!result.changes) throw new ApiError(404, 'Messaging provider configuration not found');
      } else {
        configurationId = Number(db.prepare(`INSERT INTO provider_configurations (provider_id,name,config_json,is_enabled,is_default,connection_status,created_by) VALUES (?,?,?,?,?,?,?)`).run(provider.id, required(input.name, 'Configuration name'), JSON.stringify(config), isEnabled ? 1 : 0, isDefault ? 1 : 0, 'disconnected', userId).lastInsertRowid);
      }
      if (isDefault) db.prepare(`INSERT INTO messaging_settings (key,value,updated_at) VALUES ('default_provider_configuration_id',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).run(String(configurationId));
    })();
    return this.configuration(configurationId!);
  }

  deleteConfiguration(id: number) {
    const result = getDatabase().prepare('DELETE FROM provider_configurations WHERE id=?').run(id);
    if (!result.changes) throw new ApiError(404, 'Messaging provider configuration not found');
  }

  async validateConfiguration(id: number) {
    const config = this.configuration(id) as ProviderConfiguration;
    const provider = providerRegistry.get(config.provider_type as ProviderType);
    const connection = await provider.validate(config.config as Record<string, unknown>);
    getDatabase().prepare(`UPDATE provider_configurations SET connection_status=?,last_tested_at=CURRENT_TIMESTAMP,last_connected_at=CASE WHEN ?='connected' THEN CURRENT_TIMESTAMP ELSE last_connected_at END,last_error=? WHERE id=?`).run(connection.status, connection.status, connection.error || null, id);
    return { ...connection, configuration: this.configuration(id) };
  }

  async testConfiguration(id: number, input: Record<string, unknown>, userId: number) {
    const config = this.configuration(id) as ProviderConfiguration;
    const recipient = required(input.recipient, 'Test recipient');
    const message = required(input.message, 'Test message');
    const provider = providerRegistry.get(config.provider_type as ProviderType);
    const result = await provider.test(config.config as Record<string, unknown>, recipient, message);
    const log = this.log({ configurationId: id, recipientType: 'test', recipientId: null, recipientName: 'Test Recipient', phone: recipient, messageType: 'test', templateCode: null, channel: config.provider_type === 'whatsapp_business_api' ? 'whatsapp' : 'sms', message, result, userId });
    return { result, log };
  }

  templates() { return getDatabase().prepare('SELECT * FROM messaging_templates ORDER BY category,name').all(); }

  saveTemplate(input: Record<string, unknown>, userId: number, id?: number) {
    const db = getDatabase();
    const values = [required(input.code, 'Template code'), required(input.name, 'Template name'), required(input.category, 'Template category'), input.channel === 'sms' || input.channel === 'whatsapp' ? input.channel : 'auto', required(input.body, 'Template body'), bool(input.is_active) ? 1 : 0];
    if (id) {
      const result = db.prepare(`UPDATE messaging_templates SET code=?,name=?,category=?,channel=?,body=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...values, id);
      if (!result.changes) throw new ApiError(404, 'Messaging template not found');
      return db.prepare('SELECT * FROM messaging_templates WHERE id=?').get(id);
    }
    const result = db.prepare(`INSERT INTO messaging_templates (code,name,category,channel,body,is_active,created_by) VALUES (?,?,?,?,?,?,?)`).run(...values, userId);
    return db.prepare('SELECT * FROM messaging_templates WHERE id=?').get(result.lastInsertRowid);
  }

  deleteTemplate(id: number) {
    const result = getDatabase().prepare('DELETE FROM messaging_templates WHERE id=?').run(id);
    if (!result.changes) throw new ApiError(404, 'Messaging template not found');
  }

  async send(input: Record<string, unknown>, userId: number) {
    const configuration = this.resolveConfiguration(input);
    const channel = this.resolveChannel(input.channel, configuration.provider_type as ProviderType);
    const recipients = this.resolveRecipients(input, channel);
    if (!recipients.length) throw new ApiError(422, 'No eligible recipients were found');
    const template = input.template_code ? getDatabase().prepare('SELECT code,body,category FROM messaging_templates WHERE code=? AND is_active=1').get(String(input.template_code)) as { code: string; body: string; category: string } | undefined : undefined;
    const rawMessage = String(input.message || template?.body || '');
    if (!rawMessage) throw new ApiError(422, 'Select a template or enter a message');
    const provider = providerRegistry.get(configuration.provider_type as ProviderType);
    const logs = [];
    for (const recipient of recipients) {
      const message = this.render(rawMessage, recipient.values);
      const result = configuration.is_enabled ? await provider.send(configuration.config as Record<string, unknown>, { recipient: recipient.phone, message, channel, recipientName: recipient.recipient_name }) : { status: 'queued' as const, providerResponse: 'Provider configuration is disabled; message queued.' };
      logs.push(this.log({ configurationId: configuration.id as number, recipientType: recipient.recipient_type, recipientId: recipient.recipient_id, recipientName: recipient.recipient_name, phone: recipient.phone, messageType: String(input.message_type || template?.category || template?.code || 'manual'), templateCode: template?.code || null, channel, message, result, userId }));
    }
    return { total: logs.length, provider: configuration.name, logs };
  }

  logs(query: Record<string, unknown>) {
    const { page, limit, offset } = pagination(query as never);
    const where = ['1=1']; const params: unknown[] = [];
    if (query.status) { where.push('l.status=?'); params.push(query.status); }
    if (query.provider_configuration_id) { where.push('l.provider_configuration_id=?'); params.push(Number(query.provider_configuration_id)); }
    if (query.channel) { where.push('l.channel=?'); params.push(query.channel); }
    if (typeof query.search === 'string' && query.search.trim()) { const like = `%${query.search.trim()}%`; where.push('(l.recipient_name LIKE ? OR l.phone_number LIKE ? OR l.message LIKE ? OR l.message_type LIKE ?)'); params.push(like, like, like, like); }
    const db = getDatabase();
    const total = (db.prepare(`SELECT COUNT(*) total FROM message_logs l WHERE ${where.join(' AND ')}`).get(...params) as { total: number }).total;
    const data = db.prepare(`SELECT l.*,c.name provider_name,p.provider_type FROM message_logs l LEFT JOIN provider_configurations c ON c.id=l.provider_configuration_id LEFT JOIN messaging_providers p ON p.id=c.provider_id WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async retry(logId: number, userId: number) {
    const log = getDatabase().prepare(`SELECT l.*,c.id configuration_id,c.config_json,p.provider_type FROM message_logs l LEFT JOIN provider_configurations c ON c.id=l.provider_configuration_id LEFT JOIN messaging_providers p ON p.id=c.provider_id WHERE l.id=?`).get(logId) as Record<string, unknown> | undefined;
    if (!log || !log.configuration_id || !log.provider_type) throw new ApiError(404, 'Retryable message log not found');
    const provider = providerRegistry.get(log.provider_type as ProviderType);
    const result = await provider.send(this.parseConfig(log.config_json), { recipient: String(log.phone_number), message: String(log.message), channel: log.channel as MessageChannel });
    return this.log({ configurationId: Number(log.configuration_id), recipientType: String(log.recipient_type), recipientId: log.recipient_id ? Number(log.recipient_id) : null, recipientName: String(log.recipient_name || ''), phone: String(log.phone_number), messageType: String(log.message_type || 'retry'), templateCode: log.template_code ? String(log.template_code) : null, channel: log.channel as MessageChannel, message: String(log.message), result, userId, retryOfId: logId });
  }

  async modemPorts() { return providerRegistry.gsm().ports(); }
  async modemConnect(input: Record<string, unknown>) { return providerRegistry.gsm().connect(input); }
  async modemDisconnect(input: Record<string, unknown>) { await providerRegistry.gsm().disconnect(input); return { status: 'disconnected' }; }
  async modemInfo(input: Record<string, unknown>) { return providerRegistry.gsm().info(input); }

  private resolveConfiguration(input: Record<string, unknown>): ProviderConfiguration {
    const requestedId = Number(input.provider_configuration_id);
    if (requestedId) return this.configuration(requestedId) as ProviderConfiguration;
    const row = getDatabase().prepare(`SELECT c.*,p.code provider_code,p.name provider_name,p.provider_type FROM provider_configurations c JOIN messaging_providers p ON p.id=c.provider_id WHERE c.is_default=1 LIMIT 1`).get() as Record<string, unknown> | undefined;
    if (!row) throw new ApiError(422, 'Configure and select a messaging provider first');
    return { ...row, config: this.parseConfig(row.config_json) } as ProviderConfiguration;
  }

  private resolveChannel(value: unknown, providerType: ProviderType): MessageChannel {
    if (value === 'sms' || value === 'whatsapp') return value;
    return providerType === 'whatsapp_business_api' ? 'whatsapp' : 'sms';
  }

  private resolveRecipients(input: Record<string, unknown>, channel: MessageChannel): Recipient[] {
    const type = String(input.recipient_type || 'student');
    if (type === 'staff') return this.staffRecipients(input, channel);
    if (type === 'visitor') return this.visitorRecipients(input, channel);
    return this.studentRecipients(input, channel, type === 'parent');
  }

  private studentRecipients(input: Record<string, unknown>, channel: MessageChannel, parent: boolean): Recipient[] {
    const db = getDatabase();
    const scope = String(input.send_to || 'individual');
    const where = ["s.status='active'"]; const params: unknown[] = [];
    const recipientIds = Array.isArray(input.recipient_ids) ? input.recipient_ids.map(Number).filter(Boolean) : input.student_id ? [Number(input.student_id)] : [];
    if (scope === 'individual' && recipientIds.length) { where.push(`s.id IN (${recipientIds.map(() => '?').join(',')})`); params.push(...recipientIds); }
    if (bool(input.only_unpaid)) { where.push(`EXISTS (SELECT 1 FROM invoices i WHERE i.student_id=s.id AND i.status IN ('unpaid','partial','overdue') AND i.total>i.paid_amount)`); }
    if ((scope === 'class' || scope === 'section') && input.class_id) { where.push('e.class_id=?'); params.push(Number(input.class_id)); if (scope === 'section' && input.section_id) { where.push('e.section_id=?'); params.push(Number(input.section_id)); } }
    if (scope === 'multiple_classes' && Array.isArray(input.class_ids) && input.class_ids.length) { const ids = input.class_ids.map(Number).filter(Boolean); where.push(`e.class_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    const phoneField = parent ? `COALESCE(fc.phone,fc.whatsapp,s.phone,s.whatsapp)` : channel === 'whatsapp' ? 'COALESCE(s.whatsapp,s.phone,fc.whatsapp,fc.phone)' : 'COALESCE(s.phone,s.whatsapp,fc.phone,fc.whatsapp)';
    const rows = db.prepare(`SELECT s.id,s.first_name || CASE WHEN s.last_name IS NOT NULL THEN ' '||s.last_name ELSE '' END student_name,${phoneField} phone,fc.full_name father_name,c.name class_name,sec.name section_name,e.roll_no,(SELECT COALESCE(SUM(i.total-i.paid_amount),0) FROM invoices i WHERE i.student_id=s.id AND i.status IN ('unpaid','partial','overdue')) due_amount,(SELECT MIN(i.due_date) FROM invoices i WHERE i.student_id=s.id AND i.status IN ('unpaid','partial','overdue')) due_date FROM students s LEFT JOIN student_contacts fc ON fc.student_id=s.id AND fc.contact_type='father' LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active' LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections sec ON sec.id=e.section_id WHERE ${where.join(' AND ')}`).all(...params) as Record<string, unknown>[];
    const school = setting('school.name', 'School');
    return rows.filter((row) => row.phone).map((row) => ({ recipient_type: parent ? 'parent' : 'student', recipient_id: Number(row.id), recipient_name: String(parent ? row.father_name || row.student_name : row.student_name), phone: String(row.phone), values: { student: String(row.student_name), student_name: String(row.student_name), father_name: String(row.father_name || ''), class: String(row.class_name || ''), section: String(row.section_name || ''), roll_number: String(row.roll_no || ''), school_name: school, due_amount: Number(row.due_amount || 0), amount: Number(row.due_amount || 0), due_date: String(row.due_date || '') } }));
  }

  private staffRecipients(input: Record<string, unknown>, channel: MessageChannel): Recipient[] {
    const db = getDatabase();
    const ids = Array.isArray(input.recipient_ids) ? input.recipient_ids.map(Number).filter(Boolean) : [];
    const where = ["s.status='active'"]; const params: unknown[] = [];
    if (String(input.send_to || 'individual') === 'individual' && ids.length) { where.push(`s.id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    const phone = channel === 'whatsapp' ? 'COALESCE(s.whatsapp,s.phone)' : 'COALESCE(s.phone,s.whatsapp)';
    return (db.prepare(`SELECT s.id,s.first_name || CASE WHEN s.last_name IS NOT NULL THEN ' '||s.last_name ELSE '' END name,${phone} phone FROM staff s WHERE ${where.join(' AND ')}`).all(...params) as Record<string, unknown>[]).filter((row) => row.phone).map((row) => ({ recipient_type: 'staff', recipient_id: Number(row.id), recipient_name: String(row.name), phone: String(row.phone), values: { staff_name: String(row.name), school_name: setting('school.name', 'School') } }));
  }

  private visitorRecipients(input: Record<string, unknown>, _channel: MessageChannel): Recipient[] {
    const db = getDatabase();
    const ids = Array.isArray(input.recipient_ids) ? input.recipient_ids.map(Number).filter(Boolean) : [];
    const where = ['1=1']; const params: unknown[] = [];
    if (String(input.send_to || 'individual') === 'individual' && ids.length) { where.push(`id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    return (db.prepare(`SELECT id,visitor_name,phone,purpose FROM visitor_logs WHERE ${where.join(' AND ')}`).all(...params) as Record<string, unknown>[]).filter((row) => row.phone).map((row) => ({ recipient_type: 'visitor', recipient_id: Number(row.id), recipient_name: String(row.visitor_name), phone: String(row.phone), values: { visitor_name: String(row.visitor_name), purpose: String(row.purpose || ''), school_name: setting('school.name', 'School') } }));
  }

  private log(input: { configurationId: number; recipientType: string; recipientId: number | null; recipientName: string; phone: string; messageType: string; templateCode: string | null; channel: MessageChannel; message: string; result: { status: string; providerResponse?: string; errorMessage?: string }; userId: number; retryOfId?: number }) {
    const result = getDatabase().prepare(`INSERT INTO message_logs (provider_configuration_id,recipient_type,recipient_id,recipient_name,phone_number,message_type,template_code,channel,message,status,error_message,provider_response,retry_of_id,sent_by,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.configurationId, input.recipientType, input.recipientId, input.recipientName, input.phone, input.messageType, input.templateCode, input.channel, input.message, input.result.status, input.result.errorMessage || null, input.result.providerResponse || null, input.retryOfId || null, input.userId || null, input.result.status === 'sent' ? new Date().toISOString() : null);
    return getDatabase().prepare('SELECT * FROM message_logs WHERE id=?').get(result.lastInsertRowid);
  }

  private render(template: string, values: Record<string, string | number>) {
    return template.replace(/\{\{([a-z_]+)\}\}|\{([a-z_]+)\}/gi, (_, doubleKey, singleKey) => String(values[doubleKey || singleKey] ?? ''));
  }

  private parseConfig(value: unknown) { try { return value ? JSON.parse(String(value)) as Record<string, unknown> : {}; } catch { return {}; } }
}
