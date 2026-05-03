# コンポーネント定義書

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. コンポーネント概要

本プロジェクトは pnpm モノレポ構成を採用し、以下のパッケージに分割される。

| パッケージ | パス | 役割 |
|-----------|------|------|
| server | apps/server | Hono バックエンド（Cloudflare Workers） |
| client | apps/client | React + Inertia.js フロントエンド |
| shared | packages/shared | 共有型定義・Zod スキーマ |

---

## 2. apps/server コンポーネント

### 2.1 エントリポイント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| App Entry | `src/index.ts` | Hono アプリケーション初期化・全ルート集約・Inertia ミドルウェア登録 |

**責務詳細**:
- Hono インスタンスを生成し、全ルートをマウントする
- Inertia ミドルウェアを最初に登録し、全リクエストで Inertia プロトコルを処理できる状態にする
- 静的ファイルサービングを設定する（Vite ビルド成果物）
- Cloudflare Workers のエントリポイントとして `export default app` する

### 2.2 ルートコンポーネント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Auth Routes | `src/routes/auth.ts` | 認証関連エンドポイント（登録・ログイン・ログアウト） |
| Post Routes | `src/routes/posts.ts` | 記事 CRUD エンドポイント |
| Comment Routes | `src/routes/comments.ts` | コメント投稿エンドポイント |

**Auth Routes 責務**:
- `POST /register` - ユーザー登録処理・パスワードハッシュ・セッション発行
- `POST /login` - メール/パスワード検証・セッション発行
- `POST /logout` - セッション Cookie 削除

**Post Routes 責務**:
- `GET /` - 記事一覧の取得・Inertia レンダリング
- `GET /posts/:id` - 記事詳細の取得・コメント含む
- `GET /posts/new` - 記事投稿フォームの表示（認証保護）
- `POST /posts` - 記事新規作成・バリデーション
- `GET /posts/:id/edit` - 記事編集フォームの表示（認証保護・所有者チェック）
- `PUT /posts/:id` - 記事更新・バリデーション（所有者チェック）

**Comment Routes 責務**:
- `POST /posts/:id/comments` - コメント投稿（認証保護）

### 2.3 ミドルウェアコンポーネント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Auth Middleware | `src/middleware/auth.ts` | セッション Cookie 検証・ユーザー情報コンテキスト付与 |
| Session Middleware | `src/middleware/session.ts` | Cookie ベースセッションの読み書き・署名検証 |

**Auth Middleware 責務**:
- リクエストヘッダーの Cookie から sessionId を取得する
- sessionId を検証し、対応するユーザー情報を Hono Context に設定する
- 認証失敗時は未認証状態としてコンテキストを設定する（エラーにはしない）
- 認証必須ルートでは 401 または /login へのリダイレクトを返す

**Session Middleware 責務**:
- HMAC-SHA256 で署名された Cookie を生成・検証する
- Web Crypto API（Cloudflare Workers 対応）を使用する
- セッションデータ（userId）を Cookie に格納する
- HttpOnly・SameSite=Lax・Secure（本番）フラグを設定する

### 2.4 データコンポーネント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Users Store | `src/data/users.ts` | ユーザーモックデータ・ユーザー検索メソッド |
| Posts Store | `src/data/posts.ts` | 記事モックデータ・記事 CRUD シミュレーション |
| Comments Store | `src/data/comments.ts` | コメントモックデータ・コメント追加シミュレーション |

**Users Store 責務**:
- 初期ユーザーデータ（3名程度）を定義する
- `findByEmail(email)` - メール検索
- `findById(id)` - ID 検索
- `create(data)` - ユーザー追加（メモリ内）
- パスワードは PBKDF2（Web Crypto API）でハッシュ化済みの初期データを保持する

**Posts Store 責務**:
- 初期記事データ（5件程度）を定義する
- `findAll()` - 全件取得
- `findById(id)` - ID 検索
- `create(data)` - 記事追加（メモリ内）
- `update(id, data)` - 記事更新（メモリ内）

**Comments Store 責務**:
- 初期コメントデータ（各記事に 2〜3件）を定義する
- `findByPostId(postId)` - 記事に紐づくコメント一覧取得
- `create(data)` - コメント追加（メモリ内）

### 2.5 ライブラリコンポーネント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Crypto Utils | `src/lib/crypto.ts` | PBKDF2 パスワードハッシュ・検証（Web Crypto API） |
| Session Utils | `src/lib/session.ts` | セッション ID 生成・署名・検証ユーティリティ |

**Crypto Utils 責務**:
- `hashPassword(password)` - PBKDF2 でハッシュ化
- `verifyPassword(password, hash)` - ハッシュ比較
- Web Crypto API のみ使用（Workers 対応）

---

## 3. apps/client コンポーネント

### 3.1 エントリポイント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Inertia Entry | `src/main.tsx` | createInertiaApp・ページコンポーネント解決・ハイドレーション |

**責務詳細**:
- `createInertiaApp` を呼び出し、ページ名からコンポーネントを動的ロードする
- `resolveComponent` はページ名を `./pages/` ディレクトリ内のファイルパスにマップする

### 3.2 レイアウトコンポーネント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Root Layout | `src/layouts/RootLayout.tsx` | ヘッダー・フッター・ナビゲーション・認証状態表示 |

**Root Layout 責務**:
- 全ページ共通のヘッダーとフッターを提供する
- ナビゲーションにはロゴ・記事一覧リンク・記事投稿リンク（認証時のみ）・ユーザー名（認証時）・ログアウトボタン（認証時）・ログイン/登録ボタン（未認証時）を含む
- Inertia の `usePage` フックで現在の認証ユーザー情報を取得する

### 3.3 ページコンポーネント（Inertia Pages）

| コンポーネント | ファイル | 対応 US | 対応 FR |
|--------------|---------|---------|---------|
| Home | `src/pages/Home.tsx` | US-001 | FR-001 |
| PostShow | `src/pages/PostShow.tsx` | US-002, US-008 | FR-002, FR-008, FR-009 |
| PostNew | `src/pages/PostNew.tsx` | US-005 | FR-003 |
| PostEdit | `src/pages/PostEdit.tsx` | US-006 | FR-004 |
| Register | `src/pages/Register.tsx` | US-003 | FR-005 |
| Login | `src/pages/Login.tsx` | US-004 | FR-006 |

**Home (src/pages/Home.tsx) 責務**:
- Inertia からサーバー経由で渡された `posts` プロップを表示する
- 記事カード一覧（タイトル・要約・投稿日時・著者名・タグ）をレンダリングする
- 各カードクリックで `/posts/:id` への Inertia 遷移を行う

**PostShow (src/pages/PostShow.tsx) 責務**:
- サーバー経由で渡された `post`・`comments`・`currentUser` プロップを表示する
- 記事本文を Markdown レンダリングする
- コメント一覧を表示する
- 認証済みユーザーにコメント投稿フォームを表示する
- 自記事の場合は編集リンクを表示する

**PostNew (src/pages/PostNew.tsx) 責務**:
- Inertia `useForm` フックでフォーム状態・バリデーションエラーを管理する
- タイトル・本文・タグ入力フォームを提供する
- `POST /posts` エンドポイントへ Inertia フォーム送信する

**PostEdit (src/pages/PostEdit.tsx) 責務**:
- サーバーから渡された `post` プロップで初期値を設定する
- Inertia `useForm` フックでフォーム状態を管理する
- `PUT /posts/:id` エンドポイントへ Inertia フォーム送信する

**Register (src/pages/Register.tsx) 責務**:
- メールアドレス・パスワード・表示名の登録フォームを提供する
- Inertia `useForm` フックでバリデーションエラーを管理する
- `POST /register` エンドポイントへ送信する

**Login (src/pages/Login.tsx) 責務**:
- メールアドレス・パスワードのログインフォームを提供する
- Inertia `useForm` フックでエラーを管理する
- `POST /login` エンドポイントへ送信する

### 3.4 共有 UI コンポーネント

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| PostCard | `src/components/PostCard.tsx` | 記事カード表示（一覧用） |
| CommentList | `src/components/CommentList.tsx` | コメント一覧表示 |
| CommentForm | `src/components/CommentForm.tsx` | コメント投稿フォーム |
| MarkdownRenderer | `src/components/MarkdownRenderer.tsx` | Markdown テキストの HTML 変換・表示 |

---

## 4. packages/shared コンポーネント

### 4.1 型定義

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Types | `src/types/index.ts` | User・Post・Comment の TypeScript 型定義 |

### 4.2 Zod スキーマ

| コンポーネント | ファイル | 責務 |
|--------------|---------|------|
| Auth Schemas | `src/schemas/auth.ts` | 登録・ログインのバリデーションスキーマ |
| Post Schemas | `src/schemas/posts.ts` | 記事作成・更新のバリデーションスキーマ |
| Comment Schemas | `src/schemas/comments.ts` | コメント投稿のバリデーションスキーマ |

---

*作成: AI-DLC Application Design ステージ*
*最終更新: 2026-05-04*
