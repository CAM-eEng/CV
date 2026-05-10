import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';
import { SkillsSchema, type SkillsFile } from './skills-schema';

export async function loadSkills(path: string): Promise<SkillsFile> {
  const raw = await readFile(path, 'utf8');
  const parsed = yaml.load(raw);
  const result = SkillsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`skills.yaml validation failed at ${path}:\n${result.error.toString()}`);
  }
  return result.data;
}
