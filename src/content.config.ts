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

export const collections = {
  writing: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/writing' }), schema }),
  essays: defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/essays' }), schema }),
};
