import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import type { SharedProps } from '@repo/shared'

// Cloudflare Workers 環境変数の型
type Env = {
  Bindings: {
    ASSETS: Fetcher
    ENVIRONMENT: string
  }
  Variables: {
    user: SharedProps['auth']['user']
  }
}

const app = new Hono<Env>()

// ミドルウェア
app.use('*', logger())
app.use('*', secureHeaders())

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
          user: c.var.user ?? null,
        },
        flash: {
          success: undefined,
          error: undefined,
        },
      }
    },
  })
)

// ルート: ホームページ
app.get('/', (c) => {
  return c.render('Home', {
    message: 'Hono × Inertia.js × React ブログサイトへようこそ！',
  })
})

// 静的アセット配信（本番環境: Cloudflare Assets）
// 開発時は @hono/vite-dev-server が担当するため、
// この handler は本番デプロイ時にのみ実質的に動作する

// TODO: Unit-02 で認証ルートを追加
// TODO: Unit-03 でブログ記事・コメントルートを追加

export default app
export type AppType = typeof app
