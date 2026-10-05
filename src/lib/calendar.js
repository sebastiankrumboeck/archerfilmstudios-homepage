export function monthSpan(startISO, endISO, year, month1) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const monthStart = new Date(Date.UTC(year, month1 - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month1, 0, 23, 59, 59, 999));

  if (end < monthStart || start > monthEnd) return null;

  const clampStart = start < monthStart ? monthStart : start;
  const clampEnd = end > monthEnd ? monthEnd : end;
  const startDay = clampStart.getUTCDate();
  const endDay = clampEnd.getUTCDate();
  return { startDay, span: endDay - startDay + 1 };
}

export function buildMailto({ to = 'archerfilmstudios@gmail.com', subject = '', body = '' } = {}) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
