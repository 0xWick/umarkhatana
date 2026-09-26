import { getCollection } from 'astro:content';

// Published posts, newest first. Drafts show in dev only.
export async function posts() {
  const all = await getCollection('writing', ({ data }) => !import.meta.env.PROD || !data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
