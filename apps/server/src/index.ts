import { inertia } from '@hono/inertia'
import type { SharedProps } from '@repo/shared'
import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { authMiddleware } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import type { Env } from './types/env.js'

const app = new Hono<Env>()

// ミドルウェア
app.use('*', honoLogger())
app.use('*', secureHeaders())

// 認証ミドルウェア（全ルートに適用: currentUser を設定する）
app.use('*', authMiddleware)

// Inertia アダプタ設定
// 共有 props（全ページで利用可能）をここで定義する
app.use(
  '*',
  inertia({
    // クライアントビルドの index.html パス（public/ 配下）
    html: async (c) => {
      // 開発時は Vite が提供する HTML を使用
      // 本番時は apps/server/public/index.html を使用
      return c.env.ASSETS?.fetch(new Request(c.req.url))
    },
    // Inertia 共有 props
    sharedProps: async (c): Promise<SharedProps> => {
      return {
        auth: {
          user: c.var.currentUser ?? null,
        },
        flash: {
          success: undefined,
          error: undefined,
        },
      }
    },
  })
)

// 認証ルート: /register, /login, /logout
app.route('/', authRouter)

// ルート: ホームページ
app.get('/', (c) => {
  return c.render('Home', {
    message: 'Hono × Inertia.js × React ブログサイトへようこそ！',
  })
})

// ルート: ダッシュボード
app.get('/dashboard', (c) => {
  return c.render('Dashboard', {})
})

// 静的アセット配信（本番環境: Cloudflare Assets）
// 開発時は @hono/vite-dev-server が担当するため、
// この handler は本番デプロイ時にのみ実質的に動作する

// TODO: Unit-03 でブログ記事・コメントルートを追加

export default app
export type AppType = typeof app
