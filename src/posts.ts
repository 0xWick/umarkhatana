import { getCollection } from 'astro:content';

export type Section = 'writing' | 'essays';

// Published posts in a section, newest first. Drafts show in dev only.
export async function posts(section: Section) {
  const all = await getCollection(section, ({ data }) => !import.meta.env.PROD || !data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function allPosts() {
  const [w, e] = await Promise.all([posts('writing'), posts('essays')]);
  return [...w.map((p) => ({ section: 'writing' as const, p })), ...e.map((p) => ({ section: 'essays' as const, p }))]
    .sort((a, b) => b.p.data.date.valueOf() - a.p.data.date.valueOf());
}
