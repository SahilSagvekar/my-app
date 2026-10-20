/**
 * Canonical deliverable types for filter dropdowns.
 *
 * The same deliverable type is stored under several spellings: short codes
 * ("LF"), long labels ("Long Form Videos") and underscored values
 * ("long_form_videos"). Dropdowns use groupDeliverableTypes() to show ONE
 * option per type, labelled like "Long Form Videos (LF)". The option's value
 * is the canonical code ("LF"); the API expands that code back to every stored
 * spelling with canonicalDeliverableCode(), so no tasks are missed.
 */

export type DeliverableGroup = { code: string; label: string };

// Display order of the grouped options.
export const DELIVERABLE_GROUPS: DeliverableGroup[] = [
  { code: 'SF', label: 'Short Form Videos (SF)' },
  { code: 'LF', label: 'Long Form Videos (LF)' },
  { code: 'SQF', label: 'Square Form Videos (SQF)' },
  { code: 'BSF', label: 'Beta Short Form (BSF)' },
  { code: 'SEP', label: 'Snapchat Episodes (SEP)' },
  { code: 'ST', label: 'Stories (ST)' },
  { code: 'HP', label: 'Hard Posts / Graphic Images (HP)' },
  { code: 'TP', label: 'Text Post (TP)' },
];

/** Maps any stored spelling of a deliverable type to its canonical code, or null if unrecognised. */
export function canonicalDeliverableCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return null;

  switch (key) {
    case 'bsf': return 'BSF';
    case 'sqf': return 'SQF';
    case 'sf': return 'SF';
    case 'lf': return 'LF';
    case 'sep': return 'SEP';
    case 'st': return 'ST';
    case 'hp': return 'HP';
    case 'tp': return 'TP';
  }

  // Order matters: "Beta Short Form" must win over "Short Form".
  if (key.includes('beta')) return 'BSF';
  if (key.includes('square') || key.includes('superquick')) return 'SQF';
  if (key.includes('short')) return 'SF';
  if (key.includes('long')) return 'LF';
  if (key.includes('snap')) return 'SEP';
  if (key.includes('stor')) return 'ST';
  if (key.includes('hardpost') || key.includes('graphic')) return 'HP';
  if (key.includes('textpost')) return 'TP';
  return null;
}

/**
 * One dropdown option per deliverable type that actually exists in `rawTypes`.
 * Recognised types come first in a fixed order; anything unrecognised is kept
 * as its own option (value = the raw string) after them.
 */
export function groupDeliverableTypes(rawTypes: string[]): { value: string; label: string }[] {
  const present = new Set<string>();
  const others = new Set<string>();
  for (const raw of rawTypes) {
    if (!raw) continue;
    const code = canonicalDeliverableCode(raw);
    if (code) present.add(code);
    else others.add(raw);
  }
  return [
    ...DELIVERABLE_GROUPS.filter((g) => present.has(g.code)).map((g) => ({ value: g.code, label: g.label })),
    ...Array.from(others)
      .sort((a, b) => a.localeCompare(b))
      .map((raw) => ({ value: raw, label: raw.replace(/_/g, ' ') })),
  ];
}