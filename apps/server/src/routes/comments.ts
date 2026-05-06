/**
 * コメントルートハンドラー
 * - POST /posts/:id/comments → コメント投稿（認証必須）
 */

import { createCommentSchema } from '@repo/shared'
import { Hono } from 'hono'
import { logger } from '../lib/logger.js'
import { parseBody } from '../lib/parseBody.js'
import { requireAuth } from '../middleware/auth.js'
import { commentsStore } from '../stores/commentsStore.js'
import { postsStore } from '../stores/postsStore.js'
import type { Env } from '../types/env.js'

const commentsRouter = new Hono<Env>()

/** POST /posts/:id/comments - コメント投稿（認証必須） */
commentsRouter.post('/posts/:id/comments', requireAuth, async (c) => {
  const currentUser = c.var.currentUser
  if (!currentUser) return c.redirect('/login', 302)
  const postId = c.req.param('id')

  // 記事の存在確認
  const post = postsStore.findById(postId)
  if (!post) {
    c.status(404)
    return c.render('Error', { auth: { user: c.var.currentUser }, message: '記事が見つかりません' })
  }

  const body = await parseBody(c)

  const parseResult = createCommentSchema.safeParse({
    body: body.body,
  })

  if (!parseResult.success) {
    const errors: Record<string, string> = {}
    for (const issue of parseResult.error.issues) {
      const field = issue.path[0]?.toString() ?? 'message'
      if (!errors[field]) {
        errors[field] = issue.message
      }
    }

    // バリデーションエラー時は記事詳細ページにエラーを渡して再描画
    const comments = commentsStore.findByPostId(postId)
    c.status(422)
    return c.render('PostShow', { auth: { user: c.var.currentUser }, post, comments, errors })
  }

  const comment = commentsStore.create({ body: parseResult.data.body, postId }, currentUser)

  logger.info('コメント投稿完了', { commentId: comment.id, postId, userId: currentUser.id })

  // 記事詳細ページにリダイレクト
  return c.redirect(`/posts/${postId}`, 303)
})

export { commentsRouter }
