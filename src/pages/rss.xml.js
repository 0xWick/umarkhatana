import rss from '@astrojs/rss';
import { SITE } from '../data';
import { allPosts } from '../posts';

export async function GET(context) {
  const items = await allPosts();
  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site,
    items: items.map(({ section, p }) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/${section}/${p.id}`,
      categories: [section, ...p.data.tags],
    })),
  });
}
