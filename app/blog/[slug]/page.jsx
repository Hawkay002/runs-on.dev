import { notFound } from 'next/navigation';
import { getPost, publishedPosts, BLOG_POSTS } from '../../../lib/blog.js';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return publishedPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: 'Not found' };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://runs-on.dev/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: { card: 'summary', title: post.title, description: post.description },
  };
}

const CATEGORY_LABEL = { announcement: 'Announcement', feature: 'Feature', engineering: 'Engineering', guide: 'Guide' };

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  // eslint-disable-next-line no-console
  console.log('[blog-debug]', JSON.stringify({ slug, found: Boolean(post), slugs: BLOG_POSTS.map((x) => x.slug).slice(0, 3) }));
  if (!post) notFound();

  const html = post.html;
  const d = new Date(post.date);
  const date = `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()}, ${d.getFullYear()}`;
  const updated = post.updated ? new Date(post.updated).toISOString() : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: updated ?? post.date,
    author: { '@type': 'Organization', name: post.author, url: 'https://advancelabs.dev' },
    mainEntityOfPage: `https://runs-on.dev/blog/${post.slug}`,
    keywords: post.tags.join(', '),
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="meta">
        {CATEGORY_LABEL[post.category] ?? post.category} · {post.date}
      </p>
      <h1 className="mt-3 text-[34px] leading-[1.08] font-normal tracking-[-0.005em] text-(--color-ink) sm:text-[44px] sm:tracking-[-0.007em]">
        {post.title}
      </h1>
      <p className="mt-4 text-[16px] leading-[1.5] text-(--color-muted)">{post.description}</p>
      <p className="meta mt-5">
        by {post.author} · published {date}
        {updated && ` · updated ${new Date(updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
      </p>

      <article
        className="post-prose mt-10"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="slit-top mt-16 pt-8">
        <p className="meta">More</p>
        <p className="mt-3 text-sm">
          <a className="text-(--color-ink) underline" href="/blog">All updates</a>
          {' · '}
          <a className="text-(--color-ink) underline" href="/feed.xml">RSS</a>
          {' · '}
          <a className="text-(--color-ink) underline" href="/stats">Registry stats</a>
        </p>
      </div>
    </main>
  );
}
