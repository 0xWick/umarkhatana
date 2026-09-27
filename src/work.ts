import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'work'>;

/** Every project, in the order they're shown. */
export async function projects(): Promise<Project[]> {
  return (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
}

export const projectUrl = (p: Project) => `/work/${p.id}`;
