export function isHardPostTask(task: any): boolean {
  if (!task) return false;
  const type = (task.deliverableType || task.taskType || '').toLowerCase();
  return type.includes('hard post') || type.includes('graphic image');
}

/**
 * Sorts task image files using an explicit imageOrder (array of file IDs).
 * Files not present in imageOrder are placed at the end sorted chronologically by uploadedAt.
 */
export function sortTaskImages<T extends { id: string; uploadedAt?: any }>(
  files: T[],
  imageOrder?: string[] | null
): T[] {
  if (!files || files.length === 0) return [];
  const cloned = [...files];

  if (Array.isArray(imageOrder) && imageOrder.length > 0) {
    const orderMap = new Map<string, number>(
      imageOrder.map((id, index) => [id, index])
    );

    return cloned.sort((a, b) => {
      const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : -1;
      const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : -1;

      if (aIdx !== -1 && bIdx !== -1) {
        return aIdx - bIdx;
      }
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;

      const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return aTime - bTime;
    });
  }

  return cloned.sort((a, b) => {
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return aTime - bTime;
  });
}
