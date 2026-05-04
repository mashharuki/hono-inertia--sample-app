# 技術スタック決定書 - Unit-02: 認証機能

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-02 認証機能
**作成日**: 2026-05-04
**バージョン**: 1.0

---

## 1. 暗号化ライブラリ選定

### 決定: Web Crypto API（ランタイム組み込み）

| 候補 | 採否 | 理由 |
|------|------|------|
| `Web Crypto API` (`globalThis.crypto`) | **採用** | Cloudflare Workers ネイティブ対応・追加依存なし |
| `bcrypt` / `argon2` (npm) | 不採用 | Workers 環境で動作しない（Node.js ネイティブ依存）|
| `node:crypto` | 不採用 | Workers ランタイムで利用不可（nodejs_compat でも PBKDF2 は非推奨）|
| `jose` (JWT) | 不採用 | 署名付き Cookie 方式を採用するため不要 |

**採用する具体的な API**:

| 用途 | API |
|------|-----|
| パスワードハッシュ（PBKDF2） | `crypto.subtle.importKey` + `crypto.subtle.deriveBits` |
| ランダムソルト生成 | `crypto.getRandomValues` |
| HMAC-SHA256 署名生成 | `crypto.subtle.importKey` + `crypto.subtle.sign` |
| HMAC-SHA256 署名検証 | `crypto.subtle.importKey` + `crypto.subtle.verify` |
| エンコード変換 | `TextEncoder` / `TextDecoder` + base64url 自作関数 |

---

## 2. セッション管理方式選定

### 決定: 署名付き Cookie（ステートレス）

| 候補 | 採否 | 理由 |
|------|------|------|
| 署名付き Cookie（HMAC-SHA256） | **採用** | ステートレス・Workers 制約に適合・学習用として理解しやすい |
| JWT（JSON Web Token） | 不採用 | 追加ライブラリが必要・学習コスト増 |
| Cloudflare Workers KV | 不採用 | 今回のスコープ外（学習用シンプル実装）|
| Server-Side Session（メモリ） | 不採用 | Workers はリクエスト間でメモリ共有しない |

**Cookie 形式**:
```
session=<base64url(userId)>.<base64url(hmac-sha256-signature)>
```

---

## 3. フォームバリデーションライブラリ

### 決定: Zod（Unit-01 から継続）

| 候補 | 採否 | 理由 |
|------|------|------|
| `zod` | **採用** | Unit-01 で既に依存追加済み・型推論との相性が良い |
| `valibot` | 不採用 | バンドルサイズは優秀だが移行コストあり |
| 手動バリデーション | 不採用 | エラーメッセージの一貫性が保ちにくい |

**使用スキーマ**（`packages/shared/src/schemas/auth.ts`）:
```typescript
// Unit-01 で作成済み
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(50),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
```

---

## 4. ロガー実装方式

### 決定: カスタム構造化ロガー（JSON 出力）

| 候補 | 採否 | 理由 |
|------|------|------|
| カスタムロガー（`console.log` + JSON） | **採用** | Workers logpush 互換・追加依存なし・シンプル |
| `pino` | 不採用 | Workers 環境での動作確認が必要・バンドルサイズ増 |
| `winston` | 不採用 | Node.js 依存あり・Workers で動作しない |
| `console.log`（プレーンテキスト） | 不採用 | Q6 回答で JSON 形式が指定された |

**実装場所**: `apps/server/src/lib/logger.ts`（新規作成）

---

## 5. 環境変数バリデーション方式

### 決定: 起動時バリデーション関数（`validateEnv`）

| 候補 | 採否 | 理由 |
|------|------|------|
| カスタム `validateEnv` 関数 | **採用** | シンプル・Workers ミドルウェアと統合しやすい |
| `zod` によるスキーマバリデーション | 不採用 | シンプルなケースではオーバースペック |
| `@t3-oss/env-core` | 不採用 | 外部依存を増やしたくない |
| バリデーションなし（デフォルト値） | 不採用 | Q7 回答で起動時エラーが指定された |

---

## 6. 新規作成ファイル一覧（Unit-02 スコープ）

| ファイルパス | 種別 | 概要 |
|------------|------|------|
| `apps/server/src/lib/crypto.ts` | 新規 | PBKDF2 + HMAC-SHA256 暗号化ユーティリティ |
| `apps/server/src/lib/session.ts` | 新規 | 署名付き Cookie セッション管理 |
| `apps/server/src/lib/logger.ts` | 新規 | JSON 構造化ロガー |
| `apps/server/src/data/users.ts` | 新規 | usersStore（モックデータ + CRUD）|
| `apps/server/src/middleware/session.ts` | 新規 | セッション検証ミドルウェア |
| `apps/server/src/middleware/auth.ts` | 新規 | 認証必須ガードミドルウェア |
| `apps/server/src/routes/auth.ts` | 新規 | 認証ルート（register / login / logout）|
| `apps/client/src/pages/Register.tsx` | 新規 | ユーザー登録フォーム |
| `apps/client/src/pages/Login.tsx` | 新規 | ログインフォーム |

---

## 7. 技術スタック決定サマリー

| 領域 | 採用技術 | バージョン |
|------|---------|----------|
| パスワードハッシュ | Web Crypto API (PBKDF2/SHA-256) | ランタイム組み込み |
| セッション署名 | Web Crypto API (HMAC-SHA256) | ランタイム組み込み |
| Cookie 管理 | `hono/cookie` | Hono 組み込み |
| フォームバリデーション | Zod | 既存（Unit-01）|
| ロガー | カスタム JSON ロガー | 新規実装 |
| 環境変数バリデーション | カスタム `validateEnv` 関数 | 新規実装 |

---

*作成: AI-DLC Construction Phase - Unit-02 NFR Requirements ステージ*
*最終更新: 2026-05-04*
