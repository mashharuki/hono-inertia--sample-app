/**
 * 環境変数バリデーションミドルウェア
 * NFR-AUTH-ENV-001: 起動時に SESSION_SECRET の存在・長さを検証する
 */

import type { Env } from '../types/env.js'

/**
 * SESSION_SECRET の存在・長さを検証する
 * @param env Cloudflare Workers の Bindings
 * @throws SESSION_SECRET が未設定または 32 文字未満の場合
 */
export function validateEnv(env: Env['Bindings']): void {
  if (!env.SESSION_SECRET) {
    throw new Error(
      'SESSION_SECRET が設定されていません。' +
        '以下のコマンドでシークレットを設定してください:\n' +
        '  wrangler secret put SESSION_SECRET\n' +
        '開発環境では .dev.vars に SESSION_SECRET=<32文字以上のランダム文字列> を設定してください。'
    )
  }

  if (env.SESSION_SECRET.length < 32) {
    throw new Error(
      `SESSION_SECRET が短すぎます（現在: ${env.SESSION_SECRET.length}文字）。32文字以上のランダムな文字列を設定してください。\n生成例: openssl rand -base64 32`
    )
  }
}
