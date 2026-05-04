import { Head, Link } from '@inertiajs/react'
import RootLayout from '../layouts/RootLayout'

type HomeProps = {
  message: string
}

export default function Home({ message }: HomeProps) {
  return (
    <RootLayout>
      <Head title="ホーム" />

      {/* ヒーローセクション */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-content text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Hono × Inertia.js × React
          </h1>
          <p className="mb-8 text-lg text-slate-600 max-w-2xl mx-auto">{message}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/posts" className="btn-primary no-underline px-6 py-3 text-base">
              記事を読む
            </Link>
            <Link href="/register" className="btn-secondary no-underline px-6 py-3 text-base">
              アカウント作成
            </Link>
          </div>
        </div>
      </section>

      {/* 技術スタック紹介 */}
      <section className="py-16">
        <div className="container-content">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">技術スタック</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                title: 'Hono',
                desc: 'エッジ対応の軽量 Web フレームワーク。Cloudflare Workers で動作します。',
                icon: '🔥',
              },
              {
                title: 'Inertia.js',
                desc: 'API なしでサーバーとクライアントをつなぐ SPA アーキテクチャ。',
                icon: '⚡',
              },
              {
                title: 'React + Tailwind',
                desc: 'モダンな UI を型安全に構築。Shadcn/ui コンポーネントを活用します。',
                icon: '⚛️',
              },
            ].map((item) => (
              <div key={item.title} className="card p-6">
                <div className="mb-3 text-3xl">{item.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </RootLayout>
  )
}
