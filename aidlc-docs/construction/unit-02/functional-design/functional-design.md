# Unit-02 機能設計書（Functional Design）

**Unit**: Unit-02 - 認証機能
**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. 概要

Unit-02 は、メールアドレス・パスワードによる認証基盤を実装する。
Cloudflare Workers の制約（Node.js API 不可）に対応するため、
Web Crypto API（PBKDF2 + HMAC-SHA256）のみを使用した
ステートレスな署名付き Cookie セッション管理を採用する。

---

## 2. データモデル

### 2.1 User エンティティ

```typescript
// packages/shared/src/types/index.ts に定義済み（Unit-01 で作成）
type User = {
  id: string           // "user-001" 形式の固定ID
  email: string        // ユニーク。大文字小文字を区別しない（小文字正規化）
  name: string         // 表示名（1〜50文字）
  hashedPassword: string  // PBKDF2 ハッシュ値（"<base64(salt)>:<base64(hash)>"形式）
  createdAt: Date
}

// クライアントへ渡す型（パスワード除外）
type PublicUser = Omit<User, 'hashedPassword'>
```

### 2.2 初期モックデータ仕様

| フィールド | user-001 | user-002 |
|-----------|----------|----------|
| id | `user-001` | `user-002` |
| email | `admin@example.com` | `writer@example.com` |
| name | `管理者 太郎` | `佐藤 美咲` |
| password（平文） | `password123` | `password123` |
| hashedPassword | PBKDF2 ハッシュ値（実装時に生成） |
| createdAt | `2026-01-01T00:00:00Z` | `2026-01-15T00:00:00Z` |

> **注意**: モックデータの `hashedPassword` は、起動時にオフラインで事前計算した値をハードコードするのではなく、
> `hashPassword('password123')` を実行時に動的に生成する方式を採用する（Workers 環境での crypto.subtle 利用）。
> ただし Cloudflare Workers はトップレベル await を許容するため、モジュール初期化時に一度だけ計算する。

### 2.3 セッション Cookie 仕様

| 属性 | 値 | 理由 |
|------|----|------|
| 名前 | `session` | 固定 |
| 形式 | `<base64url(userId)>.<base64url(hmac-signature)>` | tamper-proof |
| HttpOnly | `true` | XSS 対策 |
| SameSite | `Lax` | CSRF 対策（通常のリンク遷移は許可） |
| Secure | 本番のみ `true` | HTTPS 必須 |
| Max-Age | `604800`（7日間） | ログアウトまで継続 |
| Path | `/` | 全パスに適用 |

---

## 3. ビジネスロジック

### 3.1 ユーザー登録（POST /register）

**入力バリデーション（Zod registerSchema）**:
- `email`: RFC 5321 準拠メール形式
- `password`: 8文字以上
- `name`: 1〜50文字

**処理フロー**:

```
1. リクエストボディを registerSchema で検証
   → 失敗: 400 + Inertia エラーレスポンス（フィールドエラー）

2. email の小文字正規化（email.toLowerCase()）

3. usersStore.existsByEmail(email) でメール重複確認
   → 重複あり: 400 + "このメールアドレスは既に使用されています"

4. hashPassword(password) でパスワードハッシュ化

5. usersStore.create({ email, name, hashedPassword }) でユーザー作成
   → id は nanoid() または "user-" + Date.now() で生成

6. createSession(newUser.id, SESSION_SECRET) でセッション生成

7. Set-Cookie ヘッダーにセッション Cookie を設定

8. c.redirect('/', 302) でホームページへリダイレクト
```

**エラーケース**:

| ケース | HTTPステータス | レスポンス |
|--------|-----------|---------|
| バリデーション失敗 | 422 | Inertia バリデーションエラー（フィールドごと） |
| メール重複 | 422 | `{ email: "このメールアドレスは既に使用されています" }` |
| サーバーエラー | 500 | "登録処理中にエラーが発生しました" |

### 3.2 ログイン（POST /login）

**入力バリデーション（Zod loginSchema）**:
- `email`: RFC 5321 準拠メール形式
- `password`: 1文字以上（空チェックのみ）

**処理フロー**:

```
1. リクエストボディを loginSchema で検証
   → 失敗: 422 + Inertia エラーレスポンス

2. email の小文字正規化

3. usersStore.findByEmail(email) でユーザー検索
   → 未存在: 422 + "メールアドレスまたはパスワードが正しくありません"
     （ユーザー存在を明かさないセキュリティ考慮）

4. verifyPassword(password, user.hashedPassword) で検証
   → 不一致: 422 + "メールアドレスまたはパスワードが正しくありません"

5. createSession(user.id, SESSION_SECRET) でセッション生成

6. Set-Cookie ヘッダーにセッション Cookie を設定

7. c.redirect('/', 302) でホームページへリダイレクト
```

**エラーケース**:

| ケース | HTTPステータス | レスポンス |
|--------|-----------|---------|
| バリデーション失敗 | 422 | フィールドごとエラー |
| 認証失敗（ユーザー未存在・パスワード不一致） | 422 | `{ message: "メールアドレスまたはパスワードが正しくありません" }` |
| サーバーエラー | 500 | "ログイン処理中にエラーが発生しました" |

> セキュリティ原則: ユーザーが存在するかどうかを区別したエラーメッセージは出さない（timing attack 対策として verifyPassword は常に実行する）

### 3.3 ログアウト（POST /logout）

**処理フロー**:

```
1. Cookie を削除（Max-Age=0 で上書き）

2. c.redirect('/login', 302) でログインページへリダイレクト
```

> 認証チェック不要（未認証でも実行可能）

### 3.4 セッション検証（全リクエスト - sessionMiddleware）

**処理フロー**:

```
1. getCookie(c, 'session') で Cookie 取得

2. Cookie が存在する場合:
   a. verifySession(cookie, SESSION_SECRET) で HMAC-SHA256 署名検証
   b. 署名が有効: userId を取得
   c. usersStore.findById(userId) でユーザー取得
   d. c.set('currentUser', user ?? null)

3. Cookie が存在しない場合:
   c.set('currentUser', null)

4. next() で次のハンドラへ
```

### 3.5 認証必須ガード（requireAuth ミドルウェア）

**処理フロー**:

```
1. c.get('currentUser') でユーザー取得

2. null の場合:
   a. X-Inertia ヘッダーがある（Inertia リクエスト）:
      → 409 Conflict + { url: '/login' }（Inertia がクライアント側でリダイレクト）
   b. X-Inertia ヘッダーがない（通常のリクエスト）:
      → 302 /login

3. null でない場合: await next()
```

---

## 4. 暗号化ロジック詳細

### 4.1 PBKDF2 パスワードハッシュ（crypto.ts）

**アルゴリズム仕様**:

```
アルゴリズム: PBKDF2
ハッシュ関数: SHA-256
イテレーション数: 100,000（NIST SP 800-132 推奨値以上）
ソルト長: 16バイト（crypto.getRandomValues で生成）
出力: 32バイト（256bit）
格納形式: "<base64url(salt)>:<base64url(hash)>"
```

**hashPassword 実装方針**:

```typescript
async function hashPassword(password: string): Promise<string> {
  // 1. ランダムソルト生成
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // 2. パスワードをバイト列に変換
  const encoder = new TextEncoder()
  const passwordBytes = encoder.encode(password)

  // 3. PBKDF2 キー素材を作成
  const keyMaterial = await crypto.subtle.importKey(
    'raw', passwordBytes, 'PBKDF2', false, ['deriveBits']
  )

  // 4. PBKDF2 でキー導出
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    keyMaterial, 256
  )

  // 5. base64url エンコードして返す
  return `${toBase64url(salt)}:${toBase64url(new Uint8Array(hashBuffer))}`
}
```

**verifyPassword 実装方針**:

```typescript
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // 1. 格納済みハッシュを分割
  const [saltBase64, hashBase64] = storedHash.split(':')
  const salt = fromBase64url(saltBase64)

  // 2. 同じソルトで再ハッシュ
  // ...（hashPassword と同じ手順でソルトのみ固定）

  // 3. タイミングセーフ比較（crypto.subtle.verify は使えないため手動実装）
  return timingSafeEqual(recomputed, fromBase64url(hashBase64))
}
```

### 4.2 HMAC-SHA256 署名 Cookie（session.ts）

**createSession 実装方針**:

```typescript
async function createSession(userId: string, secret: string): Promise<string> {
  // 1. シークレットキーをインポート
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )

  // 2. userId を base64url エンコード
  const payload = toBase64url(encoder.encode(userId))

  // 3. HMAC-SHA256 署名生成
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))

  // 4. "<payload>.<signature>" 形式で返す
  return `${payload}.${toBase64url(new Uint8Array(signature))}`
}
```

**verifySession 実装方針**:

```typescript
async function verifySession(cookie: string, secret: string): Promise<string | null> {
  // 1. "." で分割し payload と signature を取得
  const [payload, signature] = cookie.split('.')
  if (!payload || !signature) return null

  // 2. シークレットキーで検証用キーをインポート
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['verify']
  )

  // 3. HMAC-SHA256 署名検証（タイミングセーフ）
  const isValid = await crypto.subtle.verify(
    'HMAC', key,
    fromBase64url(signature),
    encoder.encode(payload)
  )
  if (!isValid) return null

  // 4. userId を base64url デコードして返す
  return new TextDecoder().decode(fromBase64url(payload))
}
```

---

## 5. API エンドポイント仕様

### 5.1 GET /register（登録ページ表示）

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| Inertia コンポーネント | `Register` |
| Props | なし（空フォーム） |
| 処理 | `c.render('Register', {})` |

### 5.2 POST /register（登録処理）

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| Content-Type | `application/x-www-form-urlencoded` または `application/json` |
| レスポンス（成功） | `302 /`（Set-Cookie ヘッダー付き） |
| レスポンス（失敗） | `422` + Inertia エラーバッグ |

### 5.3 GET /login（ログインページ表示）

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| Inertia コンポーネント | `Login` |
| Props | なし（空フォーム） |
| 処理 | `c.render('Login', {})` |

### 5.4 POST /login（ログイン処理）

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| Content-Type | `application/x-www-form-urlencoded` または `application/json` |
| レスポンス（成功） | `302 /`（Set-Cookie ヘッダー付き） |
| レスポンス（失敗） | `422` + Inertia エラーバッグ |

### 5.5 POST /logout（ログアウト処理）

| 項目 | 値 |
|------|-----|
| 認証 | 不要（未認証でも実行可） |
| レスポンス | `302 /login`（Cookie クリア） |

---

## 6. フロントエンドコンポーネント仕様

### 6.1 Register.tsx（ユーザー登録フォーム）

**レイアウト**:
- RootLayout 内にフォームを配置
- カード形式のフォームボックス（中央寄せ）
- ページタイトル: "アカウント登録"

**フォームフィールド**:

| フィールド | ラベル | 型 | バリデーション表示 |
|-----------|--------|----|--------------------|
| `name` | 表示名 | `text` | フィールド下にエラーメッセージ |
| `email` | メールアドレス | `email` | フィールド下にエラーメッセージ |
| `password` | パスワード | `password` | フィールド下にエラーメッセージ（8文字以上と表示） |

**Inertia useForm の使用パターン**:

```typescript
const form = useForm({
  name: '',
  email: '',
  password: '',
})

const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  form.post('/register')
}
```

**ページ下部リンク**: "すでにアカウントをお持ちの方は" → `/login`

### 6.2 Login.tsx（ログインフォーム）

**レイアウト**:
- RootLayout 内にフォームを配置
- カード形式のフォームボックス（中央寄せ）
- ページタイトル: "ログイン"

**フォームフィールド**:

| フィールド | ラベル | 型 | バリデーション表示 |
|-----------|--------|----|--------------------|
| `email` | メールアドレス | `email` | フィールド下にエラーメッセージ |
| `password` | パスワード | `password` | フィールド下にエラーメッセージ |

**エラーメッセージ表示**:
- フィールドエラー: 各フィールド下に赤文字
- 全体エラー（認証失敗）: フォーム上部にアラートボックス

**Inertia useForm の使用パターン**:

```typescript
const form = useForm({
  email: '',
  password: '',
})

const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  form.post('/login')
}
```

**ページ下部リンク**: "アカウントをお持ちでない方は" → `/register`

---

## 7. usersStore 詳細実装仕様

### 7.1 データ構造

```typescript
// メモリ内ストア（Workers の同一リクエスト内のみ有効）
let users: User[] = []

// モジュール初期化時に実行（非同期初期化）
async function initializeUsers() {
  users = [
    {
      id: 'user-001',
      email: 'admin@example.com',
      name: '管理者 太郎',
      hashedPassword: await hashPassword('password123'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'user-002',
      email: 'writer@example.com',
      name: '佐藤 美咲',
      hashedPassword: await hashPassword('password123'),
      createdAt: new Date('2026-01-15T00:00:00Z'),
    },
  ]
}
```

> Cloudflare Workers はモジュール単位でキャッシュされるが、ウォームスタンバイ間でメモリは共有されない。
> 本プロジェクトは学習用のため、この制限を許容する。

### 7.2 ID 生成方針

新規ユーザー登録時の ID 生成:

```typescript
create(data: Omit<User, 'id' | 'createdAt'>): User {
  const newUser: User = {
    id: `user-${Date.now()}`,
    ...data,
    createdAt: new Date(),
  }
  users.push(newUser)
  return newUser
}
```

### 7.3 メール正規化

- `findByEmail` および `existsByEmail` は内部で `email.toLowerCase()` を適用する
- `create` でも `email.toLowerCase()` で格納する

---

## 8. Inertia バリデーションエラー返却パターン

Hono で Inertia 互換のバリデーションエラーを返す方法:

```typescript
// Zod エラーを Inertia エラーバッグ形式に変換
const result = registerSchema.safeParse(body)
if (!result.success) {
  const errors = Object.fromEntries(
    result.error.issues.map(issue => [
      issue.path[0] as string,
      issue.message,
    ])
  )
  return c.render('Register', { errors })
}
```

クライアント側では `usePage().props.errors` または `useForm().errors` で取得する。

---

## 9. 環境変数・シークレット

| 変数名 | 用途 | 開発時のデフォルト値 |
|--------|------|---------------------|
| `SESSION_SECRET` | HMAC-SHA256 署名キー | `dev-secret-do-not-use-in-production` |
| `ENVIRONMENT` | 本番/開発の切り替え（Secure Cookie） | `development` |

Cloudflare Workers での設定:
- 開発: `wrangler.toml` の `[vars]` セクション
- 本番: `wrangler secret put SESSION_SECRET`

---

## 10. 成功条件確認

Unit-02 の成功条件（unit-of-work.md より）:

- [ ] `POST /register` でユーザー登録が成功し、セッション Cookie が発行される
- [ ] `POST /login` で正しい認証情報を入力するとログインに成功し Cookie が発行される
- [ ] `POST /login` で誤った認証情報を入力するとエラーメッセージが返る
- [ ] `POST /logout` でセッション Cookie が削除され未認証状態になる
- [ ] 認証必須ルートに未認証でアクセスすると `/login` にリダイレクトされる
- [ ] Register / Login ページが Inertia 経由で正常にレンダリングされる
- [ ] PBKDF2 ハッシュが Web Crypto API のみで実装されている（Node.js API 未使用）
- [ ] HttpOnly・SameSite=Lax フラグが Cookie に設定されている

---

## 11. 次のステージ

Functional Design 完了後は、以下の順序で進む:

1. **NFR Requirements** - セキュリティ要件（XSS対策・HttpOnly Cookie・CSRF対策）の確認
2. **NFR Design** - NFR Requirements の結果を受けた設計
3. **Code Generation** - 実装コード生成

---

*作成: AI-DLC Construction Phase - Unit-02 Functional Design*
*最終更新: 2026-05-04*
