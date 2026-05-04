import { z } from 'zod'

/** 記事作成スキーマ */
export const createPostSchema = z.object({
  title: z
    .string()
    .min(1, 'タイトルを入力してください')
    .max(255, 'タイトルは255文字以内で入力してください'),
  body: z.string().min(1, '本文を入力してください'),
  tags: z
    .array(z.string().max(30, 'タグは30文字以内で入力してください'))
    .max(10, 'タグは10個以内で設定してください')
    .default([]),
})

export type CreatePostInput = z.infer<typeof createPostSchema>

/** 記事更新スキーマ（部分更新対応） */
export const updatePostSchema = createPostSchema.partial()

export type UpdatePostInput = z.infer<typeof updatePostSchema>
