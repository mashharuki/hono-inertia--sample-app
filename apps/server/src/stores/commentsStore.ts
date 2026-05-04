/**
 * コメントデータストア（メモリモック）
 * Unit-03 では DB を使用せずメモリ上のモックデータを使用する
 * Unit-04 以降で Cloudflare D1 等への移行を想定
 */

import type { Comment, PublicUser } from '@repo/shared'

/** モック著者データ（usersStore に依存しない独立した定義） */
const MOCK_AUTHORS: Record<string, PublicUser> = {
  'user-admin-001': {
    id: 'user-admin-001',
    email: 'admin@example.com',
    displayName: '管理者',
    createdAt: '2026-01-01T00:00:00Z',
  },
  'user-writer-001': {
    id: 'user-writer-001',
    email: 'writer@example.com',
    displayName: 'ライター',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

/** 内部コメントストレージ */
const comments: Comment[] = []

/** ストア初期化フラグ */
let initialized = false

/**
 * モックコメントデータを初期化する
 * Cloudflare Workers ではトップレベル await を使用できないため、
 * 初回アクセス時に遅延初期化する
 */
function ensureInitialized(): void {
  if (initialized) return
  initialized = true

  const admin = MOCK_AUTHORS['user-admin-001'] as PublicUser
  const writer = MOCK_AUTHORS['user-writer-001'] as PublicUser

  comments.push(
    {
      id: 'comment-001',
      body: '素晴らしい記事ですね！Hono と Inertia.js の組み合わせは初めて知りました。早速試してみます。',
      postId: 'post-001',
      authorId: 'user-writer-001',
      author: writer,
      createdAt: '2026-04-01T10:00:00Z',
    },
    {
      id: 'comment-002',
      body: 'Cloudflare Workers のコールドスタートなしというのが特に魅力的ですね。パフォーマンスが重要なサービスに使いたいと思います。',
      postId: 'post-002',
      authorId: 'user-admin-001',
      author: admin,
      createdAt: '2026-04-05T11:00:00Z',
    },
    {
      id: 'comment-003',
      body: 'Zod と TypeScript の組み合わせは本当に強力ですよね。特に API のバリデーションに使うと安心感が違います。',
      postId: 'post-003',
      authorId: 'user-writer-001',
      author: writer,
      createdAt: '2026-04-10T12:00:00Z',
    },
    {
      id: 'comment-004',
      body: 'useTransition の使い方がよくわかりました。検索機能に適用してみたいと思います。',
      postId: 'post-004',
      authorId: 'user-admin-001',
      author: admin,
      createdAt: '2026-04-15T15:00:00Z',
    },
    {
      id: 'comment-005',
      body: 'Tailwind CSS のグリッドレイアウトのサンプルコードがとても参考になりました。レスポンシブデザインがこんなに簡単にできるとは！',
      postId: 'post-005',
      authorId: 'user-writer-001',
      author: writer,
      createdAt: '2026-04-20T17:00:00Z',
    }
  )
}

export const commentsStore = {
  /**
   * 記事 ID でコメントを取得する（createdAt 昇順）
   * @param postId 記事 ID
   * @returns Comment の配列
   */
  findByPostId(postId: string): Comment[] {
    ensureInitialized()
    return comments
      .filter((c) => c.postId === postId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  },

  /**
   * 新しいコメントを作成する
   * @param data コメント作成入力（body, postId）
   * @param author 作成者の PublicUser
   * @returns 作成された Comment
   */
  create(data: { body: string; postId: string }, author: PublicUser): Comment {
    ensureInitialized()
    const now = new Date().toISOString()
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      body: data.body,
      postId: data.postId,
      authorId: author.id,
      author,
      createdAt: now,
    }
    comments.push(newComment)
    return newComment
  },
}
