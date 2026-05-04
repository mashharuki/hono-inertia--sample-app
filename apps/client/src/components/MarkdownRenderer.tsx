/**
 * MarkdownRenderer コンポーネント
 * marked + DOMPurify を使用して Markdown を安全に HTML に変換する
 * XSS 対策として DOMPurify.sanitize() を必ず適用する
 */

import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

type MarkdownRendererProps = {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const sanitizedHtml = useMemo(() => {
    // marked で Markdown を HTML に変換
    const rawHtml = marked(content, {
      breaks: true, // 改行を <br> に変換
      gfm: true, // GitHub Flavored Markdown を有効化
    }) as string

    // DOMPurify で XSS を防止するためにサニタイズ
    return DOMPurify.sanitize(rawHtml, {
      // 許可するタグを明示的に指定
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'hr',
        'strong',
        'em',
        'del',
        'code',
        'pre',
        'blockquote',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ],
      // 許可する属性を明示的に指定
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
      // 外部リンクに rel="noopener noreferrer" を自動付与
      ADD_ATTR: ['rel'],
    })
  }, [content])

  return (
    <div
      className={`prose prose-slate max-w-none
        prose-headings:font-bold prose-headings:text-slate-900
        prose-p:text-slate-700 prose-p:leading-relaxed
        prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
        prose-code:text-slate-800 prose-code:bg-slate-100 prose-code:rounded prose-code:px-1
        prose-pre:bg-slate-900 prose-pre:text-slate-100
        prose-blockquote:border-primary-400 prose-blockquote:text-slate-600
        prose-strong:text-slate-900
        ${className}`}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify.sanitize() で XSS 対策済み
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}
