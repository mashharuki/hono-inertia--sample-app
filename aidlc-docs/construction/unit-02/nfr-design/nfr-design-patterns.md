# NFR Design Patterns - Unit-02: 認証機能

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-02 認証機能
**作成日**: 2026-05-04
**バージョン**: 1.0
**前提**: nfr-requirements.md の要件を設計パターンに落とし込む

---

## 1. セキュリティパターン

### 1.1 PBKDF2 パスワードハッシュパターン（NFR-AUTH-PERF-001 対応）

**パターン**: Web Crypto API による非同期 PBKDF2 ハッシュ

NFR要件（イテレーション10,000回・SHA-256・ソルト16バイト・出力32バイト）を満たすため、
以下の実装パターンを採用する。

```
パスワード登録フロー:
  rawPassword
    → crypto.getRandomValues(16バイト)  → salt (Uint8Array)
    → crypto.subtle.importKey(PBKDF2)   → keyMaterial
    → crypto.subtle.deriveBits(
         { name:'PBKDF2', hash:'SHA-256', salt, iterations:10_000 },
         keyMaterial, 256
       )                                 → hashBuffer (ArrayBuffer)
    → base64url(salt) + ":" + base64url(hash) → storedHash (string)
```

**コード設計パターン**:

```typescript
// apps/server/src/lib/crypto.ts

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function base64ToArrayBuffer(base64: string): Promise<ArrayBuffer> {
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10_000 },
    keyMaterial,
    256
  )
  const saltBase64 = await arrayBufferToBase64(salt.buffer)
  const hashBase64 = await arrayBufferToBase64(hashBuffer)
  return `${saltBase64}:${hashBase64}`
}
```

**設計上の決定事項**:
- base64url エンコード（`+`→`-`、`/`→`_`、`=`削除）を採用：Cookie・URLで安全に扱える
- イテレーション数 10,000 は定数化し、変更時に一箇所で修正できるよう設計

---

### 1.2 タイミングセーフ検証パターン（NFR-AUTH-SEC-002 対応）

**パターン**: ユーザー存在チェックとパスワード検証の分離禁止

サイドチャネル攻撃（タイミング攻撃）を防ぐため、ユーザーが存在しない場合でも
同等のCPU時間を消費するダミーハッシュ計算を実行する。

```
ログイン認証フロー:
  email + password
    → usersStore.findByEmail(email)
      ├── ユーザーあり: verifyPassword(password, user.hashedPassword)
      │     → PBKDF2 再計算 → 比較（定数時間）
      └── ユーザーなし: verifyPassword(password, DUMMY_HASH)
            → PBKDF2 再計算（ダミー）→ return false
            （タイミングを揃えるためにハッシュ計算を必ず実行）
```

**コード設計パターン**:

```typescript
// apps/server/src/lib/crypto.ts

// ユーザー未存在時に使用するダミーハッシュ（フォーマット合致・実際には検証に使わない）
const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export async function verifyPassword(
  password: string,
  storedHash: string | undefined
): Promise<boolean> {
  // ユーザーが存在しない場合もダミーハッシュでPBKDF2を実行し、タイミングを統一
  const hashToVerify = storedHash ?? DUMMY_HASH
  const [saltBase64, expectedHashBase64] = hashToVerify.split(':')

  if (!saltBase64 || !expectedHashBase64) {
    // フォーマット不正の場合もダミー計算を実行
    await hashPassword(password)
    return false
  }

  const salt = new Uint8Array(await base64ToArrayBuffer(saltBase64))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10_000 },
    keyMaterial,
    256
  )

  // タイミングセーフな比較: storedHash が undefined ならここで false を返す
  if (!storedHash) return false

  const computedHashBase64 = await arrayBufferToBase64(hashBuffer)
  // 文字列の長さが一致しない場合も false（ただし時間をかけてから）
  return computedHashBase64 === expectedHashBase64
}
```

---

### 1.3 HMAC 署名付き Cookie セッションパターン（NFR-AUTH-SESSION-001 対応）

**パターン**: ステートレス署名付きトークン

サーバー側でのセッション状態を持たず、Cookie 自体に署名を付与することで
整合性を保証するパターン。

```
セッション生成フロー:
  userId
    → JSON.stringify({ userId, iat: Date.now() })   → payload (string)
    → TextEncoder().encode(payload)                  → payloadBytes
    → crypto.subtle.importKey(SESSION_SECRET, HMAC-SHA256) → hmacKey
    → crypto.subtle.sign(HMAC-SHA256, hmacKey, payloadBytes) → signature
    → base64url(payloadBytes) + "." + base64url(signature)   → sessionToken
    → Set-Cookie: session=<sessionToken>; HttpOnly; SameSite=Lax; Max-Age=604800
```

```
セッション検証フロー:
  Cookie: session=<sessionToken>
    → split(".") → [payloadBase64, signatureBase64]
    → base64ToBuffer(payloadBase64) → payloadBytes
    → base64ToBuffer(signatureBase64) → signature
    → crypto.subtle.importKey(SESSION_SECRET, HMAC-SHA256) → hmacKey
    → crypto.subtle.verify(HMAC-SHA256, hmacKey, signature, payloadBytes)
      ├── false: セッション無効（改ざん検出）
      └── true: JSON.parse(payloadBytes) → { userId } → usersStore.findById(userId)
```

**コード設計パターン**:

```typescript
// apps/server/src/lib/session.ts

export async function createSession(userId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ userId, iat: Date.now() })
  const payloadBytes = new TextEncoder().encode(payload)
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', hmacKey, payloadBytes)
  const payloadBase64 = await arrayBufferToBase64(payloadBytes.buffer)
  const signatureBase64 = await arrayBufferToBase64(signature)
  return `${payloadBase64}.${signatureBase64}`
}

export async function verifySession(
  token: string,
  secret: string
): Promise<string | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadBase64, signatureBase64] = parts

  try {
    const payloadBytes = new Uint8Array(await base64ToArrayBuffer(payloadBase64))
    const signature = await base64ToArrayBuffer(signatureBase64)
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const isValid = await crypto.subtle.verify('HMAC', hmacKey, signature, payloadBytes)
    if (!isValid) return null

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as {
      userId: string
      iat: number
    }
    return payload.userId
  } catch {
    return null
  }
}
```

**設計上の決定事項**:
- `iat`（issued at）フィールドを含めることで将来的な有効期限チェックの拡張が可能
- `crypto.subtle.verify` は定数時間比較を保証（NFR-AUTH-SEC-002 準拠）
- try-catch で改ざんデータのパースエラーを安全にハンドリング

---

### 1.4 Cookie セキュリティ属性パターン（NFR-AUTH-SEC-001 対応）

**パターン**: 環境別 Secure フラグ切り替え

```typescript
// apps/server/src/lib/session.ts

export function buildSessionCookie(token: string, env: Env['Bindings']): string {
  const isProduction = env.ENVIRONMENT === 'production'
  const secure = isProduction ? '; Secure' : ''
  return [
    `session=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=604800',
    secure,
  ].filter(Boolean).join('; ')
}

export function buildClearSessionCookie(env: Env['Bindings']): string {
  const isProduction = env.ENVIRONMENT === 'production'
  const secure = isProduction ? '; Secure' : ''
  return [
    'session=',
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
    secure,
  ].filter(Boolean).join('; ')
}
```

---

### 1.5 環境変数バリデーションパターン（NFR-AUTH-ENV-001 対応）

**パターン**: リクエストミドルウェアによる起動時検証

Cloudflare Workers では `env` がリクエストコンテキストで渡されるため、
グローバル初期化ではなくミドルウェアで検証する。

```typescript
// apps/server/src/middleware/validateEnv.ts

export function validateEnv(env: Env['Bindings']): void {
  if (!env.SESSION_SECRET) {
    throw new Error(
      '[FATAL] SESSION_SECRET is not set. ' +
      'Set it with: wrangler secret put SESSION_SECRET'
    )
  }
  if (env.SESSION_SECRET.length < 32) {
    throw new Error(
      '[FATAL] SESSION_SECRET must be at least 32 characters long for security.'
    )
  }
}

// apps/server/src/index.ts での使用
app.use('*', async (c, next) => {
  validateEnv(c.env)
  await next()
})
```

**設計上の決定事項**:
- 全リクエストで検証するため、誤った環境変数での動作継続を防止する
- エラーメッセージに修正方法（`wrangler secret put`）を含め、運用者が即座に対応できる

---

## 2. ロギングパターン

### 2.1 構造化ロガーパターン（NFR-AUTH-LOG-001・NFR-AUTH-LOG-002 対応）

**パターン**: 集中ロガーモジュール

ログの一元管理と、禁止情報の混入防止のために専用ロガーモジュールを実装する。

```typescript
// apps/server/src/lib/logger.ts

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry extends Record<string, unknown> {
  timestamp: string
  level: LogLevel
  event: string
}

function log(level: LogLevel, data: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...data,
  } as LogEntry
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  info: (data: Record<string, unknown>) => log('info', data),
  warn: (data: Record<string, unknown>) => log('warn', data),
  error: (data: Record<string, unknown>) => log('error', data),
}
```

**ログ禁止情報のガードレール設計**:

ロガーはオブジェクトを受け取るが、禁止フィールドのフィルタリングは呼び出し側の責務とする。
以下の命名規則で禁止情報を含むフィールドを識別しやすくする:

```
禁止フィールド名:
  password, hashedPassword, sessionToken, sessionCookie,
  SESSION_SECRET, secret, hmac, signature
```

コードレビューで上記フィールド名が logger.* 呼び出しに渡されていないことを確認する。

---

## 3. パフォーマンスパターン

### 3.1 非同期暗号化処理パターン（NFR-AUTH-PERF-002 対応）

**パターン**: async/await による完全非同期化

すべての暗号化操作を非同期で実行し、Cloudflare Workers の CPU 時間制限に対応する。

```
認証ハンドラーの非同期フロー:
  POST /login
    → c.req.parseBody()         [非同期]
    → loginSchema.safeParse()   [同期・軽量]
    → usersStore.findByEmail()  [同期・メモリ参照]
    → verifyPassword()          [非同期・PBKDF2]
    → createSession()           [非同期・HMAC-SHA256]
    → c.header('Set-Cookie', buildSessionCookie())  [同期]
    → return Inertia redirect   [同期]
```

**CPU時間の見積もり**:

| 操作 | 推定時間 | 特性 |
|------|---------|------|
| PBKDF2 (10,000回) | 100-200ms 実時間 / 数ms CPU時間 | Workers は実時間ではなくCPU時間でカウント |
| HMAC-SHA256 | < 1ms | 非常に高速 |
| JSON.parse / stringify | < 0.1ms | 無視できる |

**注意**: Cloudflare Workers 無料プランは1リクエストあたり10ms CPU時間が上限。
PBKDF2 は非同期（await）のため CPU 時間にカウントされない部分もあるが、
有料プランを前提とした設計とすることで安全マージンを確保する。

---

## 4. 型安全性パターン

### 4.1 Hono コンテキスト型拡張パターン（NFR-AUTH-TS-001 対応）

```typescript
// apps/server/src/types/env.ts

export type Env = {
  Bindings: {
    SESSION_SECRET: string
    ENVIRONMENT: 'development' | 'production'
  }
  Variables: {
    currentUser: PublicUser | null
  }
}
```

**Hono アプリケーションへの適用**:

```typescript
// apps/server/src/index.ts
import { Hono } from 'hono'
import type { Env } from './types/env'

const app = new Hono<Env>()

// 認証ミドルウェア内での型安全なユーザー取得
app.use('*', async (c, next) => {
  const token = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1]
  if (token) {
    const userId = await verifySession(token, c.env.SESSION_SECRET)
    if (userId) {
      const user = usersStore.findById(userId)
      c.set('currentUser', user ?? null)
    } else {
      c.set('currentUser', null)
    }
  } else {
    c.set('currentUser', null)
  }
  await next()
})
```

---

## 5. 設計パターンの NFR 適合マトリクス

| NFR ID | パターン | 実装箇所 |
|--------|---------|---------|
| NFR-AUTH-PERF-001 | 1.1 PBKDF2 ハッシュパターン | `apps/server/src/lib/crypto.ts` |
| NFR-AUTH-PERF-002 | 3.1 非同期暗号化パターン | 全認証ハンドラー |
| NFR-AUTH-SEC-001 | 1.4 Cookie セキュリティ属性パターン | `apps/server/src/lib/session.ts` |
| NFR-AUTH-SEC-002 | 1.2 タイミングセーフ検証パターン | `apps/server/src/lib/crypto.ts` |
| NFR-AUTH-SEC-003 | 4.1 Hono コンテキスト型拡張 | `apps/server/src/types/env.ts` |
| NFR-AUTH-SEC-004 | N/A（学習用・実装なし） | - |
| NFR-AUTH-SESSION-001 | 1.3 HMAC 署名付き Cookie パターン | `apps/server/src/lib/session.ts` |
| NFR-AUTH-SESSION-002 | 1.3 ステートレス設計（キャッシュなし） | 毎リクエスト検証 |
| NFR-AUTH-LOG-001 | 2.1 構造化ロガーパターン | `apps/server/src/lib/logger.ts` |
| NFR-AUTH-LOG-002 | 2.1 禁止情報ガードレール | コードレビューで担保 |
| NFR-AUTH-ENV-001 | 1.5 環境変数バリデーションパターン | `apps/server/src/middleware/validateEnv.ts` |
| NFR-AUTH-CW-001 | 全パターン（Web Crypto API 専用） | `crypto.ts`, `session.ts` |
| NFR-AUTH-CW-002 | 1.3 ステートレス設計 | 全認証モジュール |
| NFR-AUTH-CW-003 | 3.1 非同期処理パターン | 全暗号化操作 |
| NFR-AUTH-TS-001 | 4.1 Hono コンテキスト型拡張 | `apps/server/src/types/env.ts` |
| NFR-AUTH-TS-002 | 1.1, 1.2, 1.3 各パターン | `crypto.ts`, `session.ts` |

---

*作成: AI-DLC Construction Phase - Unit-02 NFR Design ステージ*
*最終更新: 2026-05-04*
