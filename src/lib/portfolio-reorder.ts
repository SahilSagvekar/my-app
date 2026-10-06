// lib/portfolio-reorder.ts
// Move-up / move-down for ordered portfolio lists.
//
// The old UI swapped the two items' `order` values. That does nothing when the
// two items share the same value (very common: the add dialog defaults to 0,
// and deleting an item leaves gaps/duplicates), and it never checked whether the
// PATCH calls actually succeeded. This renumbers the whole list by position
// instead and only writes the rows whose position changed.

export async function persistReorder<T extends { id: string; order: number }>(
  sortedList: T[],
  idx: number,
  swapIdx: number,
  urlFor: (id: string) => string
): Promise<void> {
  if (idx < 0 || swapIdx < 0 || idx >= sortedList.length || swapIdx >= sortedList.length) return;

  const next = [...sortedList];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];

  const changed = next
    .map((item, position) => ({ item, position }))
    .filter(({ item, position }) => item.order !== position);

  const results = await Promise.all(
    changed.map(({ item, position }) =>
      fetch(urlFor(item.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: position }),
      })
    )
  );
  if (results.some((r) => !r.ok)) throw new Error('Reorder failed');
}
