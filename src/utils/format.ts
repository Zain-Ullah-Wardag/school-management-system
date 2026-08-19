export const money = (value: number | string | null | undefined) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(value || 0));
export const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`)) : '—';
export const fullName = (item: { first_name?: string | null; last_name?: string | null; full_name?: string | null }) => [item.first_name, item.last_name].filter(Boolean).join(' ') || item.full_name || '—';
export const initials = (name?: string | null) => (name || '?').split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
export const classLabel = (item: { class_name?: string | null; section_name?: string | null }) => [item.class_name, item.section_name].filter(Boolean).join(' · ') || 'Not assigned';

/**
 * Date inputs must use the browser's local school-day rather than UTC. Calling
 * Date#toISOString directly shows yesterday in Pakistan during the evening.
 */
export const todayInput = (value = new Date()) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
export const currentMonthInput = (value = new Date()) => todayInput(value).slice(0, 7);
