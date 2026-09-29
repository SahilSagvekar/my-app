// Shared deliverable label/colour logic for task cards (mirrors the badge on
// the QC review cards so other screens can show the same pill).

export function getDeliverableBadge(
  rawType?: string | null,
  taskTitle?: string | null
): { label: string; colorClass: string } | null {
  let lower = (rawType || '').toLowerCase().trim();
  const t = (taskTitle || '').toLowerCase();

  // Title codes win over the generic type: BSF/SQF before plain SF.
  if (/(?:^|[_\-\s])bsf\d*(?:[_\-\s]|$)/i.test(t) || t.includes('beta short form')) {
    lower = 'bsf';
  } else if (/(?:^|[_\-\s])sqf\d*(?:[_\-\s]|$)/i.test(t) || t.includes('square form') || t.includes('super quick')) {
    lower = 'sqf';
  } else if (!lower && /(?:^|[_\-\s])lf\d*(?:[_\-\s]|$)/i.test(t)) {
    lower = 'lf';
  } else if (!lower && /(?:^|[_\-\s])sf\d*(?:[_\-\s]|$)/i.test(t)) {
    lower = 'sf';
  }

  if (!lower || lower === 'other') return null;
  let label = (rawType || '').toUpperCase();
  if (lower === 'bsf' || lower.includes('beta')) {
    label = 'BETA SHORT FORM';
  } else if (lower === 'sqf' || lower.includes('square') || lower.includes('super quick')) {
    label = 'SQUARE FORM';
  } else if (lower === 'sf' || lower.includes('short form')) {
    label = 'SHORT FORM';
  } else if (lower === 'lf' || lower.includes('long form')) {
    label = 'LONG FORM';
  } else if (lower === 'hp' || lower.includes('hard post') || lower.includes('graphic image')) {
    label = 'HARD POST';
  } else if (lower.includes('text post')) {
    label = 'TEXT POST';
  } else if (lower.includes('snap')) {
    label = 'SNAPCHAT';
  } else if (lower.includes('podcast') || lower.includes('audio')) {
    label = 'PODCAST';
  } else if (lower.includes('thumb') || lower.includes('image')) {
    label = 'THUMBNAIL';
  }

  let colorClass = 'bg-[#dcfce7] text-[#15803d]';
  if (lower.includes('beta') || lower.includes('bsf')) {
    colorClass = 'bg-[#ccfbf1] text-[#0f766e]';
  } else if (lower.includes('long') || lower === 'lf') {
    colorClass = 'bg-[#dbeafe] text-[#1d4ed8]';
  } else if (lower.includes('snap')) {
    colorClass = 'bg-[#fef9c3] text-[#a16207]';
  } else if (lower.includes('thumb') || lower.includes('image') || lower === 'hp' || lower.includes('hard post')) {
    colorClass = 'bg-[#f3e8ff] text-[#7e22ce]';
  } else if (lower.includes('audio') || lower.includes('podcast')) {
    colorClass = 'bg-[#ffedd5] text-[#c2410c]';
  } else if (lower.includes('text post')) {
    colorClass = 'bg-[#e0e7ff] text-[#4338ca]';
  }

  return { label, colorClass };
}

export function isLongFormTask(deliverableType?: string | null, taskCategory?: string | null, title?: string | null): boolean {
  const raw = (deliverableType || taskCategory || '').toLowerCase().trim();
  if (raw.includes('long form') || raw === 'lf' || raw.includes('long_form') || raw.includes('long-form')) return true;
  return /(?:^|[_\-\s])lf\d*(?:[_\-\s]|$)/i.test((title || '').toLowerCase());
}
