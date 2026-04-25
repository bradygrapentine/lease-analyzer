import { useCallback, useEffect, useState } from 'react';
import {
  deleteAnnotation as storageDelete,
  listAnnotations,
  saveAnnotation,
  updateAnnotation,
  type Annotation,
} from '../annotations/annotations';

export interface UseAnnotationsApi {
  annotations: Annotation[];
  saveForParagraph: (paragraphIndex: number, text: string) => Promise<void>;
  update: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Annotations CRUD scoped to a single analyzed lease. Auto-loads when
 * `leaseId` becomes non-null and clears when it returns to null. Lifted out
 * of `App.tsx` so the panel's lifecycle isn't tangled with pack management,
 * versioning, etc.
 */
export function useAnnotations(leaseId: string | null): UseAnnotationsApi {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!leaseId) {
      setAnnotations([]);
      return;
    }
    setAnnotations(await listAnnotations(leaseId));
  }, [leaseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveForParagraph = useCallback(
    async (paragraphIndex: number, text: string): Promise<void> => {
      if (!leaseId) return;
      await saveAnnotation({ leaseId, paragraphIndex, text });
      await refresh();
    },
    [leaseId, refresh],
  );

  const update = useCallback(
    async (id: string, text: string): Promise<void> => {
      await updateAnnotation(id, text);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await storageDelete(id);
      await refresh();
    },
    [refresh],
  );

  return { annotations, saveForParagraph, update, remove, refresh };
}
