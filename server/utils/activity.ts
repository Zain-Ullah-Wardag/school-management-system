import { getDatabase } from '../../database';

export function logActivity(userId: number | undefined, action: string, entityType: string, entityId: number | string | undefined, summary: string, meta?: unknown) {
  getDatabase().prepare(`INSERT INTO activity_logs (user_id,action,entity_type,entity_id,summary,meta_json) VALUES (?,?,?,?,?,?)`)
    .run(userId || null, action, entityType, entityId?.toString() || null, summary, meta ? JSON.stringify(meta) : null);
}
