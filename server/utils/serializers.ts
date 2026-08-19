export const nullable = (value: unknown) => value === '' || value === undefined ? null : value;
export const integer = (value: unknown) => value === '' || value === undefined || value === null ? null : Number(value);
export const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
export const bool = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true';

const fallbackTimeZone = 'Asia/Karachi';

function activeTimeZone() {
  const candidate = process.env.SCHOOL_TIMEZONE || fallbackTimeZone;
  try {
    // Validate once by constructing the formatter. Settings currently expose
    // Asia/Karachi and UTC; the fallback also protects API imports/config files.
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch {
    return fallbackTimeZone;
  }
}

/** Returns the school-local calendar date, not the server's UTC date. */
export const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: activeTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

// Timestamps remain UTC ISO instants; only business-date comparisons use today().
export const now = () => new Date().toISOString();
