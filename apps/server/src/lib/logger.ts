/**
 * JSON 構造化ロガー
 * NFR-AUTH-LOG-001: 構造化ログ出力
 * NFR-AUTH-LOG-002: 機密情報をログに含めない（パスワード・Cookie・SESSION_SECRET）
 *
 * Cloudflare Workers の logpush に対応した JSON 形式で出力する
 */

type LogLevel = 'info' | 'warn' | 'error'

type LogEntry = {
  level: LogLevel
  message: string
  timestamp: string
  [key: string]: unknown
}

function createEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify(createEntry('info', message, meta)))
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify(createEntry('warn', message, meta)))
  },

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(JSON.stringify(createEntry('error', message, meta)))
  },
}
