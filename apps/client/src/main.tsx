import { createInertiaApp } from '@inertiajs/react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'

createInertiaApp({
  // ページコンポーネントの動的インポート
  // Vite の glob import を使用してページを自動解決する
  resolve: (name) => {
    const pages = import.meta.glob('./pages/**/*.tsx', { eager: true })
    const page = pages[`./pages/${name}.tsx`]
    if (!page) {
      throw new Error(`Page component not found: ${name}`)
    }
    return page as { default: React.ComponentType }
  },

  // アプリのセットアップ
  setup({ el, App, props }) {
    const root = createRoot(el)
    root.render(createElement(App, props))
  },

  // ページタイトルの動的設定
  title: (title) => (title ? `${title} | Hono Inertia Blog` : 'Hono Inertia Blog'),
})
