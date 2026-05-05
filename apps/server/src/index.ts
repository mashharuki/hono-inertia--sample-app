import { inertia, serializePage } from '@hono/inertia'
import type { RootView } from '@hono/inertia'
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

// Inertia rootView: ASSETS バインディングから index.html を取得し、
// ページデータを注入する。run_worker_first = true により全リクエストが
// ワーカーを経由するため、静的ファイルとして直接配信されなくなった index.html を
// ここで組み立てる。
const rootView: RootView = async (page, c) => {
  const injectSlot =
    `<script type="application/json" data-page="app">${serializePage(page)}</script>\n    <div id="app"></div>`

  try {
    const origin = new URL(c.req.url).origin
    const res = await c.env.ASSETS.fetch(new Request(`${origin}/index.html`))
    if (res.ok) {
      const html = await res.text()
      return html.replace('<div id="app"></div>', injectSlot)
    }
  } catch {
    // ASSETS が利用できない場合（一部のローカル開発環境など）は最小 HTML で継続
  }

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hono Inertia Blog</title>
  </head>
  <body>
    ${injectSlot}
  </body>
</html>`
}

app.use('*', inertia({ rootView }))

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

// 静的アセットフォールバック: run_worker_first = true により全リクエストが
// ワーカーを通るため、Hono ルートで未マッチの /assets/* 等を ASSETS に委譲する。
// ASSETS.fetch() が返す Response はヘッダーがイミュータブルのため、
// new Response() でクローンしてから返す（secureHeaders ミドルウェアが書き込めるよう）
app.all('*', async (c) => {
  try {
    const res = await c.env.ASSETS.fetch(c.req.raw)
    return new Response(res.body, res)
  } catch {
    return c.text('Not Found', 404)
  }
})

export default app
export type AppType = typeof app
