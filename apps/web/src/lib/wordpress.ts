const WP_BASE_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL ?? '';

export interface WPPost {
  id: number;
  date: string;
  slug: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  link: string;
  _embedded?: {
    author?: Array<{ name: string; avatar_urls?: Record<string, string> }>;
    'wp:featuredmedia'?: Array<{
      source_url: string;
      alt_text: string;
      media_details?: { sizes?: { medium?: { source_url: string } } };
    }>;
  };
}

export async function fetchPosts(page = 1, perPage = 10): Promise<WPPost[]> {
  if (!WP_BASE_URL) return [];
  try {
    const res = await fetch(
      `${WP_BASE_URL}/wp-json/wp/v2/posts?_embed&per_page=${perPage}&page=${page}`,
      { next: { revalidate: 3600 } } // cache 1 hour
    );
    if (!res.ok) return [];
    return res.json() as Promise<WPPost[]>;
  } catch {
    return [];
  }
}

export async function fetchPost(slug: string): Promise<WPPost | null> {
  if (!WP_BASE_URL) return null;
  try {
    const res = await fetch(
      `${WP_BASE_URL}/wp-json/wp/v2/posts?slug=${slug}&_embed`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const posts = (await res.json()) as WPPost[];
    return posts[0] ?? null;
  } catch {
    return null;
  }
}

export function formatWPDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
