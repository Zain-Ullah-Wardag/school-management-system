/**
 * Marks are stored as REAL values, so decimals are intentionally supported.
 * Keep this client-side message identical to the API rule wherever possible.
 */
export function obtainedMarksError(value: unknown, totalMarks: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const total = Number(totalMarks);
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 'Obtained marks must be a valid number.';
  if (parsed < 0) return 'Obtained marks cannot be negative.';
  if (Number.isFinite(total) && parsed > total) {
    const label = Number.isInteger(total) ? String(total) : String(Number(total.toFixed(2)));
    return `Obtained marks cannot exceed total marks (${label}).`;
  }
  return undefined;
}

export function hasInvalidObtainedMarks(rows: Array<{ obtained_marks?: unknown }>, totalMarks: unknown) {
  return rows.some((row) => Boolean(obtainedMarksError(row.obtained_marks, totalMarks)));
}
