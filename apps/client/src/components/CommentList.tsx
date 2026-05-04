/**
 * CommentList コンポーネント
 * コメント一覧を表示するコンポーネント
 */

import type { Comment } from '@repo/shared'

type CommentListProps = {
  comments: Comment[]
}

/**
 * 日付を日本語フォーマットに変換する
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-500">まだコメントはありません</p>
        <p className="mt-1 text-sm text-slate-400">最初のコメントを投稿しましょう</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-4">
          {/* コメントヘッダー */}
          <div className="mb-2 flex items-center gap-2">
            {/* アバター（イニシャル） */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
              aria-hidden="true"
            >
              {comment.author.displayName.charAt(0)}
            </div>
            <div>
              <span className="text-sm font-medium text-slate-900">
                {comment.author.displayName}
              </span>
              <time
                dateTime={comment.createdAt}
                className="ml-2 text-xs text-slate-500"
              >
                {formatDate(comment.createdAt)}
              </time>
            </div>
          </div>

          {/* コメント本文（改行を <br> に変換） */}
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {comment.body}
          </p>
        </div>
      ))}
    </div>
  )
}
