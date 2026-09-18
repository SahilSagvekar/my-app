// src/lib/client-task-name.ts
//
// Single source of truth for the "slug" that goes at the front of a
// generated task title (e.g. the `B&M` in `B&M_09-07-2026_SF1`). This exact
// `companyName.replace(/\s/g, '')` line used to be copied into 5 separate
// title-generation call sites — a client whose full legal name is too long
// or awkward for task titles (e.g. "B&M Marine Construction, Inc.") had no
// way to get a shorter name without editing every call site by hand.
//
// Client.taskNamePrefix is an optional per-client override — set it and
// every future task title (recurring, one-off, extra) uses it instead of
// the auto-slugified companyName. Existing task titles are unaffected by
// setting this; they're a separate one-time backfill.

export function getClientTaskSlug(client: {
  companyName?: string | null;
  name?: string | null;
  taskNamePrefix?: string | null;
}): string {
  if (client.taskNamePrefix && client.taskNamePrefix.trim()) {
    return client.taskNamePrefix.trim();
  }
  const fullName = client.companyName || client.name || 'Client';
  return fullName.replace(/\s/g, '');
}
