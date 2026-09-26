import rss from '@astrojs/rss';
import { SITE } from '../data';
import { posts } from '../posts';

export async function GET(context) {
  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site,
    items: (await posts()).map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/writing/${p.id}`,
      categories: p.data.tags,
    })),
  });
}
