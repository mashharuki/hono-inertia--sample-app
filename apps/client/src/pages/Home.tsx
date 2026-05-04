/**
 * Home ページ（記事一覧）
 * Unit-03: ブログ機能
 * ウェルカムページから記事一覧ページに全面改修
 */

import { Head, Link, usePage } from '@inertiajs/react'
import type { Pagination, Post, SharedProps } from '@repo/shared'
import PostCard from '../components/PostCard'
import RootLayout from '../layouts/RootLayout'

type HomeProps = {
  posts: Post[]
  pagination: Pagination
}

export default function Home({ posts, pagination }: HomeProps) {
  const { auth } = usePage<SharedProps>().props
  const { currentPage, totalPages, totalCount } = pagination

  return (
    <RootLayout>
      <Head title="ホーム - Hono Blog" />

      {/* ページヘッダー */}
      <section className="border-b border-slate-200 bg-white py-8">
        <div className="container-content">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">記事一覧</h1>
              <p className="mt-1 text-sm text-slate-500">
                {totalCount > 0 ? `${totalCount} 件の記事` : '記事なし'}
              </p>
            </div>
            {auth.user && (
              <Link href="/posts/new" className="btn-primary no-underline">
                新しい記事を書く
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 記事一覧 */}
      <section className="py-8">
        <div className="container-content">
          {posts.length === 0 ? (
            /* 記事 0 件 */
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-12 text-center">
              <p className="text-lg font-medium text-slate-700">まだ記事がありません</p>
              <p className="mt-2 text-sm text-slate-500">
                最初の記事を投稿してブログを始めましょう
              </p>
              {auth.user && (
                <Link href="/posts/new" className="btn-primary mt-4 inline-block no-underline">
                  記事を書く
                </Link>
              )}
            </div>
          ) : (
            /* 記事カードリスト */
            <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <nav
              className="mt-8 flex items-center justify-center gap-2"
              aria-label="ページネーション"
            >
              {currentPage > 1 && (
                <Link
                  href={`/?page=${currentPage - 1}`}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 no-underline transition-colors"
                >
                  前へ
                </Link>
              )}

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Link
                    key={page}
                    href={`/?page=${page}`}
                    className={`rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors ${
                      page === currentPage
                        ? 'bg-primary-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-current={page === currentPage ? 'page' : undefined}
                  >
                    {page}
                  </Link>
                ))}
              </div>

              {currentPage < totalPages && (
                <Link
                  href={`/?page=${currentPage + 1}`}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 no-underline transition-colors"
                >
                  次へ
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>
    </RootLayout>
  )
}
