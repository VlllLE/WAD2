/** ISO date string YYYY-MM-DD for "today" in UTC (matches Postgres `date` comparisons). */
export function todayISODateUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether a published course should appear in "current & upcoming" listings.
 * Uses session end times when present; otherwise course date bounds.
 */
export function isCourseCurrentOrUpcoming(
  course: { start_date: string | null; end_date: string | null },
  sessions: { ends_at: string }[],
): boolean {
  const today = todayISODateUtc();
  const now = Date.now();

  if (sessions.length > 0) {
    const anyFuture = sessions.some((s) => new Date(s.ends_at).getTime() >= now);
    if (anyFuture) return true;
    if (course.end_date && course.end_date >= today) return true;
    if (course.start_date && course.start_date > today) return true;
    return false;
  }

  if (course.end_date && course.end_date < today) return false;
  if (course.start_date && course.start_date > today) return true;
  if (course.start_date && course.end_date && course.start_date <= today && course.end_date >= today) return true;
  if (course.start_date && !course.end_date && course.start_date <= today) return true;
  if (!course.start_date && !course.end_date) return true;
  return false;
}

/** Human-readable span between two calendar dates (inclusive of both days). */
export function formatCourseDuration(startDate: string | null, endDate: string | null): string | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T12:00:00.000Z`);
  const end = new Date(`${endDate}T12:00:00.000Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days <= 0) return null;
  if (days % 7 === 0) {
    const w = days / 7;
    return w === 1 ? "1 week" : `${w} weeks`;
  }
  return days === 1 ? "1 day" : `${days} days`;
}

export function splitSessionsByUpcoming<T extends { ends_at: string }>(
  sessions: T[],
): { upcoming: T[]; past: T[] } {
  const now = Date.now();
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const s of sessions) {
    if (new Date(s.ends_at).getTime() >= now) upcoming.push(s);
    else past.push(s);
  }
  upcoming.sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
  past.sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());
  return { upcoming, past };
}

export function isSessionUpcoming(endsAt: string): boolean {
  return new Date(endsAt).getTime() >= Date.now();
}
