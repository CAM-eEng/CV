import { readFile } from 'node:fs/promises';
import { ActivitySchema, type Activity } from './schema';

export async function loadActivity(path: string): Promise<Activity> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  const result = ActivitySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`activity.json validation failed at ${path}:\n${result.error.toString()}`);
  }
  return result.data;
}
