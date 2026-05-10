/**
 * Vitest mock for the `astro:content` virtual module.
 *
 * The real `astro:content` is provided by Astro's build pipeline and is not
 * resolvable in vitest's node environment. This mock reads the same MDX
 * sources from `content/projects/` and parses YAML frontmatter so endpoint
 * tests exercise real data shapes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

type CollectionEntry<T> = { id: string; data: T; body: string };

function parseFrontmatter(raw: string): { data: unknown; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  return { data: yaml.load(match[1]) ?? {}, body: match[2] ?? '' };
}

export async function getCollection(name: string): Promise<CollectionEntry<unknown>[]> {
  if (name !== 'projects') {
    throw new Error(`astro:content mock does not know collection "${name}"`);
  }
  const dir = resolve(process.cwd(), 'content/projects');
  const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));
  return files.map((file) => {
    const raw = readFileSync(join(dir, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    return { id: file.replace(/\.mdx$/, ''), data, body };
  });
}
