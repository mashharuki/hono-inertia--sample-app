# アプリケーション設計書（統合概要）

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. アーキテクチャ概要

本プロジェクトは Hono + Inertia.js による「サーバー駆動 SPA」アーキテクチャを採用する。
従来の REST API + React という構成と異なり、サーバーが直接 React コンポーネントをレンダリング指示することで、API 設計の複雑さを排除する。

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              React (Inertia.js Client)                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │  Home    │  │PostShow  │  │ PostNew  │  │  Login   │ │  │
│  │  │  Page    │  │  Page    │  │  Page    │  │  Page    │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  │              RootLayout (Header + Footer)                  │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                           │ Inertia Protocol (XHR/Fetch)         │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│         Cloudflare Workers (Hono)                                │
│                           │                                      │
│  ┌────────────────────────▼──────────────────────────────────┐  │
│  │                   Hono Router                              │  │
│  │  GET /    GET /posts/:id    POST /posts    POST /login     │  │
│  └──────────┬────────────────────────────────────────────────┘  │
│             │                                                     │
│  ┌──────────▼────────────┐  ┌──────────────────────────────┐    │
│  │   Middleware Stack    │  │        Route Handlers         │    │
│  │  sessionMiddleware    │  │  auth.ts / posts.ts /         │    │
│  │  requireAuth          │  │  comments.ts                  │    │
│  └──────────┬────────────┘  └──────────┬─────────────────────┘   │
│             │                           │                          │
│  ┌──────────▼───────────────────────────▼──────────────────┐    │
│  │                   Data Layer (Mock)                       │    │
│  │   usersStore   postsStore   commentsStore                 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │           Utilities (Web Crypto API Only)                │     │
│  │   crypto.ts (PBKDF2)    session.ts (HMAC-SHA256)         │     │
│  └─────────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. モノレポ構成（確定版）

```
hono-inertia--sample-app/
├── apps/
│   ├── server/                        # Hono バックエンド (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── index.ts               # Hono アプリ初期化・ルート集約
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts            # /register, /login, /logout
│   │   │   │   ├── posts.ts           # /, /posts/new, /posts/:id, /posts/:id/edit
│   │   │   │   └── comments.ts        # /posts/:id/comments
│   │   │   ├── middleware/
│   │   │   │   ├── session.ts         # Cookie 読み取り・userId 設定
│   │   │   │   └── auth.ts            # requireAuth（認証必須ガード）
│   │   │   ├── data/
│   │   │   │   ├── users.ts           # ユーザーモックデータ + CRUD
│   │   │   │   ├── posts.ts           # 記事モックデータ + CRUD
│   │   │   │   └── comments.ts        # コメントモックデータ + CRUD
│   │   │   └── lib/
│   │   │       ├── crypto.ts          # PBKDF2 パスワードハッシュ (Web Crypto)
│   │   │       └── session.ts         # HMAC-SHA256 署名 Cookie (Web Crypto)
│   │   ├── vite.config.ts             # @hono/vite-dev-server 設定
│   │   ├── wrangler.toml              # Cloudflare Workers デプロイ設定
│   │   └── package.json
│   │
│   └── client/                        # React フロントエンド
│       ├── src/
│       │   ├── main.tsx               # createInertiaApp エントリ
│       │   ├── layouts/
│       │   │   └── RootLayout.tsx     # 共通レイアウト（ヘッダー・ナビ）
│       │   ├── pages/
│       │   │   ├── Home.tsx           # 記事一覧
│       │   │   ├── PostShow.tsx       # 記事詳細 + コメント
│       │   │   ├── PostNew.tsx        # 記事投稿フォーム
│       │   │   ├── PostEdit.tsx       # 記事編集フォーム
│       │   │   ├── Register.tsx       # ユーザー登録フォーム
│       │   │   └── Login.tsx          # ログインフォーム
│       │   └── components/
│       │       ├── PostCard.tsx       # 記事カード（一覧用）
│       │       ├── CommentList.tsx    # コメント一覧
│       │       ├── CommentForm.tsx    # コメント投稿フォーム
│       │       └── MarkdownRenderer.tsx  # Markdown → HTML 変換
│       └── package.json
│
├── packages/
│   └── shared/                        # 共有型定義・バリデーションスキーマ
│       ├── src/
│       │   ├── types/
│       │   │   └── index.ts           # User, Post, Comment, PublicUser 型
│       │   └── schemas/
│       │       ├── auth.ts            # registerSchema, loginSchema
│       │       ├── posts.ts           # createPostSchema, updatePostSchema
│       │       └── comments.ts        # createCommentSchema
│       └── package.json
│
├── pnpm-workspace.yaml                # pnpm モノレポ設定
├── biome.json                         # Biome リンター・フォーマッター設定
└── package.json                       # ルートスクリプト
```

---

## 3. 認証フロー設計

### 3.1 ユーザー登録フロー

```
Browser                      Hono Server                    Data Layer
   │                              │                              │
   │  POST /register              │                              │
   │  {email, password, name}     │                              │
   │─────────────────────────────>│                              │
   │                              │  Zod バリデーション           │
   │                              │  existsByEmail(email)        │
   │                              │─────────────────────────────>│
   │                              │<─ false（重複なし）           │
   │                              │                              │
   │                              │  hashPassword(password)      │
   │                              │  [Web Crypto PBKDF2]         │
   │                              │  usersStore.create(...)      │
   │                              │─────────────────────────────>│
   │                              │<─ newUser                    │
   │                              │                              │
   │                              │  createSession(userId)       │
   │                              │  Set-Cookie: session=<signed>│
   │  302 /                       │                              │
   │<─────────────────────────────│                              │
```

### 3.2 ログインフロー

```
Browser                      Hono Server                    Data Layer
   │                              │                              │
   │  POST /login                 │                              │
   │  {email, password}           │                              │
   │─────────────────────────────>│                              │
   │                              │  findByEmail(email)          │
   │                              │─────────────────────────────>│
   │                              │<─ user                       │
   │                              │                              │
   │                              │  verifyPassword(             │
   │                              │    password,                 │
   │                              │    user.hashedPassword)      │
   │                              │  [Web Crypto PBKDF2]         │
   │                              │                              │
   │                              │  createSession(userId)       │
   │                              │  Set-Cookie: session=<signed>│
   │  302 /                       │                              │
   │<─────────────────────────────│                              │
```

### 3.3 セッション検証フロー（全リクエスト）

```
Browser                      sessionMiddleware              Data Layer
   │                              │                              │
   │  GET /posts/new              │                              │
   │  Cookie: session=<value>     │                              │
   │─────────────────────────────>│                              │
   │                              │  verifySession(cookie)       │
   │                              │  [HMAC-SHA256 検証]          │
   │                              │  → userId                    │
   │                              │  usersStore.findById(userId) │
   │                              │─────────────────────────────>│
   │                              │<─ user                       │
   │                              │  c.set('currentUser', user)  │
   │                              │  │                           │
   │                              │  requireAuth チェック        │
   │                              │  → OK: ルートハンドラ実行    │
   │  c.render('PostNew', {...})   │                              │
   │<─────────────────────────────│                              │
```

### 3.4 セッション Cookie 仕様

| 属性 | 値 |
|------|-----|
| 名前 | `session` |
| 形式 | `<base64url(userId)>.<base64url(hmac-signature)>` |
| HttpOnly | true |
| SameSite | Lax |
| Secure | 本番のみ true |
| Max-Age | 604800（7日間） |
| Path | / |

---

## 4. モックデータ設計

### 4.1 初期ユーザーデータ

```typescript
// apps/server/src/data/users.ts（イメージ）
// パスワードは "password123" を PBKDF2 でハッシュ化した値

const users: User[] = [
  {
    id: 'user-001',
    email: 'admin@example.com',
    name: '管理者 太郎',
    hashedPassword: '<PBKDF2 hash of "password123">',
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'user-002',
    email: 'writer@example.com',
    name: '佐藤 美咲',
    hashedPassword: '<PBKDF2 hash of "password123">',
    createdAt: new Date('2026-01-15'),
  },
]
```

### 4.2 初期記事データ（5件）

```typescript
// apps/server/src/data/posts.ts（イメージ）
const posts: Post[] = [
  {
    id: 'post-001',
    title: 'Hono と Inertia.js で作るフルスタックアプリ入門',
    body: '# はじめに\n\nHono は軽量で高速な...',
    excerpt: 'Hono と Inertia.js を組み合わせることで、REST API なしのフルスタック開発が実現できます。',
    authorId: 'user-001',
    tags: ['Hono', 'Inertia.js', 'React'],
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
  },
  // ... 4件追加
]
```

### 4.3 初期コメントデータ

```typescript
// apps/server/src/data/comments.ts（イメージ）
const comments: Comment[] = [
  {
    id: 'comment-001',
    postId: 'post-001',
    authorId: 'user-002',
    body: 'とても参考になりました！',
    createdAt: new Date('2026-04-02'),
  },
  // ... 各記事に 2〜3件
]
```

---

## 5. Inertia ページコンポーネント マッピング

| URL パス | Hono ルートハンドラ | Inertia コンポーネント名 | Reactファイル |
|---------|----------------|----------------------|-------------|
| `GET /` | `routes/posts.ts` | `Home` | `pages/Home.tsx` |
| `GET /posts/:id` | `routes/posts.ts` | `PostShow` | `pages/PostShow.tsx` |
| `GET /posts/new` | `routes/posts.ts` | `PostNew` | `pages/PostNew.tsx` |
| `GET /posts/:id/edit` | `routes/posts.ts` | `PostEdit` | `pages/PostEdit.tsx` |
| `GET /register` | `routes/auth.ts` | `Register` | `pages/Register.tsx` |
| `GET /login` | `routes/auth.ts` | `Login` | `pages/Login.tsx` |

**ページ解決ロジック（apps/client/src/main.tsx）**:

```typescript
createInertiaApp({
  resolve: (name) => {
    const pages = import.meta.glob('./pages/**/*.tsx', { eager: true })
    return pages[`./pages/${name}.tsx`]
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
```

---

## 6. Cloudflare Workers 対応設計

### 6.1 Workers 制約対応一覧

| 制約 | 対応方法 |
|------|---------|
| Node.js API 不可 | Web Crypto API（`crypto.subtle`）を使用 |
| ファイルシステム不可 | モックデータはコード内配列として管理 |
| バンドルサイズ 1MB 制限 | argon2/bcrypt の代わりに PBKDF2 を使用 |
| メモリ永続化不可 | 本番は Workers KV を想定（デモではメモリ許容） |
| セッションメモリストア不可 | 署名付き Cookie（Stateless）を使用 |

### 6.2 wrangler.toml 設定（予定）

```toml
name = "hono-inertia-blog"
main = "dist/worker.js"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"

# 本番環境のシークレット（wrangler secret put SESSION_SECRET）
# SESSION_SECRET は環境変数から取得
```

---

## 7. 設計サマリー

### 7.1 コンポーネント数

| カテゴリ | 数 |
|---------|-----|
| サーバーコンポーネント（ルート・ミドルウェア・データ・lib） | 11 |
| クライアントコンポーネント（ページ・レイアウト・共有 UI） | 12 |
| 共有コンポーネント（型・スキーマ） | 5 |
| **合計** | **28** |

### 7.2 API エンドポイント数

| 種別 | 数 |
|------|-----|
| GET（ページレンダリング） | 6 |
| POST（作成・認証） | 4 |
| PUT（更新） | 1 |
| **合計** | **11** |

### 7.3 成果物一覧

| ファイル | 内容 |
|---------|------|
| `components.md` | コンポーネント責務定義 |
| `services.md` | サービス定義・ルーティング設計 |
| `component-methods.md` | メソッド・型・スキーマ定義 |
| `component-dependency.md` | 依存関係マトリクス・図 |
| `application-design.md` | 統合概要（本書） |

---

*作成: AI-DLC Application Design ステージ*
*最終更新: 2026-05-04*
