// Blog content access: the generated module is the source of truth, so these
// tests read the real committed data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPost, publishedPosts } from '../lib/blog.js';

test('publishedPosts lists the launch posts, published only, newest first', () => {
  const posts = publishedPosts();
  assert.ok(posts.length >= 3, `expected the launch posts, got ${posts.length}`);
  for (const p of posts) {
    assert.equal(p.status, 'published');
    assert.ok(p.title.length > 0);
    assert.ok(p.html.includes('<'), 'posts ship pre-rendered html');
  }
  for (let i = 1; i < posts.length; i++) {
    assert.ok(posts[i - 1].date >= posts[i].date, 'sorted newest first');
  }
});

test('getPost returns a post by slug with rendered html', () => {
  const post = getPost('2026-09-12-a-new-look-for-runs-on-dev');
  assert.equal(post.title, 'A new look for runs-on.dev');
  assert.ok(post.html.includes('<h2>'), 'markdown rendered to headings');
  assert.ok(post.html.includes('<p>'), 'paragraphs rendered');
});

test('unknown, invalid, and draft slugs resolve to null', () => {
  assert.equal(getPost('no-such-post'), null);
  // Traversal attempts: the slug grammar admits no separators, so getPost
  // cannot be walked out of the generated content.
  for (const slug of ['../secret', 'a/b', '..', 'UPPER', '']) {
    assert.equal(getPost(slug), null, slug);
  }
});
