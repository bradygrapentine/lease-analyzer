// Wave 10 Part C — implementation pending.
export interface StandardClause {
  id: string;
  name: string;
  sourceLeaseId: string;
  sourceParagraphIndex: number;
  normalizedText: string;
  createdAt: number;
}

export interface PromoteInput {
  name: string;
  sourceLeaseId: string;
  sourceParagraphIndex: number;
  normalizedText: string;
}

export const _resetStandardsDbForTests = (): void => {
  throw new Error('_resetStandardsDbForTests: not implemented');
};
export const promoteToStandard = async (
  _input: PromoteInput,
): Promise<StandardClause> => {
  throw new Error('promoteToStandard: not implemented');
};
export const listStandards = async (): Promise<StandardClause[]> => {
  throw new Error('listStandards: not implemented');
};
export const deleteStandard = async (_id: string): Promise<void> => {
  throw new Error('deleteStandard: not implemented');
};
