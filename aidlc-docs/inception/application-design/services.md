# サービス定義書

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. サービス概要

本プロジェクトは 2 つのサービスで構成される。開発時は pnpm スクリプト経由で起動し、本番は単一の Cloudflare Workers バンドルとしてデプロイする。

| サービス名 | 役割 | 開発時ポート | 本番 |
|-----------|------|------------|------|
| Hono Server | バックエンド・SSR（Inertia レスポンス） | 5173 | Cloudflare Workers |
| Vite Dev Server | フロントエンド HMR + バンドル | 5173（統合） | 不要（ビルド成果物のみ） |

> 注意: 開発時は `@hono/vite-dev-server` プラグインにより、Hono サーバーと Vite Dev Server が単一ポート（5173）で統合される。

---

## 2. Hono Server サービス

### 2.1 起動設定

| 項目 | 値 |
|------|-----|
| エントリポイント | `apps/server/src/index.ts` |
| ランタイム | Cloudflare Workers（本番）/ `wrangler dev`（開発） |
| ポート（開発） | 5173 |
| 設定ファイル | `apps/server/wrangler.toml` |

### 2.2 Hono ルーティング設計

#### 全ルート一覧

```
GET  /                    → Home（記事一覧） [公開]
GET  /posts/new           → PostNew（新規投稿フォーム） [認証必須]
POST /posts               → 記事作成 [認証必須]
GET  /posts/:id           → PostShow（記事詳細） [公開]
GET  /posts/:id/edit      → PostEdit（編集フォーム） [認証必須・自記事のみ]
PUT  /posts/:id           → 記事更新 [認証必須・自記事のみ]
GET  /register            → Register（登録フォーム） [未認証時のみ推奨]
POST /register            → ユーザー登録処理 [公開]
GET  /login               → Login（ログインフォーム） [未認証時のみ推奨]
POST /login               → ログイン処理 [公開]
POST /logout              → ログアウト処理 [認証必須]
POST /posts/:id/comments  → コメント投稿 [認証必須]
```

#### ルート詳細

**GET /（記事一覧）**
- ミドルウェア: `sessionMiddleware`（任意認証）
- 処理: `postsStore.findAll()` でモック記事一覧取得
- レスポンス: `c.render('Home', { posts, currentUser })`

**GET /posts/new（投稿フォーム）**
- ミドルウェア: `requireAuth`（認証必須）
- 処理: 空フォームデータを渡す
- レスポンス: `c.render('PostNew', { currentUser })`

**POST /posts（記事作成）**
- ミドルウェア: `requireAuth`
- 処理: Zod バリデーション → `postsStore.create()` → リダイレクト
- 成功時: `302 /posts/:newId` (PRG パターン)
- 失敗時: `c.render('PostNew', { errors, values })` (Inertia エラー形式)

**GET /posts/:id（記事詳細）**
- ミドルウェア: `sessionMiddleware`（任意認証）
- 処理: `postsStore.findById(id)` + `commentsStore.findByPostId(id)`
- レスポンス: `c.render('PostShow', { post, comments, currentUser })`
- 記事未存在時: 404

**GET /posts/:id/edit（編集フォーム）**
- ミドルウェア: `requireAuth`
- 処理: 所有者チェック（`post.authorId !== session.userId` で 403）
- レスポンス: `c.render('PostEdit', { post, currentUser })`

**PUT /posts/:id（記事更新）**
- ミドルウェア: `requireAuth`
- 処理: 所有者チェック → Zod バリデーション → `postsStore.update()`
- 成功時: `302 /posts/:id`
- 失敗時: Inertia エラーレスポンス

**GET /register（登録フォーム）**
- ミドルウェア: なし
- レスポンス: `c.render('Register', {})`

**POST /register（ユーザー登録）**
- 処理: Zod バリデーション → メール重複チェック → PBKDF2 パスワードハッシュ → `usersStore.create()` → セッション発行
- 成功時: `302 /`
- 失敗時: Inertia バリデーションエラー

**GET /login（ログインフォーム）**
- ミドルウェア: なし
- レスポンス: `c.render('Login', {})`

**POST /login（ログイン）**
- 処理: Zod バリデーション → `usersStore.findByEmail()` → `verifyPassword()` → セッション Cookie 発行
- 成功時: `302 /`
- 失敗時: Inertia バリデーションエラー

**POST /logout（ログアウト）**
- ミドルウェア: `requireAuth`
- 処理: セッション Cookie を削除（Max-Age=0）
- 成功時: `302 /`

**POST /posts/:id/comments（コメント投稿）**
- ミドルウェア: `requireAuth`
- 処理: Zod バリデーション → `commentsStore.create()`
- 成功時: `302 /posts/:id` (PRG パターン)
- 失敗時: Inertia バリデーションエラー

### 2.3 Inertia 統合設定

Hono の Inertia ミドルウェア（`@hono/inertia`）を使用し、以下の設定を行う。

```typescript
// apps/server/src/index.ts のイメージ
import { createInertiaMiddleware } from '@hono/inertia'

app.use(
  '*',
  createInertiaMiddleware({
    html: (page) => {
      // Vite ビルド成果物の HTML テンプレートに page データを埋め込む
      return renderHtmlTemplate(page)
    },
  })
)
```

### 2.4 セッション管理設計

**方式**: HMAC-SHA256 署名付き Cookie（Stateless）

```
Cookie: session=<base64(userId)>.<base64(hmac-signature)>
```

- `userId` を Base64 エンコードしてペイロードとする
- HMAC-SHA256 で署名（シークレットキーは環境変数 `SESSION_SECRET`）
- 有効期限: 7日間（Max-Age=604800）
- Web Crypto API のみ使用（Workers 対応）

### 2.5 共有ページデータ（Inertia Shared Props）

全ページに共通して以下の props を渡す（`sessionMiddleware` 経由）:

```typescript
type SharedProps = {
  currentUser: {
    id: string
    name: string
    email: string
  } | null
  flash?: {
    success?: string
    error?: string
  }
}
```

---

## 3. Vite Dev Server サービス（開発時）

### 3.1 設定

| 項目 | 値 |
|------|-----|
| 設定ファイル | `apps/server/vite.config.ts` |
| プラグイン | `@hono/vite-dev-server` |
| クライアントエントリ | `apps/client/src/main.tsx` |

### 3.2 本番ビルドフロー

```
1. vite build (apps/client)     → dist/client/ に JS/CSS バンドル生成
2. vite build (apps/server)     → dist/worker.js に Workers バンドル生成
3. wrangler deploy              → Cloudflare Workers へデプロイ
```

---

*作成: AI-DLC Application Design ステージ*
*最終更新: 2026-05-04*
