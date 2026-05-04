/**
 * 認証ミドルウェア
 * - authMiddleware: セッション Cookie を検証し currentUser を設定する
 * - requireAuth: 認証が必須なルートを保護するガード
 */

import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { logger } from '../lib/logger.js'
import { verifySession } from '../lib/session.js'
import { usersStore } from '../stores/usersStore.js'
import type { Env } from '../types/env.js'

/**
 * セッション Cookie を検証し、currentUser を Context に設定するミドルウェア
 * 全ルートに適用する（認証必須でないルートも含む）
 */
export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, 'session')

  if (!token) {
    // Cookie なし: currentUser を null に設定（ログ出力なし）
    c.set('currentUser', null)
    return next()
  }

  const userId = await verifySession(token, c.env.SESSION_SECRET)

  if (!userId) {
    // 無効なセッション: currentUser を null に設定
    logger.warn('無効なセッショントークンを検出しました', {
      path: c.req.path,
      method: c.req.method,
    })
    c.set('currentUser', null)
    return next()
  }

  const user = usersStore.findById(userId)

  if (!user) {
    // ユーザーが見つからない（削除済みなど）: currentUser を null に設定
    logger.warn('セッションのユーザーが見つかりません', {
      userId,
      path: c.req.path,
    })
    c.set('currentUser', null)
    return next()
  }

  c.set('currentUser', user)
  return next()
}

/**
 * 認証が必須なルートを保護するガード
 * currentUser が null の場合:
 * - Inertia リクエスト (X-Inertia: true) → 409 Conflict
 * - 通常リクエスト → 302 /login にリダイレクト
 */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const currentUser = c.var.currentUser

  if (!currentUser) {
    const isInertia = c.req.header('X-Inertia') === 'true'

    if (isInertia) {
      // Inertia リクエストの場合は 409 Conflict でクライアント側リダイレクトを促す
      return c.json({ message: '認証が必要です' }, 409)
    }

    // 通常リクエストは /login にリダイレクト
    return c.redirect('/login', 302)
  }

  return next()
}
