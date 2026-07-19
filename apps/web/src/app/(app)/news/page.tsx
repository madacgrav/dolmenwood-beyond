import { fetchPosts, formatWPDate, stripHtml } from '@/lib/wordpress';
import Link from 'next/link';
import Image from 'next/image';
import { SetPageHeader } from '@/components/layout/PageHeaderContext';

export const revalidate = 3600;

export default async function NewsPage() {
  const posts = await fetchPosts();
  const hasWordPress = !!process.env.NEXT_PUBLIC_WORDPRESS_URL;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '5rem' }}>
      <SetPageHeader title="News & Updates" />

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            {
              icon: '📰',
              href: 'https://necroticgnome.com/blogs/news/tagged/dolmenwood',
              title: 'Dolmenwood News',
              desc: 'Latest Dolmenwood posts from the official Necrotic Gnome blog.',
            },
            {
              icon: '✍️',
              href: 'https://necroticgnome.com/blogs/news',
              title: 'Necrotic Gnome Blog',
              desc: 'News from the makers of Dolmenwood and Old-School Essentials.',
            },
            {
              icon: '📖',
              href: 'https://www.dolmenwood.necroticgnome.com/rules/doku.php?id=wiki:welcome',
              title: 'Dolmenwood Wiki',
              desc: 'The official online rules reference — classes, kindreds, magic, and more.',
            },
          ].map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <article style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }} aria-hidden="true">{link.icon}</span>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.1rem', color: 'var(--color-text)', margin: '0 0 0.25rem', lineHeight: 1.3 }}>
                    {link.title} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>↗</span>
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                    {link.desc}
                  </p>
                </div>
              </article>
            </a>
          ))}
        </div>
        {!hasWordPress ? null : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
            No posts found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.map(post => {
              const featuredImg = post._embedded?.['wp:featuredmedia']?.[0];
              const imgUrl = featuredImg?.media_details?.sizes?.medium?.source_url ?? featuredImg?.source_url;
              const author = post._embedded?.author?.[0]?.name ?? 'Staff';
              const excerpt = stripHtml(post.excerpt.rendered).slice(0, 160);

              return (
                <Link key={post.id} href={`/news/${post.slug}`} style={{ textDecoration: 'none' }}>
                  <article style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}>
                    {imgUrl && (
                      <div style={{ position: 'relative', height: '160px', width: '100%' }}>
                        <Image
                          src={imgUrl}
                          alt={featuredImg?.alt_text ?? post.title.rendered}
                          fill
                          style={{ objectFit: 'cover' }}
                          unoptimized
                        />
                      </div>
                    )}
                    <div style={{ padding: '1rem' }}>
                      <h2
                        style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '1.1rem', color: 'var(--color-text)', margin: '0 0 0.5rem', lineHeight: 1.3 }}
                        dangerouslySetInnerHTML={{ __html: post.title.rendered }}
                      />
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                        {excerpt}{excerpt.length === 160 ? '…' : ''}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span>{author}</span>
                        <span>{formatWPDate(post.date)}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
