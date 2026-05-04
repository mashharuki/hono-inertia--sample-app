import type { PublicUser } from '@repo/shared'

/**
 * Hono アプリケーション環境型
 * Cloudflare Workers の Bindings と Context Variables を定義する
 */
export type Env = {
  Bindings: {
    /** Cloudflare Assets (静的ファイル配信) */
    ASSETS: Fetcher
    /** セッション署名用シークレット (32文字以上必須) */
    SESSION_SECRET: string
    /** 実行環境 (production | development) */
    ENVIRONMENT: string
  }
  Variables: {
    /** 認証済みユーザー情報 (未認証時は null) */
    currentUser: PublicUser | null
  }
}
