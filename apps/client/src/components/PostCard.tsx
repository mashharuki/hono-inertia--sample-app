/**
 * PostCard コンポーネント
 * 記事一覧で使用するカードコンポーネント
 */

import { Link } from '@inertiajs/react'
import type { Post } from '@repo/shared'

type PostCardProps = {
  post: Post
}

/**
 * Markdown 記法を除去してプレーンテキストに変換する
 * クライアントサイドで簡易的に処理するため、正規表現で対応
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '') // 見出し
    .replace(/\*\*(.+?)\*\*/g, '$1') // 太字
    .replace(/\*(.+?)\*/g, '$1') // イタリック
    .replace(/`{3}[\s\S]*?`{3}/g, '') // コードブロック
    .replace(/`(.+?)`/g, '$1') // インラインコード
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // リンク
    .replace(/!\[.+?\]\(.+?\)/g, '') // 画像
    .replace(/^\s*[-*+]\s/gm, '') // 箇条書き
    .replace(/^\s*\d+\.\s/gm, '') // 番号付きリスト
    .replace(/\n+/g, ' ') // 改行をスペースに
    .trim()
}

/**
 * 日付を日本語フォーマットに変換する
 * 例: "2026-04-01T09:00:00Z" → "2026年4月1日"
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export default function PostCard({ post }: PostCardProps) {
  const preview = stripMarkdown(post.body).slice(0, 100)
  const hasMore = stripMarkdown(post.body).length > 100

  return (
    <article className="card p-6 hover:shadow-md transition-shadow">
      {/* タグリスト */}
      {post.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* タイトル */}
      <h2 className="mb-2 text-xl font-bold text-slate-900">
        <Link
          href={`/posts/${post.id}`}
          className="hover:text-primary-600 no-underline transition-colors"
        >
          {post.title}
        </Link>
      </h2>

      {/* 著者・日付 */}
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
        <span className="font-medium text-slate-700">{post.author.displayName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </div>

      {/* 本文プレビュー */}
      <p className="text-sm text-slate-600 leading-relaxed">
        {preview}
        {hasMore && <span className="text-slate-400">...</span>}
      </p>

      {/* 続きを読むリンク */}
      <div className="mt-4">
        <Link
          href={`/posts/${post.id}`}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 no-underline"
        >
          続きを読む &rarr;
        </Link>
      </div>
    </article>
  )
}
