# Logical Components - Unit-02: 認証機能

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-02 認証機能
**作成日**: 2026-05-04
**バージョン**: 1.0

---

## 1. 論理コンポーネント一覧

Unit-02（認証機能）を構成する論理コンポーネントを定義する。
各コンポーネントは単一責任原則に従い、テストしやすい単位に分割する。

```
apps/server/src/
├── lib/
│   ├── crypto.ts          [暗号化ユーティリティ]
│   ├── session.ts         [セッション管理]
│   └── logger.ts          [構造化ロガー]
├── middleware/
│   ├── validateEnv.ts     [環境変数バリデーション]
│   └── auth.ts            [認証ミドルウェア]
├── routes/
│   └── auth.ts            [認証ルートハンドラー]
├── stores/
│   └── usersStore.ts      [ユーザーデータストア（モック）]
└── types/
    └── env.ts             [Hono 環境型定義]
```

---

## 2. コンポーネント詳細

### 2.1 crypto.ts - 暗号化ユーティリティ

**責務**: PBKDF2 によるパスワードハッシュ化とタイミングセーフ検証

**公開インタフェース**:

```typescript
/**
 * パスワードをPBKDF2でハッシュ化する
 * @param password 平文パスワード（8文字以上）
 * @returns "<base64url(salt)>:<base64url(hash)>" 形式の文字列
 */
export async function hashPassword(password: string): Promise<string>

/**
 * パスワードを検証する（タイミングセーフ）
 * @param password 入力された平文パスワード
 * @param storedHash 保存済みハッシュ文字列（undefined の場合はダミー計算して false）
 * @returns 検証成功なら true
 */
export async function verifyPassword(
  password: string,
  storedHash: string | undefined
): Promise<boolean>
```

**内部定数**:

| 定数名 | 値 | 理由 |
|--------|------|------|
| `PBKDF2_ITERATIONS` | `10_000` | NFR-AUTH-PERF-001（変更の際は一箇所で管理） |
| `SALT_LENGTH` | `16` | 16バイト（128bit）ソルト |
| `KEY_LENGTH` | `256` | 256bit 出力 |
| `DUMMY_HASH` | 固定ダミー値 | タイミング攻撃対策（NFR-AUTH-SEC-002） |

**依存コンポーネント**: なし（Web Crypto API のみ使用）

---

### 2.2 session.ts - セッション管理

**責務**: HMAC-SHA256 署名付き Cookie トークンの生成・検証・Cookie ヘッダー構築

**公開インタフェース**:

```typescript
/**
 * セッショントークンを生成する
 * @param userId ユーザーID
 * @param secret SESSION_SECRET 環境変数の値
 * @returns "<base64url(payload)>.<base64url(signature)>" 形式のトークン
 */
export async function createSession(userId: string, secret: string): Promise<string>

/**
 * セッショントークンを検証する
 * @param token Cookie から取得したトークン文字列
 * @param secret SESSION_SECRET 環境変数の値
 * @returns 正当なトークンなら userId、不正なら null
 */
export async function verifySession(
  token: string,
  secret: string
): Promise<string | null>

/**
 * Set-Cookie ヘッダー値を構築する（セッション設定）
 */
export function buildSessionCookie(token: string, env: Env['Bindings']): string

/**
 * Set-Cookie ヘッダー値を構築する（セッション削除: Max-Age=0）
 */
export function buildClearSessionCookie(env: Env['Bindings']): string
```

**セッションペイロード型**:

```typescript
interface SessionPayload {
  userId: string
  iat: number   // issued at（Unix ミリ秒）
}
```

**依存コンポーネント**: `types/env.ts`

---

### 2.3 logger.ts - 構造化ロガー

**責務**: JSON 形式の構造化ログ出力（Cloudflare Workers logpush 対応）

**公開インタフェース**:

```typescript
export const logger: {
  info: (data: Record<string, unknown>) => void
  warn: (data: Record<string, unknown>) => void
  error: (data: Record<string, unknown>) => void
}
```

**出力フォーマット**:

```json
{
  "timestamp": "2026-05-04T10:30:00.000Z",
  "level": "info",
  "event": "user.login.success",
  "userId": "user-001",
  "email": "admin@example.com"
}
```

**依存コンポーネント**: なし

---

### 2.4 validateEnv.ts - 環境変数バリデーション

**責務**: Hono ミドルウェアとして SESSION_SECRET の存在・長さを検証する

**公開インタフェース**:

```typescript
/**
 * Cloudflare Workers の env を受け取り、必須環境変数を検証する
 * @throws Error SESSION_SECRET が未設定または32文字未満の場合
 */
export function validateEnv(env: Env['Bindings']): void
```

**バリデーションルール**:

| 変数名 | チェック内容 | エラー時の動作 |
|--------|------------|---------------|
| `SESSION_SECRET` | 存在確認 | Error をスロー |
| `SESSION_SECRET` | 32文字以上 | Error をスロー |

**依存コンポーネント**: `types/env.ts`

---

### 2.5 auth.ts（middleware）- 認証ミドルウェア

**責務**: リクエストごとにセッション Cookie を検証し、currentUser を Hono コンテキストに設定する

**公開インタフェース**:

```typescript
// Hono ミドルウェアとしてエクスポート
export const authMiddleware: MiddlewareHandler<Env>
```

**処理フロー**:

```
リクエスト受信
  → Cookie ヘッダーから session= を抽出
  ├── Cookie なし: c.set('currentUser', null) → next()
  └── Cookie あり:
        → verifySession(token, secret)
        ├── null（無効）: c.set('currentUser', null) + warn ログ → next()
        └── userId（有効）:
              → usersStore.findById(userId)
              ├── ユーザー存在: c.set('currentUser', PublicUser) → next()
              └── ユーザー不在: c.set('currentUser', null) + warn ログ → next()
```

**依存コンポーネント**: `session.ts`, `stores/usersStore.ts`, `logger.ts`, `types/env.ts`

---

### 2.6 auth.ts（routes）- 認証ルートハンドラー

**責務**: /register, /login, /logout エンドポイントのリクエスト処理

**ルート定義**:

| メソッド | パス | ハンドラー | 説明 |
|---------|------|-----------|------|
| GET | `/register` | renderRegister | 登録フォーム表示 |
| POST | `/register` | handleRegister | ユーザー登録処理 |
| GET | `/login` | renderLogin | ログインフォーム表示 |
| POST | `/login` | handleLogin | ログイン認証処理 |
| POST | `/logout` | handleLogout | ログアウト処理 |

**handleRegister の処理フロー**:

```
POST /register
  1. validateEnv(c.env)                           [環境変数確認]
  2. registerSchema.safeParse(body)               [入力バリデーション]
     ├── 失敗: logger.warn + Inertia 400 エラー
     └── 成功:
  3. usersStore.findByEmail(email)               [メール重複確認]
     ├── 存在: logger.warn + Inertia 409 エラー
     └── 不在:
  4. hashPassword(password)                      [パスワードハッシュ]
  5. usersStore.create({ email, name, hashedPassword })
  6. createSession(userId, secret)               [セッション生成]
  7. logger.info({ event:'user.register.success', userId, email })
  8. c.header('Set-Cookie', buildSessionCookie(token, env))
  9. Inertia redirect → /dashboard
```

**handleLogin の処理フロー**:

```
POST /login
  1. validateEnv(c.env)                           [環境変数確認]
  2. loginSchema.safeParse(body)                  [入力バリデーション]
     ├── 失敗: logger.warn + Inertia 400 エラー
     └── 成功:
  3. usersStore.findByEmail(email.toLowerCase())  [ユーザー検索]
  4. verifyPassword(password, user?.hashedPassword) [タイミングセーフ検証]
     ├── false: logger.warn + Inertia 401 エラー（統一メッセージ）
     └── true:
  5. createSession(userId, secret)               [セッション生成]
  6. logger.info({ event:'user.login.success', userId, email })
  7. c.header('Set-Cookie', buildSessionCookie(token, env))
  8. Inertia redirect → /dashboard
```

**handleLogout の処理フロー**:

```
POST /logout
  1. currentUser = c.get('currentUser')
  2. logger.info({ event:'user.logout', userId: currentUser?.id })
  3. c.header('Set-Cookie', buildClearSessionCookie(env))  [Cookie削除]
  4. Inertia redirect → /login
```

**依存コンポーネント**: `crypto.ts`, `session.ts`, `logger.ts`, `stores/usersStore.ts`, `validateEnv.ts`, `types/env.ts`

---

### 2.7 usersStore.ts - ユーザーデータストア

**責務**: メモリ内モックデータによるユーザーCRUD操作（Cloudflare Workers リスタートで初期化）

**公開インタフェース**:

```typescript
export const usersStore: {
  /** メールアドレスでユーザーを検索（小文字正規化済み） */
  findByEmail: (email: string) => User | undefined

  /** IDでユーザーを検索 */
  findById: (id: string) => PublicUser | undefined

  /** ユーザーを作成し、PublicUser を返す */
  create: (input: { email: string; name: string; hashedPassword: string }) => PublicUser
}
```

**初期化パターン（top-level await）**:

```typescript
// モックユーザーのパスワードを起動時に一度だけハッシュ化
const mockUsers: User[] = await Promise.all([
  {
    id: 'user-001',
    email: 'admin@example.com',
    name: '管理者 太郎',
    hashedPassword: await hashPassword('password123'),  // 起動時に計算
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'user-002',
    email: 'writer@example.com',
    name: '佐藤 美咲',
    hashedPassword: await hashPassword('password123'),
    createdAt: new Date('2026-01-15T00:00:00Z'),
  },
].map(async (u) => ({ ...u, hashedPassword: await hashPassword('password123') })))
```

**注意**: top-level await は Cloudflare Workers（ESM モード）でサポートされている。
ただし `wrangler.toml` で `compatibility_date` が適切に設定されている必要がある。

**依存コンポーネント**: `crypto.ts`（初期化時のみ）

---

### 2.8 env.ts - 型定義

**責務**: Hono の型パラメータとして使用する環境型の中央管理

```typescript
// apps/server/src/types/env.ts
import type { PublicUser } from '@repo/shared'

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

**依存コンポーネント**: `@repo/shared`（packages/shared - Unit-01 で定義済み）

---

## 3. コンポーネント依存グラフ

```
routes/auth.ts
├── lib/crypto.ts         (hashPassword, verifyPassword)
├── lib/session.ts        (createSession, buildSessionCookie, buildClearSessionCookie)
├── lib/logger.ts         (logger.info, logger.warn, logger.error)
├── stores/usersStore.ts  (findByEmail, findById, create)
├── middleware/validateEnv.ts (validateEnv)
└── types/env.ts          (Env)

middleware/auth.ts
├── lib/session.ts        (verifySession)
├── lib/logger.ts         (logger.warn)
├── stores/usersStore.ts  (findById)
└── types/env.ts          (Env)

stores/usersStore.ts
└── lib/crypto.ts         (hashPassword - 初期化時のみ)

lib/session.ts
└── types/env.ts          (Env['Bindings'])

middleware/validateEnv.ts
└── types/env.ts          (Env['Bindings'])

lib/crypto.ts     → 依存なし（Web Crypto API のみ）
lib/logger.ts     → 依存なし
types/env.ts      → @repo/shared（外部パッケージ）
```

**循環依存**: なし（DAG 構造を維持）

---

## 4. 非機能要件とコンポーネントのマッピング

| NFR カテゴリ | 担当コンポーネント |
|------------|-----------------|
| 暗号化・パフォーマンス | `crypto.ts` |
| セッション管理・Cookie | `session.ts` |
| セキュリティヘッダー | `session.ts` (buildSessionCookie) |
| 認証フロー全体 | `routes/auth.ts` |
| 環境変数バリデーション | `middleware/validateEnv.ts` |
| ユーザー存在確認 | `middleware/auth.ts` |
| 構造化ロギング | `logger.ts` |
| 型安全性 | `types/env.ts` |
| モックデータ | `stores/usersStore.ts` |

---

*作成: AI-DLC Construction Phase - Unit-02 NFR Design ステージ*
*最終更新: 2026-05-04*
