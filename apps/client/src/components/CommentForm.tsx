/**
 * CommentForm コンポーネント
 * コメント投稿フォームコンポーネント
 * Inertia useForm を使用してフォーム状態を管理する
 */

import { useForm } from '@inertiajs/react'

type CommentFormProps = {
  postId: string
}

type CommentFormData = {
  body: string
}

export default function CommentForm({ postId }: CommentFormProps) {
  const form = useForm<CommentFormData>({
    body: '',
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    form.post(`/posts/${postId}/comments`, {
      onSuccess: () => {
        form.reset()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="comment-body" className="block text-sm font-medium text-slate-700">
          コメントを投稿する
        </label>
        <div className="mt-1">
          <textarea
            id="comment-body"
            name="body"
            rows={4}
            value={form.data.body}
            onChange={(e) => form.setData('body', e.target.value)}
            placeholder="コメントを入力してください..."
            className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
              resize-y transition-colors
              ${form.errors.body ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`}
            aria-describedby={form.errors.body ? 'comment-body-error' : undefined}
            disabled={form.processing}
          />
        </div>
        {form.errors.body && (
          <p id="comment-body-error" className="mt-1 text-sm text-red-600" role="alert">
            {form.errors.body}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={form.processing || form.data.body.trim().length === 0}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {form.processing ? '送信中...' : 'コメントを投稿'}
        </button>
      </div>
    </form>
  )
}
