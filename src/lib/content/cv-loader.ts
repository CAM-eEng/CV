import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { CVSchema, type CV } from './cv-schema';

export async function loadCV(path: string): Promise<CV> {
  const raw = await readFile(path, 'utf8');
  const parsed = yaml.load(raw);
  const result = CVSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`cv.yaml validation failed at ${path}:\n${result.error.toString()}`);
  }
  return result.data;
}
