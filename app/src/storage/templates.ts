import { openLeaseDb, randomId, CLAUSE_TEMPLATES_STORE } from './storage';
import type { ClauseTemplate } from '../templates/types';

export interface SaveTemplateInput {
  name: string;
  text: string;
}

export async function saveTemplate(input: SaveTemplateInput): Promise<string> {
  const db = await openLeaseDb();
  const now = Date.now();
  const record: ClauseTemplate = {
    id: randomId(),
    name: input.name,
    text: input.text,
    createdAt: now,
    updatedAt: now,
  };
  await db.put(CLAUSE_TEMPLATES_STORE, record);
  return record.id;
}

export async function listTemplates(): Promise<ClauseTemplate[]> {
  const db = await openLeaseDb();
  const all = await db.getAll(CLAUSE_TEMPLATES_STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getTemplate(id: string): Promise<ClauseTemplate | undefined> {
  const db = await openLeaseDb();
  return db.get(CLAUSE_TEMPLATES_STORE, id);
}

export interface UpdateTemplateInput {
  name?: string;
  text?: string;
}

export async function updateTemplate(id: string, patch: UpdateTemplateInput): Promise<void> {
  const db = await openLeaseDb();
  const existing = await db.get(CLAUSE_TEMPLATES_STORE, id);
  if (!existing) throw new Error(`template ${id} not found`);
  if (patch.name !== undefined) existing.name = patch.name;
  if (patch.text !== undefined) existing.text = patch.text;
  existing.updatedAt = Date.now();
  await db.put(CLAUSE_TEMPLATES_STORE, existing);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await openLeaseDb();
  await db.delete(CLAUSE_TEMPLATES_STORE, id);
}
