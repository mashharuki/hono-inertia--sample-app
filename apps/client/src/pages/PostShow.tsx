/**
 * PostShow ページ（記事詳細）
 * Unit-03: ブログ機能
 */

import { Head, Link, useForm, usePage } from '@inertiajs/react'
import type { Comment, Post, SharedProps } from '@repo/shared'
import CommentForm from '../components/CommentForm'
import CommentList from '../components/CommentList'
import MarkdownRenderer from '../components/MarkdownRenderer'
import RootLayout from '../layouts/RootLayout'

type PostShowProps = {
  post: Post
  comments: Comment[]
  errors?: Record<string, string>
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
  }).format(date)
}

/**
 * 記事削除フォームコンポーネント（所有者のみ表示）
 */
function DeleteButton({ postId }: { postId: string }) {
  const form = useForm({ _method: 'DELETE' })

  function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!window.confirm('この記事を削除しますか？この操作は取り消せません。')) return
    form.post(`/posts/${postId}`)
  }

  return (
    <form onSubmit={handleDelete} className="inline">
      <button
        type="submit"
        disabled={form.processing}
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {form.processing ? '削除中...' : '削除'}
      </button>
    </form>
  )
}

export default function PostShow({ post, comments }: PostShowProps) {
  const { auth } = usePage<SharedProps>().props
  const isOwner = auth.user?.id === post.authorId

  return (
    <RootLayout>
      <Head title={`${post.title} - Hono Blog`} />

      <div className="container-content py-8">
        <div className="mx-auto max-w-3xl">
          {/* パンくずリスト */}
          <nav
            className="mb-6 flex items-center gap-2 text-sm text-slate-500"
            aria-label="パンくずリスト"
          >
            <Link href="/" className="hover:text-slate-700 no-underline transition-colors">
              ホーム
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-700 truncate max-w-xs">{post.title}</span>
          </nav>

          {/* 記事ヘッダー */}
          <header className="mb-8">
            {/* タグリスト */}
            {post.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* タイトル */}
            <h1 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl leading-tight">
              {post.title}
            </h1>

            {/* メタ情報 */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                {/* 著者アバター */}
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
                  aria-hidden="true"
                >
                  {post.author.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{post.author.displayName}</p>
                  <time dateTime={post.createdAt} className="text-xs text-slate-500">
                    {formatDate(post.createdAt)}
                    {post.updatedAt !== post.createdAt && (
                      <span className="ml-2">(更新: {formatDate(post.updatedAt)})</span>
                    )}
                  </time>
                </div>
              </div>

              {/* 所有者アクション */}
              {isOwner && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/posts/${post.id}/edit`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 no-underline transition-colors"
                  >
                    編集
                  </Link>
                  <DeleteButton postId={post.id} />
                </div>
              )}
            </div>
          </header>

          {/* 記事本文 */}
          <article className="mb-12">
            <MarkdownRenderer content={post.body} />
          </article>

          {/* コメントセクション */}
          <section aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="mb-6 text-xl font-bold text-slate-900">
              コメント ({comments.length})
            </h2>

            {/* コメント一覧 */}
            <div className="mb-8">
              <CommentList comments={comments} />
            </div>

            {/* コメントフォームまたはログイン促進 */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              {auth.user ? (
                <>
                  <p className="mb-4 text-sm font-medium text-slate-700">
                    {auth.user.displayName} としてコメントする
                  </p>
                  <CommentForm postId={post.id} />
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    コメントするには
                    <Link
                      href="/login"
                      className="font-medium text-primary-600 hover:text-primary-700 no-underline"
                    >
                      ログイン
                    </Link>
                    が必要です
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Link href="/login" className="btn-primary text-sm no-underline">
                      ログイン
                    </Link>
                    <Link href="/register" className="btn-secondary text-sm no-underline">
                      新規登録
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 記事一覧に戻るリンク */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 no-underline transition-colors"
            >
              &larr; 記事一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    </RootLayout>
  )
}
