/**
 * PostNew ページ（記事投稿フォーム）
 * Unit-03: ブログ機能
 * 認証必須（requireAuth ミドルウェアでサーバー側にて保護）
 */

import { Head, Link, useForm } from '@inertiajs/react'
import RootLayout from '../layouts/RootLayout'

type PostNewProps = Record<string, never>

type PostFormData = {
  title: string
  body: string
  tags: string
}

export default function PostNew(_props: PostNewProps) {
  const form = useForm<PostFormData>({
    title: '',
    body: '',
    tags: '',
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // tags はカンマ区切り文字列として送信（サーバー側で配列に変換）
    form.post('/posts')
  }

  return (
    <RootLayout>
      <Head title="記事を書く - Hono Blog" />

      <div className="container-content py-8">
        <div className="mx-auto max-w-3xl">
          {/* ページヘッダー */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">新しい記事を書く</h1>
            <p className="mt-1 text-sm text-slate-500">
              Markdown 記法を使って記事を書くことができます
            </p>
          </div>

          {/* 投稿フォーム */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* タイトル */}
            <div>
              <label htmlFor="post-title" className="block text-sm font-medium text-slate-700">
                タイトル <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="post-title"
                  type="text"
                  name="title"
                  value={form.data.title}
                  onChange={(e) => form.setData('title', e.target.value)}
                  placeholder="記事のタイトルを入力してください"
                  className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors
                    ${form.errors.title ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`}
                  aria-describedby={form.errors.title ? 'post-title-error' : undefined}
                  disabled={form.processing}
                  autoFocus
                />
              </div>
              {form.errors.title && (
                <p id="post-title-error" className="mt-1 text-sm text-red-600" role="alert">
                  {form.errors.title}
                </p>
              )}
            </div>

            {/* 本文 */}
            <div>
              <label htmlFor="post-body" className="block text-sm font-medium text-slate-700">
                本文 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
                Markdown 記法を使って書くことができます
              </p>
              <div className="mt-1">
                <textarea
                  id="post-body"
                  name="body"
                  rows={16}
                  value={form.data.body}
                  onChange={(e) => form.setData('body', e.target.value)}
                  placeholder={`# 見出し\n\n本文を入力してください。\n\n## サブ見出し\n\n**太字** や *イタリック* も使えます。\n\n\`\`\`javascript\nconst hello = 'world'\n\`\`\``}
                  className={`w-full rounded-md border px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    resize-y transition-colors
                    ${form.errors.body ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`}
                  aria-describedby={form.errors.body ? 'post-body-error' : undefined}
                  disabled={form.processing}
                />
              </div>
              {form.errors.body && (
                <p id="post-body-error" className="mt-1 text-sm text-red-600" role="alert">
                  {form.errors.body}
                </p>
              )}
            </div>

            {/* タグ */}
            <div>
              <label htmlFor="post-tags" className="block text-sm font-medium text-slate-700">
                タグ
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
                カンマ区切りで複数のタグを入力できます（例: Hono, React, TypeScript）
              </p>
              <div className="mt-1">
                <input
                  id="post-tags"
                  type="text"
                  name="tags"
                  value={form.data.tags}
                  onChange={(e) => form.setData('tags', e.target.value)}
                  placeholder="Hono, React, TypeScript"
                  className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors
                    ${form.errors.tags ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`}
                  aria-describedby={form.errors.tags ? 'post-tags-error' : undefined}
                  disabled={form.processing}
                />
              </div>
              {form.errors.tags && (
                <p id="post-tags-error" className="mt-1 text-sm text-red-600" role="alert">
                  {form.errors.tags}
                </p>
              )}
            </div>

            {/* アクションボタン */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <Link
                href="/"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 no-underline transition-colors"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={form.processing}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {form.processing ? '投稿中...' : '記事を投稿する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RootLayout>
  )
}
