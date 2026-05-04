/**
 * 共有型定義
 * サーバー・クライアント双方で使用する型
 */

/** ユーザー（内部表現 - パスワードハッシュを含む） */
export type User = {
  id: string
  email: string
  displayName: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

/** パブリックユーザー（クライアントに安全に渡せる型） */
export type PublicUser = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

/** ブログ記事 */
export type Post = {
  id: string
  title: string
  body: string
  tags: string[]
  authorId: string
  author: PublicUser
  createdAt: string
  updatedAt: string
}

/** コメント */
export type Comment = {
  id: string
  body: string
  postId: string
  authorId: string
  author: PublicUser
  createdAt: string
}

/** ページネーション情報 */
export type Pagination = {
  currentPage: number
  totalPages: number
  totalCount: number
  perPage: number
}

/** 記事一覧レスポンス */
export type PostsPage = {
  posts: Post[]
  pagination: Pagination
}

/** Inertia 共有 Props（全ページで利用可能） */
export type SharedProps = {
  auth: {
    user: PublicUser | null
  }
  flash: {
    success?: string
    error?: string
  }
}
