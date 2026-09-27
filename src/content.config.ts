import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const schema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const link = z.object({ url: z.string(), label: z.string() });

// One file per project: frontmatter for cards and metadata, the body for the project page.
const work = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      headline: z.string(),
      summary: z.string().max(170),
      role: z.string(),
      year: z.string(),
      order: z.number(),
      featured: z.boolean().default(false),
      categories: z.array(z.enum(['AI', 'Blockchain', 'Full-stack'])).min(1),
      stack: z.array(z.string()),
      problem: z.string(),
      outcome: z.string(),
      live: link.optional(),
      code: z.string().url().optional(),
      extra: link.optional(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      coverFit: z.enum(['cover', 'contain']).default('cover'),
      gallery: z.array(z.object({ src: image(), alt: z.string(), caption: z.string().optional() })).default([]),
    }),
});

// Essays live on the Quartz site at essays.umarkhatana.com, not here.
export const collections = {
  writing: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/writing' }), schema }),
  work,
};
