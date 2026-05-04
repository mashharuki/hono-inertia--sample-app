/**
 * セッション管理ユーティリティ
 * NFR-AUTH-SEC-001: HttpOnly; SameSite=Lax; Max-Age=604800; 本番環境では Secure
 * NFR-AUTH-SEC-002: crypto.subtle.verify によるタイミングセーフ検証
 * NFR-AUTH-CW-001: Web Crypto API のみ使用
 */

/** base64url エンコード（内部使用） */
function toBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url デコード（内部使用） */
function fromBase64url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** セッション payload 型 */
type SessionPayload = {
  userId: string
  iat: number
}

/**
 * HMAC-SHA256 署名付きセッショントークンを生成する
 * @param userId ユーザー ID
 * @param secret SESSION_SECRET（32文字以上）
 * @returns "<base64url(payload)>.<base64url(signature)>" 形式のトークン
 */
export async function createSession(userId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()

  const payload: SessionPayload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
  }

  const payloadStr = toBase64url(encoder.encode(JSON.stringify(payload)).buffer as ArrayBuffer)

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr))

  const signature = toBase64url(signatureBuffer)
  return `${payloadStr}.${signature}`
}

/**
 * セッショントークンを検証し、ユーザー ID を返す（タイミングセーフ）
 * @param token 検証するトークン
 * @param secret SESSION_SECRET
 * @returns ユーザー ID、不正な場合は null
 */
export async function verifySession(token: string, secret: string): Promise<string | null> {
  const encoder = new TextEncoder()

  const parts = token.split('.')
  if (parts.length !== 2) {
    return null
  }

  const payloadStr = parts[0] ?? ''
  const signatureStr = parts[1] ?? ''

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signature = fromBase64url(signatureStr)
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payloadStr))

    if (!isValid) {
      return null
    }

    const payloadBytes = fromBase64url(payloadStr)
    const payloadJson = new TextDecoder().decode(payloadBytes)
    const payload = JSON.parse(payloadJson) as SessionPayload

    if (typeof payload.userId !== 'string') {
      return null
    }

    return payload.userId
  } catch {
    return null
  }
}

/**
 * Set-Cookie ヘッダー値を構築する
 * @param token セッショントークン
 * @param isProduction 本番環境フラグ（true の場合 Secure フラグを追加）
 * @returns Set-Cookie ヘッダー値
 */
export function buildSessionCookie(token: string, isProduction: boolean): string {
  const base = `session=${token}; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`
  return isProduction ? `${base}; Secure` : base
}

/**
 * セッション削除用 Cookie を構築する（ログアウト時）
 * @returns Set-Cookie ヘッダー値（Max-Age=0 でクリア）
 */
export function buildClearSessionCookie(): string {
  return 'session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/'
}
