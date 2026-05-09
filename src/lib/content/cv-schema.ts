import { z } from 'zod';

const DateString = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Expected YYYY, YYYY-MM, or YYYY-MM-DD');

const Profile = z.object({
  network: z.string(),
  username: z.string(),
  url: z.string().url(),
});

const Location = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  countryCode: z.string().length(2),
});

const Basics = z.object({
  name: z.string().min(1),
  label: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  url: z.string().url(),
  summary: z.string(),
  location: Location,
  profiles: z.array(Profile),
  image: z.string().optional(),
});

const Work = z.object({
  name: z.string(),
  position: z.string(),
  url: z.string().url().optional(),
  startDate: DateString,
  endDate: DateString.optional(),
  summary: z.string(),
  highlights: z.array(z.string()),
});

const Education = z.object({
  institution: z.string(),
  url: z.string().url().optional(),
  area: z.string(),
  studyType: z.string(),
  startDate: DateString,
  endDate: DateString.optional(),
  score: z.string().optional(),
  courses: z.array(z.string()).optional(),
});

const Skill = z.object({
  name: z.string(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']).optional(),
  keywords: z.array(z.string()),
});

const Project = z.object({
  name: z.string(),
  description: z.string(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  startDate: DateString.optional(),
  endDate: DateString.optional(),
  url: z.string().url().optional(),
  roles: z.array(z.string()).optional(),
  entity: z.string().optional(),
  type: z.string().optional(),
  featured: z.boolean().optional(),
});

export const CVSchema = z.object({
  basics: Basics,
  work: z.array(Work),
  education: z.array(Education),
  skills: z.array(Skill),
  projects: z.array(Project),
  awards: z
    .array(
      z.object({
        title: z.string(),
        date: DateString,
        awarder: z.string(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  certificates: z
    .array(
      z.object({
        name: z.string(),
        date: DateString,
        issuer: z.string(),
        url: z.string().url().optional(),
      }),
    )
    .optional(),
  publications: z
    .array(
      z.object({
        name: z.string(),
        publisher: z.string(),
        releaseDate: DateString,
        url: z.string().url().optional(),
        summary: z.string().optional(),
      }),
    )
    .optional(),
  languages: z
    .array(
      z.object({
        language: z.string(),
        fluency: z.string(),
      }),
    )
    .optional(),
  interests: z
    .array(
      z.object({
        name: z.string(),
        keywords: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export type CV = z.infer<typeof CVSchema>;
