import { useCallback, useEffect, useState } from 'react';
import {
  deleteAnnotation,
  listAnnotations,
  saveAnnotation,
  updateAnnotation,
  type Annotation,
} from '../annotations/annotations';

export interface UseAnnotationsApi {
  annotations: Annotation[];
  /** Save an annotation against a paragraph and refresh the list. */
  save: (input: {
    leaseId: string;
    paragraphIndex: number;
    text: string;
  }) => Promise<void>;
  update: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Owns the per-lease annotations list. Loads when `leaseId` changes; clears
 * to `[]` when there is no analyzed lease.
 */
export function useAnnotations(leaseId: string | null): UseAnnotationsApi {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  const refresh = useCallback(async (id: string): Promise<void> => {
    setAnnotations(await listAnnotations(id));
  }, []);

  const save = useCallback<UseAnnotationsApi['save']>(
    async (input) => {
      await saveAnnotation(input);
      await refresh(input.leaseId);
    },
    [refresh],
  );

  const update = useCallback<UseAnnotationsApi['update']>(
    async (id, text) => {
      await updateAnnotation(id, text);
      if (leaseId) await refresh(leaseId);
    },
    [refresh, leaseId],
  );

  const remove = useCallback<UseAnnotationsApi['remove']>(
    async (id) => {
      await deleteAnnotation(id);
      if (leaseId) await refresh(leaseId);
    },
    [refresh, leaseId],
  );

  useEffect(() => {
    if (leaseId) void refresh(leaseId);
    else setAnnotations([]);
  }, [leaseId, refresh]);

  return { annotations, save, update, remove };
}
