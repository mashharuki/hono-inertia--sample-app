/**
 * 暗号化ユーティリティ
 * NFR-AUTH-CW-001: Web Crypto API のみ使用（Node.js crypto モジュール禁止）
 * NFR-AUTH-PERF-001: PBKDF2 イテレーション数 10,000
 * NFR-AUTH-SEC-002: タイミングセーフ比較
 *
 * Cloudflare Workers 環境（Web Crypto API のみ利用可能）で動作する
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

/**
 * パスワードを PBKDF2 でハッシュ化する
 * @param password 平文パスワード
 * @returns "<base64url(salt)>:<base64url(hash)>" 形式の文字列
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 10_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  return `${toBase64url(salt.buffer)}:${toBase64url(hashBuffer)}`
}

/**
 * パスワードとハッシュを検証する（タイミングセーフ）
 * NFR-AUTH-SEC-002: ユーザー未存在時もダミーハッシュ計算を実行する
 * @param password 検証する平文パスワード
 * @param storedHash 保存済みハッシュ（undefined の場合はダミー計算）
 * @returns 一致する場合 true
 */
export async function verifyPassword(
  password: string,
  storedHash: string | undefined
): Promise<boolean> {
  const encoder = new TextEncoder()

  // storedHash が undefined の場合はダミーハッシュを使用（タイミング攻撃対策）
  const hashToVerify =
    storedHash ?? 'AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

  const parts = hashToVerify.split(':')
  if (parts.length !== 2) {
    return false
  }

  const saltPart = parts[0] ?? ''
  const hashPart = parts[1] ?? ''
  const salt = fromBase64url(saltPart)
  const expectedHash = fromBase64url(hashPart)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derivedBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 10_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )

  const derived = new Uint8Array(derivedBuffer)

  // 長さが異なる場合は false（ただし計算は完了させる）
  if (derived.length !== expectedHash.length) {
    // タイミング攻撃対策: 長さが違っても同じ時間をかける
    let _result = 0
    const minLen = Math.min(derived.length, expectedHash.length)
    for (let i = 0; i < minLen; i++) {
      _result |= (derived[i] ?? 0) ^ (expectedHash[i] ?? 0)
    }
    return false
  }

  // HMAC を使ったタイミングセーフ比較
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    derived,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )

  const signature = await crypto.subtle.sign('HMAC', hmacKey, expectedHash)

  // storedHash が undefined だった場合は必ず false を返す
  if (storedHash === undefined) {
    return false
  }

  return crypto.subtle.verify('HMAC', hmacKey, signature, expectedHash)
}
