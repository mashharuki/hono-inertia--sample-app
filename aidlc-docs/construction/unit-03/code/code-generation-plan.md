# Unit-03 コード生成計画（Code Generation Plan）

**Unit**: Unit-03 - ブログ機能
**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: 完了（Part 2 コード生成完了 - 2026-05-04）

---

## 概要

Unit-03 では、ブログ機能の全コンポーネントを実装する。
Unit-01（基盤）・Unit-02（認証）で確立したパターン（ステートレス設計、Web Crypto API、
Inertia SharedProps、requireAuth ミドルウェア）をそのまま活用する。

**実装ファイル総数**: 13ファイル（新規 12 + 既存更新 1）

---

## 実装ステップ一覧

### Step 1: サーバー - データストア層（2ファイル 新規）

> postsStore と commentsStore を実装する。usersStore と同パターンの遅延初期化を採用。
> ただし posts/comments はパスワードハッシュ生成が不要なため同期初期化でも可。

- [x] **`apps/server/src/stores/postsStore.ts`** （新規）
  - `Post[]` のインメモリ配列を管理
  - モックデータ 5 件を遅延初期化（`ensureInitialized` パターン）
  - usersStore の PublicUser を参照して `author` フィールドを JOIN
  - メソッド: `findAll()` / `findById(id)` / `create(data, author)` / `update(id, data)`
  - `findAll()` は createdAt 降順ソートを返す

- [x] **`apps/server/src/stores/commentsStore.ts`** （新規）
  - `Comment[]` のインメモリ配列を管理
  - モックデータ 5 件を遅延初期化（`ensureInitialized` パターン）
  - usersStore の PublicUser を参照して `author` フィールドを JOIN
  - メソッド: `findByPostId(postId)` / `create(data, author)`
  - `findByPostId()` は createdAt 昇順ソートを返す

---

### Step 2: サーバー - ルートハンドラー層（2ファイル 新規）

> Functional Design の API 仕様（セクション 6 / 10）に従い実装。
> ルート順序に注意: `/posts/new` を `/posts/:id` より先に登録する。

- [x] **`apps/server/src/routes/posts.ts`** （新規）
  - `GET /`（記事一覧）: ページネーション付き（perPage=10、降順）
  - `GET /posts/new`（投稿フォーム）: requireAuth 適用
  - `POST /posts`（記事作成）: requireAuth + createPostSchema バリデーション
  - `GET /posts/:id`（記事詳細）: コメント付き
  - `GET /posts/:id/edit`（編集フォーム）: requireAuth + 所有者チェック
  - `POST /posts/:id`（記事更新）: requireAuth + 所有者チェック + updatePostSchema
    ※ Inertia.js は `_method=PUT` で PUT をシミュレートするが、
    Hono では `router.post('/posts/:id')` 内で `_method` を確認して PUT を処理する

- [x] **`apps/server/src/routes/comments.ts`** （新規）
  - `POST /posts/:id/comments`（コメント投稿）: requireAuth + createCommentSchema バリデーション

---

### Step 3: サーバー - index.ts 更新（1ファイル 既存更新）

> Unit-03 ルーターを登録し、ホームページのルートハンドラーを postsRouter に委譲する。
> 既存の `app.get('/')` を postsRouter の記事一覧ハンドラーに置き換える。

- [x] **`apps/server/src/index.ts`** （既存更新）
  - `postsRouter` のインポートと `app.route('/', postsRouter)` 追加
  - `commentsRouter` のインポートと `app.route('/', commentsRouter)` 追加
  - 既存の `app.get('/')` プレースホルダーを削除（postsRouter に移管）
  - 既存の `app.get('/dashboard')` は保持

---

### Step 4: クライアント - 共有 UI コンポーネント（4ファイル 新規）

> `apps/client/src/components/` ディレクトリを新規作成し、再利用可能なコンポーネントを配置する。

- [x] **`apps/client/src/components/PostCard.tsx`** （新規）
  - 記事タイトル（`/posts/${post.id}` へのリンク）
  - 著者名 / 投稿日（日本語フォーマット: "2026年4月1日"）
  - タグリスト（バッジ形式）
  - 本文冒頭 100 文字のプレビュー（Markdown 記法を除去したプレーンテキスト）

- [x] **`apps/client/src/components/CommentList.tsx`** （新規）
  - コメント 0 件: "まだコメントはありません" を表示
  - 各コメント: 著者名 / 投稿日 / 本文（改行を `<br>` に変換）

- [x] **`apps/client/src/components/CommentForm.tsx`** （新規）
  - Inertia `useForm` で `{ body: '' }` を管理
  - `form.post('/posts/${postId}/comments')` でサブミット
  - 送信成功時に `form.reset()` でフォームをリセット
  - エラー表示（`form.errors.body`）

- [x] **`apps/client/src/components/MarkdownRenderer.tsx`** （新規）
  - `marked` + `DOMPurify` で Markdown を HTML に変換
  - `dangerouslySetInnerHTML` で描画
  - Tailwind Typography（`prose prose-slate`）でスタイリング
  - XSS 対策として DOMPurify.sanitize を必ず適用

---

### Step 5: クライアント - ページコンポーネント（4ファイル 新規 + 1ファイル 既存更新）

- [x] **`apps/client/src/pages/Home.tsx`** （既存更新）
  - 現在のウェルカムページから記事一覧ページに全面改修
  - Props: `{ posts: Post[], pagination: Pagination }`
  - 認証済みユーザーに「新しい記事を書く」ボタン（`/posts/new`）
  - `PostCard` コンポーネントで記事リスト表示
  - 記事 0 件: "まだ記事がありません" メッセージ
  - ページネーション表示（`totalPages > 1` の場合のみ）

- [x] **`apps/client/src/pages/PostShow.tsx`** （新規）
  - Props: `{ post: Post, comments: Comment[] }`
  - 記事ヘッダー（タイトル・著者・日付・タグ・編集リンク）
  - `MarkdownRenderer` で本文を表示
  - `CommentList` でコメント一覧表示
  - 認証済みユーザーのみ `CommentForm` を表示
  - 未認証: "コメントするにはログインが必要です" + ログインリンク
  - 所有者のみ編集リンク（`/posts/${post.id}/edit`）を表示

- [x] **`apps/client/src/pages/PostNew.tsx`** （新規）
  - Props: `Record<string, never>`
  - Inertia `useForm` で `{ title: '', body: '', tags: '' }` を管理
  - tags: カンマ区切り文字列で入力 → サーバー側で配列に変換
  - `form.post('/posts')` でサブミット
  - バリデーションエラーをフィールド下に表示
  - 「キャンセル」ボタン（`/` へリンク）

- [x] **`apps/client/src/pages/PostEdit.tsx`** （新規）
  - Props: `{ post: Post }`
  - 初期値: `post.title / post.body / post.tags.join(', ')`
  - tags: カンマ区切り文字列で管理 → サーバー側で配列に変換
  - `form.put('/posts/${post.id}')` でサブミット（Inertia が `_method=PUT` を付与）
  - バリデーションエラーをフィールド下に表示
  - 「キャンセル」ボタン（`/posts/${post.id}` へリンク）

---

### Step 6: クライアント - 依存パッケージ追加（package.json 更新）

> `marked` と `dompurify` はクライアントサイドのみで使用する。

- [x] **`apps/client/package.json`** （既存更新）
  - `marked` を dependencies に追加
  - `dompurify` を dependencies に追加
  - `@types/dompurify` を devDependencies に追加

---

## ファイル構成サマリー

```
apps/server/src/
├── stores/
│   ├── postsStore.ts        [新規] Step 1
│   └── commentsStore.ts     [新規] Step 1
├── routes/
│   ├── posts.ts             [新規] Step 2
│   ├── comments.ts          [新規] Step 2
│   └── auth.ts              [既存・変更なし]
└── index.ts                 [更新] Step 3

apps/client/src/
├── components/
│   ├── PostCard.tsx          [新規] Step 4
│   ├── CommentList.tsx       [新規] Step 4
│   ├── CommentForm.tsx       [新規] Step 4
│   └── MarkdownRenderer.tsx  [新規] Step 4
└── pages/
    ├── Home.tsx              [更新] Step 5
    ├── PostShow.tsx          [新規] Step 5
    ├── PostNew.tsx           [新規] Step 5
    └── PostEdit.tsx          [新規] Step 5

apps/client/package.json      [更新] Step 6
```

**合計**: 新規 12ファイル + 更新 2ファイル = 14操作

---

## 実装上の重要注意事項

### HTTP メソッドオーバーライド
- Inertia.js の `form.put()` は内部的に `POST` リクエストを送信し、
  フォームデータに `_method=PUT` を付与する
- Hono 側では `router.post('/posts/:id')` で `_method` を確認して PUT として処理する
- `app.use(methodOverride())` は不要（シンプルな `_method` 確認で対応）

### ストア初期化の依存関係
- postsStore と commentsStore は usersStore の初期化が完了した PublicUser データに依存する
- Cloudflare Workers の async 制約上、各ストアは `ensureInitialized()` パターンを採用
- usersStore は async（PBKDF2 ハッシュ計算が必要）なので先に初期化される保証が必要
- 解決策: postsStore/commentsStore のモックデータは固定の PublicUser 情報を使用する
  （usersStore の実際のデータには依存させず、独立したモックとして実装）

### Inertia バリデーションエラー
- Zod の `.safeParse()` でエラーを補足し、Inertia フォームに戻す
- エラーオブジェクト: `{ [field]: message }` 形式
- Inertia の `useForm().errors` でクライアント側が受け取れる形式に合わせる

### Tailwind CSS Typography
- `MarkdownRenderer.tsx` の `prose` クラスには `@tailwindcss/typography` が必要
- `apps/client/package.json` の devDependencies に追加するか、
  すでに含まれているか確認する（Step 6 で確認）

---

## 承認後の実行順序

Part 2（コード生成）は以下の順序で実行する:

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6
（データ層 → ルート層 → 統合 → UI コンポーネント → ページ → 依存関係）
```

各 Step 完了時に本ファイルのチェックボックスを `[x]` に更新する。

---

*作成: AI-DLC Construction Phase - Unit-03 Code Generation Part 1*
*最終更新: 2026-05-04*
