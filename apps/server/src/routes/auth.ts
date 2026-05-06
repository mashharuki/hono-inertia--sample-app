/**
 * 認証ルートハンドラー
 * - GET  /register  → 登録ページ表示
 * - POST /register  → ユーザー登録処理
 * - GET  /login     → ログインページ表示
 * - POST /login     → ログイン認証処理
 * - POST /logout    → ログアウト処理
 */

import { loginSchema, registerSchema } from '@repo/shared'
import { Hono } from 'hono'
import { hashPassword, verifyPassword } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { parseBody } from '../lib/parseBody.js'
import { buildClearSessionCookie, buildSessionCookie, createSession } from '../lib/session.js'
import { validateEnv } from '../middleware/validateEnv.js'
import { usersStore } from '../stores/usersStore.js'
import type { Env } from '../types/env.js'

const authRouter = new Hono<Env>()

/** GET /register - 登録ページ表示 */
authRouter.get('/register', (c) => {
  return c.render('Register', { auth: { user: c.var.currentUser }, errors: {} })
})

/** POST /register - ユーザー登録処理 */
authRouter.post('/register', async (c) => {
  validateEnv(c.env)

  const body = await parseBody(c)

  // バリデーション
  const parseResult = registerSchema.safeParse({
    email: body.email,
    password: body.password,
    displayName: body.displayName,
  })

  if (!parseResult.success) {
    const errors: Record<string, string> = {}
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0]?.toString() ?? 'message'
      if (!errors[field]) {
        errors[field] = issue.message
      }
    }
    c.status(422)
    return c.render('Register', { auth: { user: c.var.currentUser }, errors })
  }

  const { email, password, displayName } = parseResult.data

  // メール重複確認
  const existing = await usersStore.findByEmail(email)
  if (existing) {
    c.status(422)
    return c.render('Register', { auth: { user: c.var.currentUser }, errors: { email: 'このメールアドレスは既に使用されています' } })
  }

  // パスワードハッシュ化・ユーザー作成
  const hashedPassword = await hashPassword(password)
  const newUser = usersStore.create({ email, displayName, hashedPassword })

  // セッション作成
  const token = await createSession(newUser.id, c.env.SESSION_SECRET)
  const isProduction = c.env.ENVIRONMENT === 'production'
  c.header('Set-Cookie', buildSessionCookie(token, isProduction))

  logger.info('ユーザー登録完了', { userId: newUser.id })

  // Inertia リダイレクト
  return c.redirect('/', 303)
})

/** GET /login - ログインページ表示 */
authRouter.get('/login', (c) => {
  return c.render('Login', { auth: { user: c.var.currentUser }, errors: {} })
})

/** POST /login - ログイン認証処理 */
authRouter.post('/login', async (c) => {
  validateEnv(c.env)

  const body = await parseBody(c)

  // バリデーション
  const parseResult = loginSchema.safeParse({
    email: body.email,
    password: body.password,
  })

  if (!parseResult.success) {
    const errors: Record<string, string> = {}
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0]?.toString() ?? 'message'
      if (!errors[field]) {
        errors[field] = issue.message
      }
    }
    c.status(422)
    return c.render('Login', { errors })
  }

  const { email, password } = parseResult.data

  // ユーザー検索
  const user = await usersStore.findByEmail(email)

  // タイミング攻撃対策: ユーザーが存在しない場合も verifyPassword を実行する
  const isValid = await verifyPassword(password, user?.passwordHash)

  if (!user || !isValid) {
    logger.warn('ログイン失敗', { email })
    c.status(422)
    return c.render('Login', {
      auth: { user: c.var.currentUser },
      errors: {
        message: 'メールアドレスまたはパスワードが正しくありません',
      },
    })
  }

  // セッション作成
  const token = await createSession(user.id, c.env.SESSION_SECRET)
  const isProduction = c.env.ENVIRONMENT === 'production'
  c.header('Set-Cookie', buildSessionCookie(token, isProduction))

  logger.info('ログイン成功', { userId: user.id })

  // Inertia リダイレクト
  return c.redirect('/', 303)
})

/** POST /logout - ログアウト処理 */
authRouter.post('/logout', (c) => {
  c.header('Set-Cookie', buildClearSessionCookie())
  logger.info('ログアウト', { userId: c.var.currentUser?.id })
  return c.redirect('/login', 303)
})

export { authRouter }
