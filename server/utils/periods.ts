export type PeriodClock = {
  id: number;
  sequence: number;
  start_time: string;
  end_time: string;
  period_type: string;
};

export function timeToMinutes(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!match) throw new Error('Period time must be in HH:MM format');
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error('Period time must be a valid clock time');
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function durationMinutes(start: string, end: string) {
  let span = timeToMinutes(end) - timeToMinutes(start);
  if (span <= 0) span += 1440;
  return span;
}

/**
 * Rebuild the period clock sequentially from the first period's start time.
 * Lesson periods take the new default duration; breaks/assembly/other keep theirs.
 */
export function applyLessonDuration(periods: PeriodClock[], lessonMinutes: number): PeriodClock[] {
  if (!Number.isFinite(lessonMinutes) || lessonMinutes < 1 || lessonMinutes > 240) {
    throw new Error('Default lesson duration must be between 1 and 240 minutes');
  }
  const ordered = [...periods].sort((left, right) => left.sequence - right.sequence || left.id - right.id);
  if (!ordered.length) return [];
  let cursor = timeToMinutes(ordered[0].start_time);
  return ordered.map((period) => {
    const length = period.period_type === 'lesson'
      ? lessonMinutes
      : Math.max(1, durationMinutes(period.start_time, period.end_time));
    const start = cursor;
    const end = start + length;
    cursor = end;
    return { ...period, start_time: minutesToTime(start), end_time: minutesToTime(end) };
  });
}
