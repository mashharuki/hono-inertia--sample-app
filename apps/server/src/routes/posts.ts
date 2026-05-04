/**
 * 記事ルートハンドラー
 * - GET  /              → 記事一覧（ホームページ）
 * - GET  /posts/new     → 記事投稿フォーム（認証必須）
 * - POST /posts         → 記事作成（認証必須）
 * - GET  /posts/:id     → 記事詳細
 * - GET  /posts/:id/edit → 記事編集フォーム（認証必須・所有者のみ）
 * - POST /posts/:id     → 記事更新（_method=PUT、認証必須・所有者のみ）
 * - POST /posts/:id/delete → 記事削除（_method=DELETE、認証必須・所有者のみ）
 *
 * 注意: /posts/new は /posts/:id より先に登録すること
 */

import { createPostSchema, updatePostSchema } from '@repo/shared'
import { Hono } from 'hono'
import { logger } from '../lib/logger.js'
import { requireAuth } from '../middleware/auth.js'
import { commentsStore } from '../stores/commentsStore.js'
import { postsStore } from '../stores/postsStore.js'
import type { Env } from '../types/env.js'

const postsRouter = new Hono<Env>()

/** GET / - 記事一覧（ホームページ） */
postsRouter.get('/', (c) => {
  const page = Number(c.req.query('page') ?? '1')
  const perPage = 10

  const allPosts = postsStore.findAll()
  const totalCount = allPosts.length
  const totalPages = Math.ceil(totalCount / perPage)
  const currentPage = Math.max(1, Math.min(page, totalPages || 1))

  const start = (currentPage - 1) * perPage
  const posts = allPosts.slice(start, start + perPage)

  return c.render('Home', {
    posts,
    pagination: {
      currentPage,
      totalPages,
      totalCount,
      perPage,
    },
  })
})

/** GET /posts/new - 記事投稿フォーム（認証必須） */
postsRouter.get('/posts/new', requireAuth, (c) => {
  return c.render('PostNew', {})
})

/** POST /posts - 記事作成（認証必須） */
postsRouter.post('/posts', requireAuth, async (c) => {
  const currentUser = c.var.currentUser!

  const body = await c.req.parseBody()

  // tags: カンマ区切り文字列を配列に変換
  const rawTags = typeof body.tags === 'string' ? body.tags : ''
  const tags = rawTags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const parseResult = createPostSchema.safeParse({
    title: body.title,
    body: body.body,
    tags,
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
    return c.render('PostNew', { errors })
  }

  const post = postsStore.create(parseResult.data, currentUser)
  logger.info('記事作成完了', { postId: post.id, userId: currentUser.id })

  return c.redirect(`/posts/${post.id}`, 303)
})

/** GET /posts/:id - 記事詳細 */
postsRouter.get('/posts/:id', (c) => {
  const post = postsStore.findById(c.req.param('id'))
  if (!post) {
    c.status(404)
    return c.render('Error', { message: '記事が見つかりません' })
  }

  const comments = commentsStore.findByPostId(post.id)

  return c.render('PostShow', { post, comments })
})

/** GET /posts/:id/edit - 記事編集フォーム（認証必須・所有者のみ） */
postsRouter.get('/posts/:id/edit', requireAuth, (c) => {
  const currentUser = c.var.currentUser!
  const post = postsStore.findById(c.req.param('id'))

  if (!post) {
    c.status(404)
    return c.render('Error', { message: '記事が見つかりません' })
  }

  if (post.authorId !== currentUser.id) {
    c.status(403)
    return c.render('Error', { message: '編集権限がありません' })
  }

  return c.render('PostEdit', { post })
})

/** POST /posts/:id - 記事更新（Inertia _method=PUT をシミュレート） */
postsRouter.post('/posts/:id', requireAuth, async (c) => {
  const currentUser = c.var.currentUser!
  const post = postsStore.findById(c.req.param('id'))

  if (!post) {
    c.status(404)
    return c.render('Error', { message: '記事が見つかりません' })
  }

  if (post.authorId !== currentUser.id) {
    c.status(403)
    return c.render('Error', { message: '編集権限がありません' })
  }

  const body = await c.req.parseBody()

  // Inertia.js の form.put() は _method=PUT を付与するが、
  // 削除リクエスト（_method=DELETE）もここで処理する
  const method = typeof body._method === 'string' ? body._method.toUpperCase() : 'PUT'

  if (method === 'DELETE') {
    postsStore.delete(post.id)
    logger.info('記事削除完了', { postId: post.id, userId: currentUser.id })
    return c.redirect('/', 303)
  }

  // PUT: 記事更新
  const rawTags = typeof body.tags === 'string' ? body.tags : ''
  const tags = rawTags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const parseResult = updatePostSchema.safeParse({
    title: body.title,
    body: body.body,
    tags,
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
    return c.render('PostEdit', { post, errors })
  }

  const updated = postsStore.update(post.id, parseResult.data)
  if (!updated) {
    c.status(500)
    return c.render('Error', { message: '更新に失敗しました' })
  }

  logger.info('記事更新完了', { postId: post.id, userId: currentUser.id })
  return c.redirect(`/posts/${post.id}`, 303)
})

export { postsRouter }
