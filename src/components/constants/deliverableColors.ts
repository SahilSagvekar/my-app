/**
 * Color coding for deliverable types.
 *
 * Lifted verbatim from QCDashboard so the client-facing Content Review screen
 * uses the same colors staff see internally — a Short Form card should look the
 * same to a client as it does in QC.
 *
 * Note: EditorDashboard still carries its own older copy of this logic with
 * fewer type branches (no Beta Short Form, SQF, thumbnails, or podcasts). It was
 * left alone deliberately — migrating it would change colors on that screen,
 * which is a separate decision.
 */
export interface DeliverableColors {
  bg: string;
  border: string;
  ring: string;
}

export function getDeliverableTypeColor(deliverableType: string): DeliverableColors {
  const type = deliverableType?.toLowerCase() || '';

  // Short Form Videos (green)
  if (type.includes('short form') || type === 'sf' || type === 'short_form') {
    return { bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'ring-emerald-300' };
  }
  // Beta Short Form (teal)
  if (type.includes('beta short form') || type === 'bsf' || type === 'beta_short_form') {
    return { bg: 'bg-teal-50', border: 'border-teal-200', ring: 'ring-teal-300' };
  }
  // SQF - Super Quick Form (cyan)
  if (type === 'sqf' || type.includes('sqf') || type.includes('super quick')) {
    return { bg: 'bg-cyan-50', border: 'border-cyan-200', ring: 'ring-cyan-300' };
  }
  // Snapchat Videos (yellow)
  if (type.includes('snapchat') || type === 'snap') {
    return { bg: 'bg-yellow-50', border: 'border-yellow-200', ring: 'ring-yellow-300' };
  }
  // Long Form Videos (blue)
  if (type.includes('long form') || type === 'lf' || type === 'long_form') {
    return { bg: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-300' };
  }
  // Thumbnails/Images (purple)
  if (type.includes('thumbnail') || type.includes('image')) {
    return { bg: 'bg-purple-50', border: 'border-purple-200', ring: 'ring-purple-300' };
  }
  // Podcasts/Audio (orange)
  if (type.includes('podcast') || type.includes('audio')) {
    return { bg: 'bg-orange-50', border: 'border-orange-200', ring: 'ring-orange-300' };
  }
  // Default
  return { bg: 'bg-white', border: 'border-zinc-100', ring: 'ring-zinc-200' };
}
