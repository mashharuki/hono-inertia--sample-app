import { inertia } from '@hono/inertia'
import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { authMiddleware } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { commentsRouter } from './routes/comments.js'
import { postsRouter } from './routes/posts.js'
import type { Env } from './types/env.js'

const app = new Hono<Env>()

// ミドルウェア
app.use('*', honoLogger())
app.use('*', secureHeaders())

// 認証ミドルウェア（全ルートに適用: currentUser を設定する）
app.use('*', authMiddleware)

// Inertia アダプタ設定
// @hono/inertia v0.1.0 の InertiaOptions は version? と rootView? のみ
// 共有 props (auth, flash) は各ルートハンドラーで props に含めて返す
app.use('*', inertia())

// 認証ルート: /register, /login, /logout
app.route('/', authRouter)

// ブログ記事ルート: /, /posts/new, /posts, /posts/:id, /posts/:id/edit
// 注意: postsRouter が / (ホームページ) も担当するため authRouter の後に登録
app.route('/', postsRouter)

// コメントルート: /posts/:id/comments
app.route('/', commentsRouter)

// ルート: ダッシュボード
app.get('/dashboard', (c) => {
  return c.render('Dashboard', {})
})

// 静的アセット配信（本番環境: Cloudflare Assets）
// 開発時は @hono/vite-dev-server が担当するため、
// この handler は本番デプロイ時にのみ実質的に動作する

export default app
export type AppType = typeof app
