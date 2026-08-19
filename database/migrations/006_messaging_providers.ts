import type Database from 'better-sqlite3';

export const up = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messaging_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL CHECK(provider_type IN ('disabled','gsm_modem','sms_gateway_api','android_sms_gateway','whatsapp_business_api')),
      is_system INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS provider_configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL REFERENCES messaging_providers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      is_enabled INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK(connection_status IN ('connected','disconnected','error','unknown')),
      last_connected_at TEXT,
      last_tested_at TEXT,
      last_error TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_default_messaging_provider ON provider_configurations(is_default) WHERE is_default = 1;
    CREATE TABLE IF NOT EXISTS messaging_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messaging_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'auto' CHECK(channel IN ('sms','whatsapp','auto')),
      body TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_configuration_id INTEGER REFERENCES provider_configurations(id) ON DELETE SET NULL,
      recipient_type TEXT NOT NULL DEFAULT 'student',
      recipient_id INTEGER,
      recipient_name TEXT,
      phone_number TEXT NOT NULL,
      message_type TEXT,
      template_code TEXT,
      channel TEXT NOT NULL DEFAULT 'sms' CHECK(channel IN ('sms','whatsapp','auto')),
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','delivered')),
      error_message TEXT,
      provider_response TEXT,
      retry_of_id INTEGER REFERENCES message_logs(id) ON DELETE SET NULL,
      sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT,
      delivered_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_message_logs_created ON message_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_message_logs_provider ON message_logs(provider_configuration_id,status);
    INSERT OR IGNORE INTO messaging_providers (code,name,provider_type,is_system) VALUES
      ('disabled','Disabled','disabled',1),
      ('gsm_modem','GSM Modem (Local SIM)','gsm_modem',1),
      ('sms_gateway_api','SMS Gateway API','sms_gateway_api',1),
      ('android_sms_gateway','Android SMS Gateway','android_sms_gateway',1),
      ('whatsapp_business_api','WhatsApp Business Cloud API','whatsapp_business_api',1);
    INSERT OR IGNORE INTO provider_configurations (id,provider_id,name,config_json,is_enabled,is_default,connection_status)
      SELECT 1,id,'Disabled','{}',1,1,'disconnected' FROM messaging_providers WHERE code='disabled';
    INSERT OR IGNORE INTO messaging_templates (code,name,category,channel,body,is_active) VALUES
      ('attendance','Attendance Alert','attendance','auto','Dear Parent, {{student_name}} attendance update: {{status}} on {{date}}.',1),
      ('fee_reminder','Fee Reminder','fee_reminder','sms','Dear Parent, the fee of Rs. {{due_amount}} for {{student_name}} ({{class}} - {{section}}) is pending. Regards, {{school_name}}.',1),
      ('fee_received','Fee Received','fee_received','sms','Dear Parent, payment of Rs. {{amount}} for {{student_name}} has been received. Regards, {{school_name}}.',1),
      ('exam_schedule','Exam Schedule','exam_schedule','auto','Exam schedule: {{exam_name}} on {{date}} for {{student_name}}.',1),
      ('exam_result','Exam Result','exam_result','auto','{{student_name}} result: {{percentage}}% ({{grade}}). Regards, {{school_name}}.',1),
      ('homework','Homework','homework','auto','Homework notice for {{student_name}}: {{message}}',1),
      ('holiday_notice','Holiday Notice','holiday_notice','auto','{{school_name}} notice: {{message}}',1),
      ('emergency_alert','Emergency Alert','emergency_alert','auto','URGENT: {{message}}',1),
      ('birthday_wishes','Birthday Wishes','birthday_wishes','auto','Happy Birthday {{student_name}}! Regards, {{school_name}}.',1),
      ('admission_confirmation','Admission Confirmation','admission_confirmation','sms','Welcome {{student_name}}. Your admission at {{school_name}} has been confirmed.',1);
    INSERT OR IGNORE INTO messaging_templates (code,name,category,channel,body,is_active)
      SELECT code,name,code,'sms',body,CASE WHEN status='active' THEN 1 ELSE 0 END FROM sms_templates;
    INSERT OR IGNORE INTO provider_configurations (provider_id,name,config_json,is_enabled,is_default,connection_status)
      SELECT p.id,COALESCE(s.provider_name,'Legacy SMS Gateway'),json_object('provider_name',s.provider_name,'api_url',s.api_url,'api_key',s.api_key,'sender_id',s.sender_id),s.is_enabled,0,'disconnected'
      FROM sms_gateway_settings s JOIN messaging_providers p ON p.code='sms_gateway_api' WHERE s.is_enabled=1;
    INSERT OR IGNORE INTO message_logs (recipient_type,recipient_id,recipient_name,phone_number,message_type,template_code,channel,message,status,error_message,provider_response,sent_by,created_at,sent_at)
      SELECT 'student',student_id,NULL,phone,template_code,template_code,channel,message,status,
        CASE WHEN status='failed' THEN provider_response ELSE NULL END,provider_response,sent_by,created_at,sent_at
      FROM sms_logs;
  `);
};
