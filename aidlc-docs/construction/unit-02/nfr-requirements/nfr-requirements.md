# NFR Requirements - Unit-02: 認証機能

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-02 認証機能
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: 確定

---

## 1. 概要

Unit-02（認証機能）の非機能要件（NFR）を定義する。
Cloudflare Workers のランタイム制約（Web Crypto API のみ利用可・CPU 時間制限・ステートレス設計）と、
学習用プロジェクトとしてのシンプルさを両立した要件設定とする。

---

## 2. 暗号化パフォーマンス要件

### NFR-AUTH-PERF-001: PBKDF2 イテレーション数とレスポンスタイム

| 項目 | 要件値 |
|------|--------|
| イテレーション数 | 10,000 回 |
| 目標レスポンスタイム | 200ms 以内（ハッシュ計算単体） |
| 優先方針 | レスポンス優先（ユーザー体験を重視） |
| ハッシュアルゴリズム | SHA-256 |
| ソルト長 | 16バイト（`crypto.getRandomValues` で生成） |
| 出力長 | 32バイト（256bit） |

**ユーザー決定の根拠**（Q1 回答: A）:
- 学習用途のため、NIST 推奨の 100,000 回ではなくレスポンス優先で 10,000 回を採用
- Cloudflare Workers の CPU 時間制限（無料プラン: リクエストあたり 10ms CPU 時間）との折り合い
- 本番セキュリティ要件が高まった場合は 100,000 回以上に変更すること

**実装メモ**:
```typescript
// functional-design.md の実装方針から更新
const hashBuffer = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 10_000 }, // 100,000 から変更
  keyMaterial, 256
)
```

### NFR-AUTH-PERF-002: Cloudflare Workers CPU 時間制限対応

| 項目 | 要件 |
|------|------|
| ハッシュ計算の非同期処理 | 必須（`async/await` + Web Crypto API）|
| ブロッキング処理の禁止 | 同期的な暗号化処理を使用しない |
| ウォームアップコスト | モックデータ初期化は `top-level await` で一度のみ実行 |

---

## 3. セキュリティ要件

### NFR-AUTH-SEC-001: CSRF 対策方針

| 項目 | 要件値 |
|------|--------|
| 対策方式 | SameSite=Lax のみ（最小限） |
| CSRF トークン | 不要（学習用） |
| 対象リクエスト | POST /register, POST /login, POST /logout |

**ユーザー決定の根拠**（Q2 回答: A）:
- 学習用プロジェクトのため、SameSite=Lax の Cookie 属性のみで CSRF 対策とする
- SameSite=Lax により、クロスサイトからの POST リクエストは Cookie が送信されない
- 本番利用時は SameSite=Strict または CSRF トークン実装を検討すること

**Cookie 属性一覧（確定版）**:

| 属性 | 値 | 理由 |
|------|----|------|
| HttpOnly | `true` | XSS 対策：JavaScript からの Cookie 読み取りを禁止 |
| SameSite | `Lax` | CSRF 対策：クロスサイト POST を防止 |
| Secure | 本番のみ `true` | HTTPS 通信の強制（開発環境では `false`）|
| Max-Age | `604800`（7日間） | セッション有効期限（固定、後述） |
| Path | `/` | 全パスに適用 |
| Name | `session` | 固定 |

### NFR-AUTH-SEC-002: タイミング攻撃対策

| 項目 | 要件 |
|------|------|
| パスワード比較 | タイミングセーフ比較を実装（定数時間比較）|
| ユーザー存在確認 | ユーザー未存在時も verifyPassword を呼び出す（サイドチャネル防止）|
| エラーメッセージ | 「メールアドレスまたはパスワードが正しくありません」で統一（ユーザー存在を明かさない）|
| HMAC 署名検証 | `crypto.subtle.verify` を使用（ブラウザ・Workers 双方で定数時間）|

**タイミングセーフ比較の実装要件**:
```typescript
// verifyPassword 内でのダミーハッシュ計算（ユーザー未存在時）
async function verifyPassword(password: string, storedHash: string | undefined): Promise<boolean> {
  if (!storedHash) {
    // ユーザーが存在しない場合もハッシュ計算を実行して時間を一定にする
    await hashPassword(password)  // ダミー計算
    return false
  }
  // 通常の検証フロー...
}
```

### NFR-AUTH-SEC-003: XSS 対策

| 項目 | 要件 |
|------|------|
| Cookie の HttpOnly | 必須（JavaScript からのアクセス禁止）|
| セキュリティヘッダー | Unit-01 で設定済みの `X-Content-Type-Options`, `X-Frame-Options` を継承 |
| ユーザー入力のサニタイズ | Zod スキーマによる入力バリデーション（registerSchema / loginSchema）|

### NFR-AUTH-SEC-004: セッションのレート制限

| 項目 | 要件値 |
|------|--------|
| ログイン失敗レート制限 | 不要（学習用）|
| アカウントロック | 不要（学習用）|

**ユーザー決定の根拠**（Q4 回答: A）:
- 学習用プロジェクトのため、レート制限は実装しない
- 本番利用時は Cloudflare Workers KV または D1 を使用した失敗回数管理を実装すること

---

## 4. セッション管理要件

### NFR-AUTH-SESSION-001: セッション有効期限ポリシー

| 項目 | 要件値 |
|------|--------|
| セッション有効期限 | 固定 7日間（604,800 秒）|
| 有効期限のスライド更新 | 不要（アクセスのたびに延長しない）|
| 期限切れ検出 | Cookie の Max-Age による自動削除（ブラウザ管理）|

**ユーザー決定の根拠**（Q5 回答: A）:
- 学習用のため、シンプルな固定 7日間ポリシーを採用
- セッション Cookie は Max-Age=604800 を設定し、ブラウザが有効期限を管理する
- サーバーサイドでのセッションストア不要（ステートレス設計を維持）

**注意点**: 署名付き Cookie にはタイムスタンプが含まれないため、
サーバー側で個別セッションを無効化することはできない（ログアウトは Cookie 削除のみで対応）。

### NFR-AUTH-SESSION-002: セッション検証キャッシュ

| 項目 | 要件値 |
|------|--------|
| セッション検証のキャッシュ | 不要（毎リクエストで HMAC 署名を検証）|
| usersStore 参照 | 毎リクエストで実行（ユーザー存在確認）|

**ユーザー決定の根拠**（Q3 回答: A）:
- 学習用のため、パフォーマンス最適化より実装のシンプルさを優先
- Workers のメモリはリクエスト間で共有されないため、キャッシュの実装も複雑になる
- HMAC 署名検証は CPU コスト低（対称鍵）なため、毎回検証でも問題なし

---

## 5. 可観測性・ロギング要件

### NFR-AUTH-LOG-001: 構造化ログ（JSON 形式）

| 項目 | 要件値 |
|------|--------|
| ログ形式 | JSON（構造化ログ）|
| 出力先 | `console.log` / `console.error`（Cloudflare Workers logpush 対応）|
| ログレベル | `info`, `warn`, `error` の 3段階 |

**ユーザー決定の根拠**（Q6 回答: B）:
- Cloudflare Workers の logpush 機能と連携できる JSON 形式を採用
- 将来的なログ分析・監視に対応した構造化ログを実装する

**ログイベント定義**:

| イベント | レベル | ログ内容 |
|----------|--------|---------|
| ユーザー登録成功 | `info` | `{ event: "user.register.success", userId, email }` |
| ユーザー登録失敗（バリデーション） | `warn` | `{ event: "user.register.validation_error", errors }` |
| ユーザー登録失敗（メール重複） | `warn` | `{ event: "user.register.email_conflict", email }` |
| ログイン成功 | `info` | `{ event: "user.login.success", userId, email }` |
| ログイン失敗（認証エラー） | `warn` | `{ event: "user.login.auth_failure", email }` |
| ログアウト | `info` | `{ event: "user.logout", userId }` |
| セッション検証失敗 | `warn` | `{ event: "session.verify_failure", reason }` |
| サーバーエラー | `error` | `{ event: "server.error", message, stack }` |

**実装パターン**:
```typescript
// apps/server/src/lib/logger.ts
type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, data: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...data,
  }
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

### NFR-AUTH-LOG-002: ログに含めてはいけない情報

| 禁止情報 | 理由 |
|---------|------|
| パスワード（平文・ハッシュ問わず）| セキュリティリスク |
| セッション Cookie の値 | セッションハイジャックリスク |
| HMAC 署名の値 | セキュリティリスク |
| SESSION_SECRET の値 | 秘密鍵の漏洩防止 |

---

## 6. 環境変数バリデーション要件

### NFR-AUTH-ENV-001: 起動時バリデーション

| 項目 | 要件値 |
|------|--------|
| バリデーションタイミング | アプリケーション起動時（ハンドラー登録前）|
| バリデーション失敗時の動作 | `Error` をスロー（起動を中断）|
| 対象環境変数 | `SESSION_SECRET` |

**ユーザー決定の根拠**（Q7 回答: B）:
- 本番環境で `SESSION_SECRET` が未設定の場合、デプロイを失敗させる（安全側に倒す）
- デフォルト値にフォールバックするのではなく、明示的にエラーを発生させる
- Cloudflare Workers では Wrangler secrets で安全に管理する

**実装要件**:
```typescript
// apps/server/src/index.ts（ハンドラー登録前に実行）
function validateEnv(env: Env): void {
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

// Hono アプリケーションの初期化時
const app = new Hono<{ Bindings: Env }>()
app.use('*', async (c, next) => {
  validateEnv(c.env)  // 全リクエストで検証（Workers はステートレスのため）
  await next()
})
```

**注意**: Cloudflare Workers では `top-level await` でグローバル初期化が可能だが、
`env` は各リクエストのコンテキストでのみアクセス可能なため、リクエストミドルウェアで検証する。

---

## 7. Cloudflare Workers ランタイム制約（認証機能固有）

### NFR-AUTH-CW-001: Web Crypto API のみ使用

| 禁止 API | 代替 |
|---------|------|
| `require('crypto')` (Node.js) | `globalThis.crypto` (Web Crypto API) |
| `crypto.createHash` | `crypto.subtle.digest` |
| `crypto.createHmac` | `crypto.subtle.importKey` + `crypto.subtle.sign` |
| `crypto.pbkdf2Sync` | `crypto.subtle.deriveBits` (PBKDF2) |
| `Buffer.from` | `Uint8Array` + `TextEncoder` |

### NFR-AUTH-CW-002: ステートレス設計の維持

| 禁止パターン | 採用パターン |
|------------|------------|
| グローバル変数でセッション状態を管理 | 署名付き Cookie でセッションを保持 |
| ログイン試行回数をメモリで管理 | レート制限なし（学習用） |
| セッション失効リストをメモリで保持 | Cookie 削除のみでログアウト実現 |

### NFR-AUTH-CW-003: 非同期処理の徹底

認証フロー内のすべての暗号化操作は非同期で実行する:

| 操作 | API | 特性 |
|------|-----|------|
| パスワードハッシュ生成 | `crypto.subtle.deriveBits` | 非同期・CPU集約 |
| パスワード検証 | `crypto.subtle.deriveBits` | 非同期・CPU集約 |
| HMAC 署名生成 | `crypto.subtle.sign` | 非同期・高速 |
| HMAC 署名検証 | `crypto.subtle.verify` | 非同期・定数時間 |

---

## 8. 型安全性要件（認証固有）

### NFR-AUTH-TS-001: Hono 環境型の定義

```typescript
// apps/server/src/types/env.ts
type Env = {
  Bindings: {
    SESSION_SECRET: string
    ENVIRONMENT: 'development' | 'production'
  }
  Variables: {
    currentUser: PublicUser | null
  }
}
```

### NFR-AUTH-TS-002: 認証関連関数の型シグネチャ

```typescript
// apps/server/src/lib/crypto.ts
export async function hashPassword(password: string): Promise<string>
export async function verifyPassword(password: string, storedHash: string): Promise<boolean>

// apps/server/src/lib/session.ts
export async function createSession(userId: string, secret: string): Promise<string>
export async function verifySession(cookie: string, secret: string): Promise<string | null>
```

---

## 9. NFR 適合チェックリスト

### 暗号化・パフォーマンス
- [ ] PBKDF2 イテレーション数が 10,000 回に設定されている
- [ ] パスワードハッシュ計算が 200ms 以内に完了する（ローカル検証）
- [ ] Web Crypto API のみ使用（Node.js crypto API 不使用）
- [ ] タイミングセーフ比較が実装されている

### セキュリティ
- [ ] Cookie に HttpOnly フラグが設定されている
- [ ] Cookie に SameSite=Lax が設定されている
- [ ] 本番環境では Cookie に Secure フラグが設定される
- [ ] ユーザー存在を明かさないエラーメッセージが実装されている
- [ ] ユーザー未存在時でも verifyPassword のダミー計算を実行している

### セッション管理
- [ ] セッション有効期限が固定 7日間（Max-Age=604800）で設定されている
- [ ] セッション Cookie がステートレスな署名付き形式で実装されている

### ロギング
- [ ] 認証イベントが JSON 形式で構造化ログに出力される
- [ ] パスワード・Cookie 値・SESSION_SECRET がログに含まれていない

### 環境変数
- [ ] SESSION_SECRET が未設定の場合に起動時エラーが発生する
- [ ] SESSION_SECRET が 32 文字未満の場合にエラーが発生する

### Cloudflare Workers 制約
- [ ] ステートレス設計が維持されている（グローバルセッション状態なし）
- [ ] 全暗号化処理が非同期で実装されている

---

*作成: AI-DLC Construction Phase - Unit-02 NFR Requirements ステージ*
*最終更新: 2026-05-04*
