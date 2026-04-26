import { fetchPost, formatWPDate } from '@/lib/wordpress';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export const revalidate = 3600;

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const featuredImg = post._embedded?.['wp:featuredmedia']?.[0];
  const imgUrl = featuredImg?.source_url;
  const author = post._embedded?.author?.[0]?.name ?? 'Staff';

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '5rem' }}>
      {/* Back button */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        <Link
          href="/news"
          style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          ← Back to News
        </Link>
      </div>

      {imgUrl && (
        <div style={{ position: 'relative', height: '200px', width: '100%' }}>
          <Image
            src={imgUrl}
            alt={featuredImg?.alt_text ?? ''}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        </div>
      )}

      <div style={{ padding: '1.5rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
        <h1
          style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', fontSize: '1.75rem', margin: '0 0 0.5rem', lineHeight: 1.25 }}
          dangerouslySetInnerHTML={{ __html: post.title.rendered }}
        />
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          {author} · {formatWPDate(post.date)}
        </div>

        {/* WordPress content rendered as HTML */}
        <div
          className="wp-content"
          dangerouslySetInnerHTML={{ __html: post.content.rendered }}
          style={{ color: 'var(--color-text)', lineHeight: 1.7, fontSize: '1rem' }}
        />
      </div>
    </div>
  );
}
