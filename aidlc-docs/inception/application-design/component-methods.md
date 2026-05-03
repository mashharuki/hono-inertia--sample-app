# コンポーネントメソッド・API エンドポイント定義書

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. データストア（apps/server/src/data/）

### 1.1 usersStore

```typescript
// apps/server/src/data/users.ts

type User = {
  id: string
  email: string
  name: string
  hashedPassword: string
  createdAt: Date
}

interface UsersStore {
  findByEmail(email: string): User | undefined
  findById(id: string): User | undefined
  create(data: Omit<User, 'id' | 'createdAt'>): User
  existsByEmail(email: string): boolean
}
```

**メソッド詳細**:

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `findByEmail` | `email: string` | `User \| undefined` | メールアドレスでユーザーを検索する |
| `findById` | `id: string` | `User \| undefined` | ID でユーザーを検索する |
| `create` | `data: CreateUserInput` | `User` | ユーザーをメモリ内ストアに追加し返す |
| `existsByEmail` | `email: string` | `boolean` | メールアドレスの重複チェック |

### 1.2 postsStore

```typescript
// apps/server/src/data/posts.ts

type Post = {
  id: string
  title: string
  body: string
  excerpt: string
  authorId: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface PostsStore {
  findAll(): Post[]
  findById(id: string): Post | undefined
  create(data: CreatePostInput): Post
  update(id: string, data: UpdatePostInput): Post | undefined
  findByAuthorId(authorId: string): Post[]
}
```

**メソッド詳細**:

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `findAll` | なし | `Post[]` | 全記事を作成日降順で返す |
| `findById` | `id: string` | `Post \| undefined` | ID で記事を検索する |
| `create` | `data: CreatePostInput` | `Post` | 記事をメモリに追加し返す。excerpt は body の先頭 100 文字を自動生成する |
| `update` | `id: string, data: UpdatePostInput` | `Post \| undefined` | 記事を更新し返す。未存在の場合は undefined |
| `findByAuthorId` | `authorId: string` | `Post[]` | 著者 ID で記事を絞り込む |

### 1.3 commentsStore

```typescript
// apps/server/src/data/comments.ts

type Comment = {
  id: string
  postId: string
  authorId: string
  body: string
  createdAt: Date
}

interface CommentsStore {
  findByPostId(postId: string): Comment[]
  create(data: CreateCommentInput): Comment
}
```

**メソッド詳細**:

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `findByPostId` | `postId: string` | `Comment[]` | 記事 ID に紐づくコメントを作成日昇順で返す |
| `create` | `data: CreateCommentInput` | `Comment` | コメントをメモリに追加し返す |

---

## 2. ライブラリ（apps/server/src/lib/）

### 2.1 crypto.ts

```typescript
// apps/server/src/lib/crypto.ts（Web Crypto API のみ）

interface CryptoUtils {
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, storedHash: string): Promise<boolean>
}
```

**実装方針（PBKDF2）**:

```
アルゴリズム: PBKDF2
ハッシュ: SHA-256
イテレーション: 100,000
ソルト: 16 バイト（crypto.getRandomValues）
出力フォーマット: "<base64(salt)>:<base64(hash)>"
```

| メソッド | 説明 |
|---------|------|
| `hashPassword` | ランダムソルトを生成し PBKDF2 でハッシュ化。"salt:hash" 形式で返す |
| `verifyPassword` | 格納済みハッシュからソルトを抽出し再計算して比較する |

### 2.2 session.ts

```typescript
// apps/server/src/lib/session.ts（Web Crypto API のみ）

interface SessionUtils {
  createSession(userId: string, secret: string): Promise<string>
  verifySession(cookie: string, secret: string): Promise<string | null>
}
```

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `createSession` | `userId: string, secret: string` | `Promise<string>` | userId を署名し Cookie 値として返す |
| `verifySession` | `cookie: string, secret: string` | `Promise<string \| null>` | 署名を検証し userId を返す。不正な場合は null |

---

## 3. ミドルウェア（apps/server/src/middleware/）

### 3.1 session.ts

```typescript
// リクエストごとにセッション Cookie を読み取り、userId を Context に設定する
const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const cookie = getCookie(c, 'session')
  const secret = c.env.SESSION_SECRET
  if (cookie) {
    const userId = await verifySession(cookie, secret)
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
}
```

### 3.2 auth.ts

```typescript
// 認証必須ルート用ミドルウェア
const requireAuth: MiddlewareHandler = async (c, next) => {
  const currentUser = c.get('currentUser')
  if (!currentUser) {
    // Inertia リクエストの場合は 409、通常リクエストは /login へリダイレクト
    if (c.req.header('X-Inertia')) {
      return c.json({ url: '/login' }, 409)
    }
    return c.redirect('/login', 302)
  }
  await next()
}
```

---

## 4. Inertia ページコンポーネント（apps/client/src/pages/）

### 4.1 Home.tsx

**Props（サーバーから渡される）**:

```typescript
type HomeProps = {
  posts: Array<{
    id: string
    title: string
    excerpt: string
    authorName: string
    tags: string[]
    createdAt: string
  }>
  currentUser: { id: string; name: string } | null
}
```

**主要処理**:
- `usePage<HomeProps>()` で props を取得
- `PostCard` コンポーネントをマップしてレンダリング
- 認証済みユーザーには「新規投稿」ボタンを表示

### 4.2 PostShow.tsx

**Props**:

```typescript
type PostShowProps = {
  post: {
    id: string
    title: string
    body: string
    authorId: string
    authorName: string
    tags: string[]
    createdAt: string
    updatedAt: string
  }
  comments: Array<{
    id: string
    authorName: string
    body: string
    createdAt: string
  }>
  currentUser: { id: string; name: string } | null
}
```

**主要処理**:
- `MarkdownRenderer` で本文を表示
- `CommentList` でコメント一覧を表示
- `currentUser?.id === post.authorId` の場合に編集リンクを表示
- 認証済みユーザーには `CommentForm` を表示

### 4.3 PostNew.tsx / PostEdit.tsx

**PostNew Props**:

```typescript
type PostNewProps = {
  currentUser: { id: string; name: string }
}
```

**PostEdit Props**:

```typescript
type PostEditProps = {
  post: {
    id: string
    title: string
    body: string
    tags: string[]
  }
  currentUser: { id: string; name: string }
}
```

**共通処理**:

```typescript
// useForm の使用パターン
const form = useForm({
  title: '',
  body: '',
  tags: '',
})

// 送信処理
form.post('/posts')         // PostNew
form.put(`/posts/${post.id}`) // PostEdit
```

### 4.4 Register.tsx / Login.tsx

**Register Props**: なし（空フォーム）

**Login Props**: なし（空フォーム）

```typescript
// Login の useForm パターン
const form = useForm({
  email: '',
  password: '',
})
form.post('/login')
```

---

## 5. 共有型定義（packages/shared/src/）

### 5.1 types/index.ts

```typescript
export type User = {
  id: string
  email: string
  name: string
  hashedPassword: string
  createdAt: Date
}

export type Post = {
  id: string
  title: string
  body: string
  excerpt: string
  authorId: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export type Comment = {
  id: string
  postId: string
  authorId: string
  body: string
  createdAt: Date
}

// サーバーからクライアントへ渡す型（パスワード除外）
export type PublicUser = Omit<User, 'hashedPassword'>
```

### 5.2 schemas/auth.ts

```typescript
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
  name: z.string().min(1, '表示名は必須です').max(50, '表示名は50文字以内です'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'パスワードは必須です'),
})
```

### 5.3 schemas/posts.ts

```typescript
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200, 'タイトルは200文字以内です'),
  body: z.string().min(1, '本文は必須です'),
  tags: z.string().optional(), // カンマ区切り文字列
})

export const updatePostSchema = createPostSchema
```

### 5.4 schemas/comments.ts

```typescript
import { z } from 'zod'

export const createCommentSchema = z.object({
  body: z.string().min(1, 'コメントは必須です').max(1000, 'コメントは1000文字以内です'),
})
```

---

*作成: AI-DLC Application Design ステージ*
*最終更新: 2026-05-04*
