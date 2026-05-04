import { Head, useForm, usePage } from '@inertiajs/react'
import type { SharedProps } from '@repo/shared'
import RootLayout from '../layouts/RootLayout'

export default function Dashboard() {
  const { auth } = usePage<SharedProps>().props
  const logoutForm = useForm({})

  function handleLogout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    logoutForm.post('/logout')
  }

  return (
    <RootLayout>
      <Head title="ダッシュボード" />

      <div className="container-content py-12">
        {/* ウェルカムカード */}
        <div className="card p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">
                こんにちは、{auth.user?.displayName ?? 'ゲスト'} さん
              </h1>
              <p className="text-slate-500 text-sm">{auth.user?.email}</p>
            </div>

            {/* ログアウトボタン */}
            <form onSubmit={handleLogout}>
              <button
                type="submit"
                disabled={logoutForm.processing}
                className="btn-secondary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {logoutForm.processing ? '処理中...' : 'ログアウト'}
              </button>
            </form>
          </div>
        </div>

        {/* ステータスカード群 */}
        <div className="grid gap-6 sm:grid-cols-3 mb-8">
          <div className="card p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-1">投稿数</h3>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-400 mt-1">Unit-03 で実装予定</p>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-1">コメント数</h3>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-400 mt-1">Unit-03 で実装予定</p>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-1">アカウント作成</h3>
            <p className="text-sm font-semibold text-slate-900">
              {auth.user?.createdAt
                ? new Date(auth.user.createdAt).toLocaleDateString('ja-JP')
                : '-'}
            </p>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">クイックアクション</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/posts" className="btn-primary text-sm no-underline">
              記事一覧を見る
            </a>
            <a href="/posts/new" className="btn-secondary text-sm no-underline">
              記事を書く（Unit-03 実装後）
            </a>
          </div>
        </div>
      </div>
    </RootLayout>
  )
}
