import { z } from 'zod'

/** コメント作成スキーマ */
export const createCommentSchema = z.object({
  body: z
    .string()
    .min(1, 'コメントを入力してください')
    .max(1000, 'コメントは1000文字以内で入力してください'),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
