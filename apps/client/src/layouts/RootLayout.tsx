import { Link, usePage } from '@inertiajs/react'
import type { SharedProps } from '@repo/shared'

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  const { auth, flash } = usePage<SharedProps>().props

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="container-content flex h-16 items-center justify-between">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600"
              aria-hidden="true"
            >
              <span className="text-sm font-bold text-white">H</span>
            </div>
            <span className="text-lg font-semibold text-slate-900">Hono Blog</span>
          </Link>

          {/* ナビゲーション */}
          <nav className="flex items-center gap-1" aria-label="メインナビゲーション">
            <Link
              href="/"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 no-underline transition-colors"
            >
              ホーム
            </Link>
            <Link
              href="/posts"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 no-underline transition-colors"
            >
              記事一覧
            </Link>

            <div className="ml-4 flex items-center gap-2">
              {auth.user ? (
                <>
                  <Link href="/posts/new" className="btn-primary text-xs px-3 py-1.5 no-underline">
                    記事を書く
                  </Link>
                  <Link
                    href="/logout"
                    method="post"
                    as="button"
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    ログアウト
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 no-underline transition-colors"
                  >
                    ログイン
                  </Link>
                  <Link href="/register" className="btn-primary text-sm no-underline">
                    新規登録
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* フラッシュメッセージ */}
      {(flash.success ?? flash.error) && (
        <div
          className={`border-b px-4 py-3 text-sm ${
            flash.success
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role="alert"
        >
          <div className="container-content">{flash.success ?? flash.error}</div>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1">{children}</main>

      {/* フッター */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="container-content flex h-14 items-center justify-between">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Hono Inertia Blog. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Built with{' '}
            <a
              href="https://hono.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
            >
              Hono
            </a>{' '}
            +{' '}
            <a
              href="https://inertiajs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
            >
              Inertia.js
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
