import { Head, Link, useForm } from '@inertiajs/react'
import RootLayout from '../layouts/RootLayout'

type RegisterProps = {
  errors: {
    email?: string
    password?: string
    displayName?: string
    message?: string
  }
}

export default function Register({ errors }: RegisterProps) {
  const form = useForm({
    displayName: '',
    email: '',
    password: '',
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    form.post('/register')
  }

  return (
    <RootLayout>
      <Head title="新規登録" />

      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* カードコンテナ */}
          <div className="card shadow-md p-8">
            {/* ヘッダー */}
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-slate-900">アカウント作成</h1>
              <p className="mt-2 text-sm text-slate-500">
                Hono Blog へようこそ。アカウントを作成して始めましょう。
              </p>
            </div>

            {/* 全体エラー */}
            {errors.message && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{errors.message}</p>
              </div>
            )}

            {/* 登録フォーム */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 表示名 */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  表示名
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={form.data.displayName}
                  onChange={(e) => form.setData('displayName', e.target.value)}
                  placeholder="山田 太郎"
                  autoComplete="name"
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.displayName
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300 bg-white focus:border-primary-500'
                  }`}
                />
                {errors.displayName && (
                  <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>
                )}
              </div>

              {/* メールアドレス */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.data.email}
                  onChange={(e) => form.setData('email', e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.email
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300 bg-white focus:border-primary-500'
                  }`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              {/* パスワード */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={form.data.password}
                  onChange={(e) => form.setData('password', e.target.value)}
                  placeholder="8文字以上"
                  autoComplete="new-password"
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.password
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300 bg-white focus:border-primary-500'
                  }`}
                />
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              {/* 送信ボタン */}
              <button
                type="submit"
                disabled={form.processing}
                className="btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {form.processing ? '処理中...' : 'アカウントを作成'}
              </button>
            </form>

            {/* ログインリンク */}
            <p className="mt-6 text-center text-sm text-slate-500">
              すでにアカウントをお持ちの方は{' '}
              <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                ログイン
              </Link>
            </p>
          </div>
        </div>
      </div>
    </RootLayout>
  )
}
