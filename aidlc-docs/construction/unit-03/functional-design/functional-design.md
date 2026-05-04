# Unit-03 機能設計書（Functional Design）

**Unit**: Unit-03 - ブログ機能
**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. 概要

Unit-03 はブログサイトのコア機能を実装する。記事（Post）とコメント（Comment）の CRUD 操作、
Markdown 本文のレンダリング、認証済みユーザーの投稿・編集保護、記事所有者チェックを含む。
Unit-01（基盤）・Unit-02（認証）が完了した状態を前提とし、
`packages/shared/src/types/index.ts` に定義済みの型定義を活用する。

Cloudflare Workers のステートレス設計（Workers インスタンス内のみメモリ保持）を前提とし、
Node.js API を一切使用しない。

---

## 2. データモデル

### 2.1 既存の共有型定義（packages/shared/src/types/index.ts）の活用

以下の型定義は Unit-01 で作成済みであり、そのまま活用する。

```typescript
/** ブログ記事 */
type Post = {
  id: string          // "post-001" 形式の固定 ID
  title: string       // 記事タイトル（1〜255文字）
  body: string        // Markdown 形式の本文（1文字以上）
  tags: string[]      // タグ（0〜10個、各30文字以内）
  authorId: string    // 作成者の User.id
  author: PublicUser  // 作成者情報（JOIN 済み）
  createdAt: string   // ISO 8601 形式
  updatedAt: string   // ISO 8601 形式
}

/** コメント */
type Comment = {
  id: string          // "comment-001" 形式の固定 ID
  body: string        // コメント本文（1〜1000文字）
  postId: string      // 対象の Post.id
  authorId: string    // 作成者の User.id
  author: PublicUser  // 作成者情報（JOIN 済み）
  createdAt: string   // ISO 8601 形式
}

/** ページネーション情報 */
type Pagination = {
  currentPage: number
  totalPages: number
  totalCount: number
  perPage: number
}

/** 記事一覧レスポンス */
type PostsPage = {
  posts: Post[]
  pagination: Pagination
}
```

> `PublicUser` は Unit-02 で確立した型（`id / email / displayName / createdAt`）を使用する。

### 2.2 初期モックデータ仕様（postsStore）

**記事モックデータ（5件）**:

| フィールド | post-001 | post-002 | post-003 | post-004 | post-005 |
|-----------|---------|---------|---------|---------|---------|
| id | `post-001` | `post-002` | `post-003` | `post-004` | `post-005` |
| authorId | `user-001` | `user-002` | `user-001` | `user-002` | `user-001` |
| title | Hono と Inertia.js で作るフルスタック入門 | Cloudflare Workers で始めるエッジコンピューティング | React と TypeScript の型定義完全ガイド | pnpm モノレポ構成のベストプラクティス | Tailwind CSS v3 から v4 への移行ガイド |
| tags | `["Hono", "Inertia.js", "React"]` | `["Cloudflare", "Workers", "Edge"]` | `["React", "TypeScript"]` | `["pnpm", "monorepo"]` | `["Tailwind", "CSS"]` |
| createdAt | `2026-04-01T00:00:00Z` | `2026-04-05T00:00:00Z` | `2026-04-10T00:00:00Z` | `2026-04-15T00:00:00Z` | `2026-04-20T00:00:00Z` |

> **body**: 各記事は Markdown 形式の本文を持つ（最低 200 文字程度、見出し・リスト・コードブロックを含む）。

### 2.3 初期モックデータ仕様（commentsStore）

**コメントモックデータ（各記事 2〜3件）**:

| id | postId | authorId | body |
|----|--------|----------|------|
| `comment-001` | `post-001` | `user-002` | とても参考になりました！特に Inertia.js の設定部分が分かりやすかったです。 |
| `comment-002` | `post-001` | `user-001` | ありがとうございます！続編も書く予定です。 |
| `comment-003` | `post-002` | `user-001` | Cloudflare Workers の制約についてもっと詳しく知りたいです。 |
| `comment-004` | `post-002` | `user-002` | KV や R2 との連携も試してみてください。 |
| `comment-005` | `post-003` | `user-002` | TypeScript の型推論周りが特に助かりました。 |

### 2.4 ストアの内部構造

postsStore と commentsStore は、usersStore と同様の**インメモリ配列**として実装する。

```
apps/server/src/stores/
├── postsStore.ts     ← 記事 CRUD（Unit-03 で新規作成）
└── commentsStore.ts  ← コメント CRUD（Unit-03 で新規作成）
```

> ファイルパスは unit-of-work.md の `src/data/` 表記ではなく、Unit-02 の実装に合わせて
> `src/stores/` に配置する（実装一貫性を優先）。

---

## 3. ビジネスロジック

### 3.1 記事一覧取得（GET /）

**処理フロー**:

```
1. クエリパラメータからページ番号を取得（?page=1 がデフォルト）
   page は 1 以上の整数に正規化する

2. postsStore.findAll() で全記事を取得
   - 作成日の降順（createdAt desc）でソート
   - 各記事の authorId に対応する PublicUser を JOIN して author フィールドを付与

3. ページネーション計算（perPage = 10）
   - totalCount = 全記事数
   - totalPages = Math.ceil(totalCount / perPage)
   - currentPage のバウンド補正（1 〜 totalPages の範囲）
   - posts = 対象ページのスライス

4. c.render('Home', { posts, pagination }) で Inertia レスポンス
```

**Inertia Props 型**:

```typescript
type HomeProps = {
  posts: Post[]
  pagination: Pagination
}
```

### 3.2 記事詳細取得（GET /posts/:id）

**処理フロー**:

```
1. パスパラメータ :id を取得

2. postsStore.findById(id) で記事を検索
   - 未存在: 404 エラーレスポンス（"記事が見つかりませんでした"）

3. commentsStore.findByPostId(id) でコメント一覧を取得
   - 各コメントの authorId に対応する PublicUser を JOIN して author フィールドを付与
   - 作成日の昇順（createdAt asc）でソート

4. c.render('PostShow', { post, comments }) で Inertia レスポンス
```

**Inertia Props 型**:

```typescript
type PostShowProps = {
  post: Post
  comments: Comment[]
}
```

### 3.3 記事投稿フォーム表示（GET /posts/new）

**処理フロー**:

```
1. requireAuth ミドルウェアで認証チェック（Unit-02 で実装済み）
   → 未認証: /login へリダイレクト

2. c.render('PostNew', {}) で Inertia レスポンス
```

**Inertia Props 型**:

```typescript
type PostNewProps = Record<string, never>  // 空（フォーム初期値なし）
```

### 3.4 記事新規投稿（POST /posts）

**入力バリデーション（Zod createPostSchema）**:
- `title`: 1〜255文字
- `body`: 1文字以上
- `tags`: 0〜10個、各30文字以内（省略可）

**処理フロー**:

```
1. requireAuth ミドルウェアで認証チェック

2. リクエストボディを createPostSchema で検証
   → 失敗: 422 + Inertia バリデーションエラー（c.render('PostNew', { errors })）

3. 現在のユーザー（c.get('currentUser')）を authorId として取得

4. postsStore.create({ title, body, tags, authorId }) で記事作成
   - id は `post-${Date.now()}` で生成
   - createdAt / updatedAt は現在時刻（new Date().toISOString()）
   - author フィールドは usersStore.findById(authorId) で補完して返す

5. c.redirect(`/posts/${newPost.id}`, 302) で作成した記事詳細へリダイレクト
```

**エラーケース**:

| ケース | HTTPステータス | レスポンス |
|--------|-----------|---------|
| 未認証 | 302 | /login へリダイレクト |
| バリデーション失敗 | 422 | Inertia バリデーションエラー |
| サーバーエラー | 500 | エラーメッセージ |

### 3.5 記事編集フォーム表示（GET /posts/:id/edit）

**処理フロー**:

```
1. requireAuth ミドルウェアで認証チェック

2. postsStore.findById(id) で記事を検索
   → 未存在: 404 エラーレスポンス

3. 所有者チェック:
   currentUser.id === post.authorId
   → 不一致: 403 エラーレスポンス（"この記事を編集する権限がありません"）

4. c.render('PostEdit', { post }) で Inertia レスポンス
```

**Inertia Props 型**:

```typescript
type PostEditProps = {
  post: Post
}
```

### 3.6 記事更新（PUT /posts/:id）

**入力バリデーション（Zod updatePostSchema - 部分更新対応）**:
- `title`: 省略可、1〜255文字
- `body`: 省略可、1文字以上
- `tags`: 省略可

**処理フロー**:

```
1. requireAuth ミドルウェアで認証チェック

2. postsStore.findById(id) で記事を検索
   → 未存在: 404

3. 所有者チェック（GET と同様）
   → 不一致: 403

4. リクエストボディを updatePostSchema で検証
   → 失敗: 422 + c.render('PostEdit', { post, errors })

5. postsStore.update(id, { title, body, tags, updatedAt: new Date().toISOString() }) で更新

6. c.redirect(`/posts/${id}`, 302) で記事詳細へリダイレクト
```

### 3.7 コメント投稿（POST /posts/:id/comments）

**入力バリデーション（Zod createCommentSchema）**:
- `body`: 1〜1000文字

**処理フロー**:

```
1. requireAuth ミドルウェアで認証チェック
   → 未認証: /login へリダイレクト

2. postsStore.findById(id) で親記事の存在確認
   → 未存在: 404

3. リクエストボディを createCommentSchema で検証
   → 失敗: 422 + Inertia バリデーションエラー

4. commentsStore.create({ body, postId: id, authorId: currentUser.id }) でコメント作成
   - id は `comment-${Date.now()}` で生成
   - author フィールドは usersStore.findById(authorId) で補完して返す

5. c.redirect(`/posts/${id}`, 302) で記事詳細へリダイレクト
   （Inertia が自動でページを再取得しコメント一覧が更新される）
```

---

## 4. postsStore 詳細実装仕様

### 4.1 型定義と内部配列

```typescript
// apps/server/src/stores/postsStore.ts

import type { Post } from '@repo/shared'

// インメモリストア（Workers インスタンスライフサイクル内で有効）
let posts: Post[] = []

// モジュール初期化時のモックデータ投入
export function initializePosts(users: PublicUser[]): void {
  const user001 = users.find(u => u.id === 'user-001')!
  const user002 = users.find(u => u.id === 'user-002')!

  posts = [
    {
      id: 'post-001',
      title: 'Hono と Inertia.js で作るフルスタックアプリ入門',
      body: '# はじめに\n\nHono は軽量で高速な Web フレームワークです...',
      tags: ['Hono', 'Inertia.js', 'React'],
      authorId: 'user-001',
      author: user001,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    },
    // ... 4件追加
  ]
}
```

### 4.2 CRUD メソッド仕様

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `findAll` | `(): Post[]` | 全記事を createdAt 降順で返す |
| `findById` | `(id: string): Post \| undefined` | ID で記事を検索 |
| `create` | `(data: Omit<Post, 'id' \| 'createdAt' \| 'updatedAt' \| 'author'>, author: PublicUser): Post` | 記事を作成して返す |
| `update` | `(id: string, data: Partial<Pick<Post, 'title' \| 'body' \| 'tags'>>): Post \| undefined` | 記事を更新して返す（updatedAt を自動更新） |

> **DELETE（記事削除）は Unit-03 のスコープ外**。ユーザーストーリーに含まれないため実装しない。

### 4.3 ID 生成方針

```typescript
const id = `post-${Date.now()}`
```

同一ミリ秒内の競合リスクは学習用途につき許容する。

---

## 5. commentsStore 詳細実装仕様

### 5.1 型定義と内部配列

```typescript
// apps/server/src/stores/commentsStore.ts

import type { Comment } from '@repo/shared'

let comments: Comment[] = []

export function initializeComments(users: PublicUser[]): void {
  const user001 = users.find(u => u.id === 'user-001')!
  const user002 = users.find(u => u.id === 'user-002')!

  comments = [
    {
      id: 'comment-001',
      body: 'とても参考になりました！特に Inertia.js の設定部分が分かりやすかったです。',
      postId: 'post-001',
      authorId: 'user-002',
      author: user002,
      createdAt: '2026-04-02T00:00:00Z',
    },
    // ... 4件追加
  ]
}
```

### 5.2 CRUD メソッド仕様

| メソッド | シグネチャ | 説明 |
|---------|-----------|------|
| `findByPostId` | `(postId: string): Comment[]` | 指定記事のコメントを createdAt 昇順で返す |
| `create` | `(data: Omit<Comment, 'id' \| 'createdAt' \| 'author'>, author: PublicUser): Comment` | コメントを作成して返す |

### 5.3 ID 生成方針

```typescript
const id = `comment-${Date.now()}`
```

---

## 6. API エンドポイント仕様

### 6.1 GET /（記事一覧）

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| クエリパラメータ | `?page=1`（省略時は 1） |
| Inertia コンポーネント | `Home` |
| Props | `{ posts: Post[], pagination: Pagination }` |
| レスポンス（正常） | 200 + Inertia JSON |

### 6.2 GET /posts/:id（記事詳細）

| 項目 | 値 |
|------|-----|
| 認証 | 不要 |
| Inertia コンポーネント | `PostShow` |
| Props | `{ post: Post, comments: Comment[] }` |
| レスポンス（正常） | 200 + Inertia JSON |
| レスポンス（未存在） | 404 + エラーページ |

### 6.3 GET /posts/new（投稿フォーム）

| 項目 | 値 |
|------|-----|
| 認証 | **必要**（requireAuth） |
| Inertia コンポーネント | `PostNew` |
| Props | `{}` |
| レスポンス（未認証） | 302 /login |

### 6.4 POST /posts（記事作成）

| 項目 | 値 |
|------|-----|
| 認証 | **必要**（requireAuth） |
| Content-Type | `application/x-www-form-urlencoded` または `application/json` |
| リクエストボディ | `{ title: string, body: string, tags?: string[] }` |
| レスポンス（成功） | 302 /posts/:id |
| レスポンス（失敗） | 422 + Inertia バリデーションエラー |

### 6.5 GET /posts/:id/edit（編集フォーム）

| 項目 | 値 |
|------|-----|
| 認証 | **必要**（requireAuth + 所有者チェック） |
| Inertia コンポーネント | `PostEdit` |
| Props | `{ post: Post }` |
| レスポンス（未認証） | 302 /login |
| レスポンス（非所有者） | 403 + エラーメッセージ |
| レスポンス（未存在） | 404 + エラーメッセージ |

### 6.6 PUT /posts/:id（記事更新）

| 項目 | 値 |
|------|-----|
| 認証 | **必要**（requireAuth + 所有者チェック） |
| リクエストボディ | `{ title?: string, body?: string, tags?: string[] }` |
| レスポンス（成功） | 302 /posts/:id |
| レスポンス（失敗） | 422 + Inertia バリデーションエラー |

> **Inertia.js フォームと HTTP PUT**: Inertia の `useForm.put()` は `_method=PUT` を使った
> メソッドオーバーライドを行う。Hono 側で `app.use(methodOverride())` が必要か
> または `router.post('/posts/:id', ...)` で `_method` を確認する実装パターンを採用する。
> 詳細は Code Generation で確定する。

### 6.7 POST /posts/:id/comments（コメント投稿）

| 項目 | 値 |
|------|-----|
| 認証 | **必要**（requireAuth） |
| リクエストボディ | `{ body: string }` |
| レスポンス（成功） | 302 /posts/:id |
| レスポンス（失敗） | 422 + Inertia バリデーションエラー |

---

## 7. フロントエンドページコンポーネント仕様

### 7.1 Home.tsx（記事一覧ページ）

**Inertia Props**:

```typescript
type HomeProps = {
  posts: Post[]
  pagination: Pagination
}
```

**レイアウト**:
- RootLayout（ヘッダー・ナビ・フッター）を使用
- ページタイトル: "ブログ一覧"
- 認証済みユーザーには「新しい記事を書く」ボタンを表示（`/posts/new` へリンク）
- `SharedProps.auth.user` で認証状態を確認

**記事リスト**:
- `PostCard` コンポーネントを使用してリスト表示
- 記事が 0 件の場合: "まだ記事がありません" メッセージを表示
- ページネーション: 前後ページへのリンク（`<Link href={`/?page=${n}`}>` using Inertia）

**ページネーションの表示条件**:
- `pagination.totalPages > 1` の場合のみ表示

### 7.2 PostShow.tsx（記事詳細ページ）

**Inertia Props**:

```typescript
type PostShowProps = {
  post: Post
  comments: Comment[]
}
```

**レイアウト**:
- RootLayout を使用
- ページタイトル: `{post.title}`

**コンテンツ構造**:

```
[記事ヘッダー]
  - タイトル（h1）
  - 著者名・投稿日
  - タグリスト
  - 編集リンク（post.authorId === currentUser?.id の場合のみ表示）

[記事本文]
  - MarkdownRenderer コンポーネントで本文を HTML に変換表示

[コメントセクション]
  - h2 "コメント ({comments.length}件)"
  - CommentList コンポーネント（コメント一覧）
  - CommentForm コンポーネント（認証済みユーザーのみ表示）
  - 未認証の場合: "コメントするにはログインが必要です" + ログインリンク
```

**認証状態の取得**:
```typescript
const { auth } = usePage<SharedProps>().props
const isOwner = auth.user?.id === post.authorId
```

### 7.3 PostNew.tsx（記事投稿フォームページ）

**Inertia Props**:

```typescript
type PostNewProps = Record<string, never>
```

**レイアウト**:
- RootLayout を使用
- ページタイトル: "新しい記事を書く"

**フォームフィールド**:

| フィールド | ラベル | 型 | バリデーション表示 |
|-----------|--------|----|--------------------|
| `title` | タイトル | `text` | フィールド下にエラーメッセージ |
| `body` | 本文（Markdown） | `textarea` | フィールド下にエラーメッセージ（Markdown 対応と明記） |
| `tags` | タグ（カンマ区切り） | `text` | フィールド下にエラーメッセージ |

**tags の入出力変換**:
- 入力: カンマ区切りの文字列（例: "React, TypeScript, Hono"）
- 送信時: `tags.split(',').map(t => t.trim()).filter(Boolean)` で配列に変換

**Inertia useForm の使用パターン**:

```typescript
const form = useForm({
  title: '',
  body: '',
  tags: '',  // カンマ区切り文字列として管理
})

const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  form.transform(data => ({
    ...data,
    tags: data.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
  }))
  form.post('/posts')
}
```

**ボタン**:
- 「投稿する」（submit）
- 「キャンセル」（`/` へのリンク）

### 7.4 PostEdit.tsx（記事編集フォームページ）

**Inertia Props**:

```typescript
type PostEditProps = {
  post: Post
}
```

**レイアウト**:
- RootLayout を使用
- ページタイトル: `"記事を編集: {post.title}"`

**フォームフィールド**:
- PostNew と同様の構成
- 初期値として `post.title` / `post.body` / `post.tags.join(', ')` を設定

**Inertia useForm の使用パターン**:

```typescript
const form = useForm({
  title: post.title,
  body: post.body,
  tags: post.tags.join(', '),
})

const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  form.transform(data => ({
    ...data,
    tags: data.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
  }))
  form.put(`/posts/${post.id}`)
}
```

**ボタン**:
- 「更新する」（submit）
- 「キャンセル」（`/posts/${post.id}` へのリンク）

---

## 8. 共有 UI コンポーネント仕様

### 8.1 PostCard.tsx（記事カードコンポーネント）

**Props**:

```typescript
type PostCardProps = {
  post: Post
}
```

**表示内容**:
- 記事タイトル（リンク → `/posts/${post.id}`）
- 著者名（`post.author.displayName`）
- 投稿日（`post.createdAt` を日本語形式にフォーマット: "2026年4月1日"）
- タグリスト（バッジ形式）
- 本文冒頭 100 文字のプレビュー（Markdown を除去したプレーンテキスト）

**プレビュー生成方針**:
```typescript
// Markdown 記法を除去してプレーンテキストに変換
const preview = post.body
  .replace(/#{1,6}\s/g, '')   // 見出し
  .replace(/\*\*(.+?)\*\*/g, '$1')  // ボールド
  .replace(/`(.+?)`/g, '$1')  // インラインコード
  .slice(0, 100) + (post.body.length > 100 ? '...' : '')
```

### 8.2 CommentList.tsx（コメント一覧コンポーネント）

**Props**:

```typescript
type CommentListProps = {
  comments: Comment[]
}
```

**表示内容**:
- コメントが 0 件: "まだコメントはありません"
- 各コメント:
  - 著者名（`comment.author.displayName`）
  - 投稿日
  - 本文（プレーンテキスト、改行を `<br>` に変換）

### 8.3 CommentForm.tsx（コメント投稿フォームコンポーネント）

**Props**:

```typescript
type CommentFormProps = {
  postId: string
}
```

**フォームフィールド**:
- `body`: テキストエリア（ラベル: "コメントを追加"）

**Inertia useForm の使用パターン**:

```typescript
const form = useForm({ body: '' })

const handleSubmit = (e: FormEvent) => {
  e.preventDefault()
  form.post(`/posts/${postId}/comments`, {
    onSuccess: () => form.reset(),
  })
}
```

### 8.4 MarkdownRenderer.tsx（Markdown レンダリングコンポーネント）

**Props**:

```typescript
type MarkdownRendererProps = {
  content: string
  className?: string
}
```

**実装方針**:

Cloudflare Workers 環境でのバンドルサイズ制約（1MB）を考慮し、
軽量な Markdown パーサーを使用する。

**採用ライブラリ**: `marked`（軽量・Workers 対応）

```typescript
import { marked } from 'marked'
import DOMPurify from 'dompurify'

function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = DOMPurify.sanitize(marked.parse(content) as string)
  return (
    <div
      className={`prose prose-slate max-w-none ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

> XSS 対策として `DOMPurify` でサニタイズを行う。
> `prose` クラスは Tailwind CSS Typography プラグイン（`@tailwindcss/typography`）を使用。
> バンドルサイズが問題になる場合は、簡易的な正規表現ベースの変換に切り替える。

---

## 9. Inertia SharedProps の活用

全ページで `SharedProps` を通じて認証状態を取得できる。
Hono 側でグローバルに設定し、全 Inertia レスポンスに付与する。

```typescript
// apps/server/src/index.ts（Unit-02 で実装済みのものを活用）
app.use('*', (c, next) => {
  const currentUser = c.get('currentUser')
  c.set('inertiaSharedProps', {
    auth: {
      user: currentUser ? toPublicUser(currentUser) : null,
    },
    flash: {
      success: c.req.header('X-Flash-Success') ?? undefined,
      error: c.req.header('X-Flash-Error') ?? undefined,
    },
  })
  return next()
})
```

クライアント側での利用:
```typescript
import { usePage } from '@inertiajs/react'
import type { SharedProps } from '@repo/shared'

const { auth } = usePage<SharedProps>().props
const currentUser = auth.user  // PublicUser | null
```

---

## 10. Hono ルーター構成（posts.ts / comments.ts）

### 10.1 posts.ts ルーター

```typescript
// apps/server/src/routes/posts.ts

import { Hono } from 'hono'

const posts = new Hono<{ Bindings: Env; Variables: Variables }>()

posts.get('/', listPosts)                   // 記事一覧
posts.get('/posts/new', requireAuth, showPostNew)  // 投稿フォーム（認証必須）
posts.post('/posts', requireAuth, createPost)       // 記事作成（認証必須）
posts.get('/posts/:id', showPost)                   // 記事詳細
posts.get('/posts/:id/edit', requireAuth, showPostEdit)  // 編集フォーム（認証必須）
posts.put('/posts/:id', requireAuth, updatePost)    // 記事更新（認証必須）

export default posts
```

> **ルート順序の重要性**: `/posts/new` を `/posts/:id` より先に登録する。
> `:id` パラメータが `new` に一致してしまうことを防ぐため。

### 10.2 comments.ts ルーター

```typescript
// apps/server/src/routes/comments.ts

import { Hono } from 'hono'

const comments = new Hono<{ Bindings: Env; Variables: Variables }>()

comments.post('/posts/:id/comments', requireAuth, createComment)  // コメント投稿

export default comments
```

---

## 11. エラーハンドリング方針

| エラー種別 | 処理方針 |
|-----------|---------|
| 404（記事未存在） | Inertia エラーページ表示（または JSON エラー） |
| 403（非所有者アクセス） | Inertia エラーページ表示 |
| 422（バリデーション失敗） | Inertia バリデーションエラー（フォームに戻る） |
| 500（サーバーエラー） | 汎用エラーメッセージ表示 |

**Inertia 互換の 422 エラーレスポンス**:

```typescript
// Zod エラーを Inertia エラーバッグに変換
const result = createPostSchema.safeParse(body)
if (!result.success) {
  const errors = Object.fromEntries(
    result.error.issues.map(issue => [
      issue.path[0] as string,
      issue.message,
    ])
  )
  return c.render('PostNew', { errors })
}
```

---

## 12. ストア初期化の依存関係

postsStore と commentsStore は usersStore の PublicUser データに依存する（author フィールドの JOIN）。
初期化順序:

```
1. usersStore の初期化（Unit-02 で実装済み）
2. postsStore.initializePosts(publicUsers)
3. commentsStore.initializeComments(publicUsers)
```

apps/server/src/index.ts のトップレベルで順次初期化する。

---

## 13. 成功条件確認

Unit-03 の成功条件（unit-of-work.md より）:

- [ ] `GET /` で記事一覧が表示される（モックデータ 5 件）
- [ ] `GET /posts/:id` で記事詳細とコメント一覧が表示される
- [ ] `GET /posts/new` で未認証アクセスが `/login` にリダイレクトされる
- [ ] `POST /posts` で認証済みユーザーが記事を新規投稿できる
- [ ] `GET /posts/:id/edit` で記事所有者以外がアクセスするとエラーになる
- [ ] `PUT /posts/:id` で記事の編集が保存される
- [ ] `POST /posts/:id/comments` でコメントが投稿される
- [ ] Markdown 記事本文が HTML として正しくレンダリングされる
- [ ] 全ページで RootLayout（ヘッダー・ナビ・フッター）が表示される
- [ ] 未認証ユーザーに表示しない要素（投稿ボタン・コメントフォーム等）が正しく制御される

---

## 14. 次のステージ

Functional Design 完了後は、以下のステージへ進む（unit-of-work.md の Construction 計画より）:

| ステージ | 実行有無 | 理由 |
|---------|---------|------|
| NFR Requirements | スキップ | Unit-02 で認証 NFR は確立済み。追加の NFR なし |
| NFR Design | スキップ | NFR Requirements をスキップするため |
| Infrastructure Design | スキップ | インフラ変更なし（Unit-01 で設定済み） |
| **Code Generation** | **実行** | 常時実行 |

次: **Code Generation Part 1（実装計画書の作成）**

---

*作成: AI-DLC Construction Phase - Unit-03 Functional Design*
*最終更新: 2026-05-04*
