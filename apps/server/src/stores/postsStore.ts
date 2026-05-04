/**
 * 記事データストア（メモリモック）
 * Unit-03 では DB を使用せずメモリ上のモックデータを使用する
 * Unit-04 以降で Cloudflare D1 等への移行を想定
 */

import type { Post, PublicUser } from '@repo/shared'

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

/** 内部記事ストレージ */
const posts: Post[] = []

/** ストア初期化フラグ */
let initialized = false

/**
 * モック記事データを初期化する
 * Cloudflare Workers ではトップレベル await を使用できないため、
 * 初回アクセス時に遅延初期化する（パスワードハッシュは不要なので同期でも可だが、
 * usersStore との一貫性のため ensureInitialized パターンを採用）
 */
function ensureInitialized(): void {
  if (initialized) return
  initialized = true

  const admin = MOCK_AUTHORS['user-admin-001'] as PublicUser
  const writer = MOCK_AUTHORS['user-writer-001'] as PublicUser

  posts.push(
    {
      id: 'post-001',
      title: 'Hono × Inertia.js で作るフルスタック Web アプリ',
      body: `# Hono × Inertia.js で作るフルスタック Web アプリ

## はじめに

Hono は Cloudflare Workers 上で動作する超軽量 Web フレームワークです。
Inertia.js と組み合わせることで、API なしにサーバーとクライアントをシームレスに繋ぐことができます。

## 特徴

- **高速**: Cloudflare のグローバルネットワークでエッジから配信
- **型安全**: TypeScript ファーストな設計
- **シンプル**: REST API 不要のサーバードリブン SPA

## まとめ

Hono + Inertia.js + React の組み合わせは、現代的な Web 開発の最適解の一つです。`,
      tags: ['Hono', 'Inertia.js', 'React', 'TypeScript'],
      authorId: 'user-admin-001',
      author: admin,
      createdAt: '2026-04-01T09:00:00Z',
      updatedAt: '2026-04-01T09:00:00Z',
    },
    {
      id: 'post-002',
      title: 'Cloudflare Workers で始めるサーバーレス開発',
      body: `# Cloudflare Workers で始めるサーバーレス開発

## Cloudflare Workers とは

Cloudflare Workers は、Cloudflare のグローバルネットワーク上で JavaScript/TypeScript を実行できる
サーバーレスプラットフォームです。

## なぜ Workers なのか

1. **コールドスタートなし**: V8 エンジンを直接使用するため、コールドスタートがほぼゼロ
2. **グローバル配信**: 世界 300 以上のデータセンターから最も近い場所で実行
3. **コスト効率**: 従量課金で、無料枠も充実

## 開発のポイント

Workers では Node.js API が使えないため、Web Standard API（fetch, crypto 等）を使う必要があります。`,
      tags: ['Cloudflare', 'Workers', 'サーバーレス'],
      authorId: 'user-writer-001',
      author: writer,
      createdAt: '2026-04-05T10:00:00Z',
      updatedAt: '2026-04-05T10:00:00Z',
    },
    {
      id: 'post-003',
      title: 'TypeScript で型安全なアプリケーション開発',
      body: `# TypeScript で型安全なアプリケーション開発

## 型安全の重要性

TypeScript を使うことで、コンパイル時にエラーを検出でき、
実行時のバグを大幅に削減できます。

## Zod で実行時バリデーション

TypeScript の型は実行時には消えてしまいますが、Zod を使うことで
実行時にも型を検証できます。

\`\`\`typescript
import { z } from 'zod'

const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
})

type User = z.infer<typeof UserSchema>
\`\`\`

## まとめ

TypeScript + Zod の組み合わせで、フロントエンドからバックエンドまで
一貫した型安全を実現できます。`,
      tags: ['TypeScript', 'Zod', '型安全'],
      authorId: 'user-admin-001',
      author: admin,
      createdAt: '2026-04-10T11:00:00Z',
      updatedAt: '2026-04-10T11:00:00Z',
    },
    {
      id: 'post-004',
      title: 'React 18 の新機能を使いこなす',
      body: `# React 18 の新機能を使いこなす

## Concurrent Features

React 18 では Concurrent Mode が正式にリリースされました。
これにより、UI の応答性が向上します。

## useTransition

\`useTransition\` を使うことで、重い更新を低優先度で実行できます。

\`\`\`tsx
const [isPending, startTransition] = useTransition()

startTransition(() => {
  setSearchQuery(input)
})
\`\`\`

## Suspense の強化

データフェッチングでも Suspense が使えるようになりました。`,
      tags: ['React', 'React18', 'フロントエンド'],
      authorId: 'user-writer-001',
      author: writer,
      createdAt: '2026-04-15T14:00:00Z',
      updatedAt: '2026-04-15T14:00:00Z',
    },
    {
      id: 'post-005',
      title: 'Tailwind CSS でモダンな UI を構築する',
      body: `# Tailwind CSS でモダンな UI を構築する

## ユーティリティファースト CSS

Tailwind CSS はユーティリティクラスを組み合わせてスタイリングする、
新しいアプローチの CSS フレームワークです。

## メリット

- **一貫性**: デザインシステムに基づいたクラス
- **柔軟性**: カスタマイズが簡単
- **パフォーマンス**: 未使用クラスは本番ビルドで削除される

## レスポンシブデザイン

\`\`\`html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- コンテンツ -->
</div>
\`\`\`

## まとめ

Tailwind CSS は現代の Web 開発に欠かせないツールになっています。`,
      tags: ['Tailwind', 'CSS', 'デザイン'],
      authorId: 'user-admin-001',
      author: admin,
      createdAt: '2026-04-20T16:00:00Z',
      updatedAt: '2026-04-20T16:00:00Z',
    }
  )
}

export const postsStore = {
  /**
   * 全記事を取得する（createdAt 降順）
   * @returns Post の配列
   */
  findAll(): Post[] {
    ensureInitialized()
    return [...posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  },

  /**
   * ID で記事を検索する
   * @param id 検索する記事 ID
   * @returns 見つかった Post または undefined
   */
  findById(id: string): Post | undefined {
    ensureInitialized()
    return posts.find((p) => p.id === id)
  },

  /**
   * 新しい記事を作成する
   * @param data 記事作成入力（title, body, tags）
   * @param author 作成者の PublicUser
   * @returns 作成された Post
   */
  create(data: { title: string; body: string; tags: string[] }, author: PublicUser): Post {
    ensureInitialized()
    const now = new Date().toISOString()
    const newPost: Post = {
      id: `post-${Date.now()}`,
      title: data.title,
      body: data.body,
      tags: data.tags,
      authorId: author.id,
      author,
      createdAt: now,
      updatedAt: now,
    }
    posts.push(newPost)
    return newPost
  },

  /**
   * 記事を更新する
   * @param id 更新する記事 ID
   * @param data 更新データ（部分更新可）
   * @returns 更新された Post または undefined（見つからない場合）
   */
  update(id: string, data: { title?: string; body?: string; tags?: string[] }): Post | undefined {
    ensureInitialized()
    const index = posts.findIndex((p) => p.id === id)
    if (index === -1) return undefined

    const existing = posts[index]
    if (!existing) return undefined

    const updated: Post = {
      ...existing,
      title: data.title ?? existing.title,
      body: data.body ?? existing.body,
      tags: data.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    }
    posts[index] = updated
    return updated
  },

  /**
   * 記事を削除する
   * @param id 削除する記事 ID
   * @returns 削除成功なら true、見つからない場合は false
   */
  delete(id: string): boolean {
    ensureInitialized()
    const index = posts.findIndex((p) => p.id === id)
    if (index === -1) return false
    posts.splice(index, 1)
    return true
  },

  /**
   * モック著者情報を取得する（ルートハンドラーが新規作成時に使用）
   * @param userId ユーザー ID
   * @returns PublicUser または undefined
   */
  getMockAuthor(userId: string): PublicUser | undefined {
    return MOCK_AUTHORS[userId]
  },
}
