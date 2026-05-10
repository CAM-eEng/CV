import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './content/projects' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    role: z.string(),
    stack: z.array(z.string()),
    dates: z.object({
      start: z.string().regex(/^\d{4}(-\d{2})?$/),
      end: z
        .string()
        .regex(/^\d{4}(-\d{2})?$/)
        .or(z.literal('ongoing')),
    }),
    links: z.object({
      repo: z.string().url().optional(),
      demo: z.string().url().optional(),
    }),
    featured: z.boolean().default(false),
    summary: z.string().min(20).max(200),
  }),
});

export const collections = { projects };
