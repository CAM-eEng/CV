import { z } from 'zod';

const YearOrYearMonth = z.string().regex(/^\d{4}(-\d{2})?$/);

const Skill = z.object({
  name: z.string().min(1),
  last_used: YearOrYearMonth,
  level: z.enum(['Familiar', 'Working', 'Proficient', 'Expert']).optional(),
});

const Category = z.object({
  name: z.string().min(1),
  skills: z.array(Skill).min(1),
});

export const SkillsSchema = z.object({
  categories: z.array(Category).min(1),
});

export type SkillsFile = z.infer<typeof SkillsSchema>;
