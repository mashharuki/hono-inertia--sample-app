# Code Generation Plan - Unit-02: 認証機能

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-02 認証機能
**作成日**: 2026-05-04
**ステータス**: Part 1 完了（Part 2 承認待ち）

---

## 概要

Unit-02 では、Cloudflare Workers の制約（Web Crypto API のみ使用・ステートレス設計）に準拠した
認証基盤を実装する。PBKDF2（10,000 イテレーション）によるパスワードハッシュ化と
HMAC-SHA256 署名付き Cookie セッション管理を実装する。

---

## 生成するファイル一覧（実装順）

### Step 1: サーバーサイド - 型定義・ユーティリティ層

**実装優先度**: 高（他のすべてのコンポーネントが依存）

- [x] `apps/server/src/types/env.ts`
  - Hono 環境型定義（Bindings: SESSION_SECRET / ENVIRONMENT、Variables: currentUser）
  - `@repo/shared` から `PublicUser` をインポート
  - Unit-01 の `apps/server/src/index.ts` が参照する型を確定させる

- [x] `apps/server/src/lib/logger.ts`
  - JSON 構造化ログ（NFR-AUTH-LOG-001 準拠）
  - `info` / `warn` / `error` の 3レベル
  - `console.log` / `console.warn` / `console.error` へ JSON.stringify で出力
  - パスワード・Cookie・SESSION_SECRET を絶対にログ出力しない（NFR-AUTH-LOG-002）

- [x] `apps/server/src/lib/crypto.ts`
  - `hashPassword(password: string): Promise<string>` - PBKDF2 ハッシュ化
    - イテレーション数: 10,000（NFR-AUTH-PERF-001）
    - ソルト: `crypto.getRandomValues(new Uint8Array(16))` で 16 バイト生成
    - 出力形式: `"<base64url(salt)>:<base64url(hash)>"`
  - `verifyPassword(password: string, storedHash: string | undefined): Promise<boolean>` - タイミングセーフ検証
    - `storedHash` が `undefined` の場合もダミーハッシュ計算を実行（NFR-AUTH-SEC-002）
    - タイミングセーフ比較は `crypto.subtle.verify` を活用
  - `toBase64url` / `fromBase64url` のヘルパー関数（内部使用）
  - Node.js `crypto` モジュールを一切使用しない（NFR-AUTH-CW-001）

- [x] `apps/server/src/lib/session.ts`
  - `createSession(userId: string, secret: string): Promise<string>` - HMAC-SHA256 署名トークン生成
    - フォーマット: `"<base64url(payload)>.<base64url(signature)>"`
    - payload は `{ userId, iat }` を JSON 化して base64url エンコード
  - `verifySession(token: string, secret: string): Promise<string | null>` - トークン検証
    - `crypto.subtle.verify` を使用（定数時間検証、NFR-AUTH-SEC-002）
    - 不正トークンは `null` を返す
  - `buildSessionCookie(token: string, isProduction: boolean): string` - Set-Cookie ヘッダー値構築
    - HttpOnly; SameSite=Lax; Max-Age=604800; Path=/（NFR-AUTH-SEC-001）
    - `isProduction` が `true` の場合のみ `Secure` フラグを追加
  - `buildClearSessionCookie(): string` - セッション削除 Cookie（Max-Age=0）

### Step 2: サーバーサイド - ミドルウェア層

**実装優先度**: 高（ルートハンドラーが依存）

- [x] `apps/server/src/middleware/validateEnv.ts`
  - `validateEnv(env: Env['Bindings']): void` - 起動時環境変数バリデーション（NFR-AUTH-ENV-001）
  - `SESSION_SECRET` の存在確認（未設定なら `Error` をスロー）
  - `SESSION_SECRET` の長さ確認（32 文字未満なら `Error` をスロー）
  - エラーメッセージに wrangler コマンド例を含める

- [x] `apps/server/src/middleware/auth.ts`
  - `authMiddleware: MiddlewareHandler<Env>` - セッション検証ミドルウェア
  - Cookie から `session` を取得 → `verifySession` で検証 → `usersStore.findById` でユーザー取得
  - 有効なセッション: `c.set('currentUser', PublicUser)`
  - 無効なセッション: `c.set('currentUser', null)` + `logger.warn`
  - Cookie なし: `c.set('currentUser', null)`（ログ出力なし）
  - `requireAuth: MiddlewareHandler<Env>` - 認証必須ガード
    - `currentUser` が null の場合: Inertia リクエストには 409、通常は 302 /login

### Step 3: サーバーサイド - データストア層

**実装優先度**: 中（Step 1 の `crypto.ts` に依存）

- [x] `apps/server/src/stores/usersStore.ts`
  - `usersStore.findByEmail(email: string): User | undefined` - 大文字小文字を無視して検索
  - `usersStore.findById(id: string): PublicUser | undefined` - ID 検索（`hashedPassword` を除外）
  - `usersStore.create(input: { email, name, hashedPassword }): PublicUser` - ユーザー作成
    - ID 生成: `"user-" + Date.now()`
    - メール: `email.toLowerCase()` で正規化して格納
  - モックデータ 2件（`admin@example.com` / `writer@example.com`）
  - モック初期化: `top-level await` で `hashPassword('password123')` を実行

### Step 4: サーバーサイド - ルートハンドラー層

**実装優先度**: 中（Step 1〜3 すべてに依存）

- [x] `apps/server/src/routes/auth.ts`
  - `GET /register` → `c.render('Register', { errors: {} })`
  - `POST /register` - ユーザー登録処理
    - `validateEnv` → `registerSchema.safeParse` → メール重複確認 → `hashPassword` → `usersStore.create` → `createSession` → Set-Cookie → Inertia リダイレクト `/`
    - バリデーション失敗: 422 + `{ errors: { field: message } }` で再レンダリング
    - メール重複: 422 + `{ errors: { email: "このメールアドレスは既に使用されています" } }`
  - `GET /login` → `c.render('Login', { errors: {} })`
  - `POST /login` - ログイン認証処理
    - `validateEnv` → `loginSchema.safeParse` → `usersStore.findByEmail` → `verifyPassword` → `createSession` → Set-Cookie → Inertia リダイレクト `/`
    - 認証失敗（ユーザー未存在・パスワード不一致）: 422 + `{ errors: { message: "メールアドレスまたはパスワードが正しくありません" } }`
    - ユーザー未存在でも `verifyPassword(password, undefined)` でダミー計算実行（タイミング攻撃対策）
  - `POST /logout` - ログアウト処理
    - `buildClearSessionCookie()` で Cookie 削除 → Inertia リダイレクト `/login`

- [x] `apps/server/src/index.ts`（Unit-01 生成ファイルの更新）
  - `authMiddleware` を全ルートに適用
  - `app.route('/auth', authRouter)` または直接 `/register` / `/login` / `/logout` をマウント
  - `validateEnv` を `app.use('*', ...)` の先頭で呼び出す

### Step 5: クライアントサイド - 認証ページコンポーネント

**実装優先度**: 低（サーバー実装完了後）

- [x] `apps/client/src/pages/Register.tsx`
  - `useForm({ name: '', email: '', password: '' })` で Inertia フォーム管理
  - フォームフィールド: 表示名 / メールアドレス / パスワード（8文字以上）
  - フィールドごとのインラインエラー表示（`form.errors.fieldName`）
  - フォーム下部: "すでにアカウントをお持ちの方は" → `<Link href="/login">`
  - `form.post('/register')` で送信
  - Tailwind CSS によるカード形式レイアウト（中央寄せ、シャドウ付き）

- [x] `apps/client/src/pages/Login.tsx`
  - `useForm({ email: '', password: '' })` で Inertia フォーム管理
  - フォームフィールド: メールアドレス / パスワード
  - フィールドごとのインラインエラー表示
  - 全体エラー表示エリア（認証失敗時: `form.errors.message`）
  - フォーム下部: "アカウントをお持ちでない方は" → `<Link href="/register">`
  - `form.post('/login')` で送信
  - Tailwind CSS によるカード形式レイアウト（中央寄せ、シャドウ付き）

- [x] `apps/client/src/pages/Dashboard.tsx`（新規追加）
  - ログイン済みユーザー向けのシンプルなダッシュボードページ
  - `usePage().props.currentUser` で現在のユーザー情報を表示
  - ログアウトボタン（`useForm().post('/logout')`）
  - Unit-03（ブログ機能）への接続ポイント

---

## 実装方針

### NFR 準拠事項
1. **Web Crypto API のみ**: Node.js `crypto` モジュールは一切使用しない
2. **タイミングセーフ**: `crypto.subtle.verify` を署名検証に使用、ユーザー未存在時もダミー計算
3. **ステートレス設計**: グローバル変数でセッション状態を管理しない
4. **セキュリティログ**: パスワード・Cookie・SESSION_SECRET はログに含めない

### コーディング規約
1. **TypeScript strict モード**: すべてのファイルで `strict: true` に準拠
2. **Biome**: リンター・フォーマッターを `biome.json` 設定に従い適用
3. **関数型スタイル**: クラスより関数・オブジェクトリテラルを優先
4. **エラーハンドリング**: `Result` 型ではなく、例外は `throw`、検証失敗は `null` / `false` を返す

### 実装確認項目（NFR チェックリスト）
実装後に以下を確認する:
- PBKDF2 イテレーション数 = 10,000
- Cookie 属性: HttpOnly; SameSite=Lax; Max-Age=604800
- 本番環境（ENVIRONMENT=production）では Secure フラグ付与
- SESSION_SECRET 未設定時はリクエストごとにエラーをスロー
- ユーザー未存在時でも verifyPassword を呼び出している

---

## ファイル数サマリー

| ステップ | 対象 | ファイル数 |
|--------|------|-----------|
| Step 1 | サーバー - 型定義・ユーティリティ | 4 |
| Step 2 | サーバー - ミドルウェア | 2 |
| Step 3 | サーバー - データストア | 1 |
| Step 4 | サーバー - ルートハンドラー（+ index.ts 更新） | 2 |
| Step 5 | クライアント - 認証ページ | 3 |
| **合計** | | **12** |

---

*作成: AI-DLC Construction Phase - Unit-02 Code Generation Plan (Part 1)*
*最終更新: 2026-05-04*
