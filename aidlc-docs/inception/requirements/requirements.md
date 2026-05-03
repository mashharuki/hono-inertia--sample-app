# 要件定義書

**プロジェクト**: Hono × Inertia.js × React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: ドラフト（承認待ち）

---

## 1. プロジェクト概要

### 1.1 目的

Hono × Inertia.js × React を中心とした技術スタックを実践的に学習するための、フルスタックブログサイトを構築する。最終的に Cloudflare Workers へデプロイし、エッジ環境での動作を確認する。

### 1.2 スコープ

- pnpm モノレポ構成（apps/server + apps/client）のセットアップ
- メール/パスワード認証付きブログサイトの実装
- モックデータによるコンテンツ管理（DB不要）
- Cloudflare Workers デプロイ対応
- プロフェッショナル・コーポレートデザイン（Tailwind CSS + Shadcn/ui）

### 1.3 スコープ外

- データベース（モックデータのみで完結）
- 自動テスト（学習用のため省略）
- SEO最適化（CSR前提）
- 外部公開API

---

## 2. 技術スタック

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| パッケージマネージャ | pnpm | モノレポ管理 |
| モノレポ構成 | pnpm workspaces | apps/server + apps/client |
| リンター/フォーマッター | Biome | ESLint/Prettier 代替 |
| フロントエンド | React + TypeScript | Inertia ページコンポーネント |
| スタイリング | Tailwind CSS | ユーティリティファースト |
| UIコンポーネント | Shadcn/ui | アクセシビリティ対応コンポーネント |
| バックエンド | Hono | エッジ対応軽量フレームワーク |
| SPA連携 | Inertia.js (@hono/inertia) | API不要のサーバー駆動SPA |
| ランタイム | Cloudflare Workers | エッジ配信 |
| デプロイツール | Wrangler | Workers CLI |
| ビルド | Vite + @hono/vite-dev-server | 開発サーバー兼バンドラ |

---

## 3. 機能要件

### 3.1 ブログ機能

#### FR-001: 記事一覧ページ
- すべての記事をカード形式で一覧表示する
- 各カードには記事タイトル・要約・投稿日時・著者名・タグを表示する
- 記事カードをクリックすると記事詳細ページへ遷移する
- ページネーションまたは無限スクロールで複数記事を閲覧できる

#### FR-002: 記事詳細ページ
- 記事のタイトル・本文（Markdown対応）・投稿日時・著者名・タグを表示する
- コメント一覧を表示する（モックデータ）
- 認証済みユーザーはコメントを投稿できる

#### FR-003: 記事投稿ページ（認証必須）
- タイトル・本文・タグを入力して新規記事を投稿できる
- 投稿成功後は記事詳細ページへリダイレクト（PRGパターン）
- Zodによるサーバーサイドバリデーション（タイトル必須・本文必須）

#### FR-004: 記事編集ページ（認証必須・自記事のみ）
- 既存記事のタイトル・本文・タグを編集できる
- 更新成功後は記事詳細ページへリダイレクト（PRGパターン）
- 自分以外の記事は編集不可（403エラー）

### 3.2 認証機能

#### FR-005: ユーザー登録
- メールアドレス・パスワード・表示名を入力して新規アカウントを作成できる
- メールアドレス重複チェックを行う
- 登録成功後はトップページへリダイレクト

#### FR-006: ログイン
- メールアドレスとパスワードでログインできる
- HttpOnly Cookie によるセッション管理
- ログイン成功後はトップページへリダイレクト

#### FR-007: ログアウト
- ヘッダーの「ログアウト」ボタンでセッションを破棄できる
- ログアウト後はトップページへリダイレクト

### 3.3 コメント機能

#### FR-008: コメント閲覧
- 記事詳細ページでコメント一覧を閲覧できる（認証不要）

#### FR-009: コメント投稿（認証必須）
- 認証済みユーザーは記事に対してコメントを投稿できる
- コメント投稿後はページをリフレッシュして最新コメントを表示する

---

## 4. 非機能要件

### 4.1 パフォーマンス・エッジ最適化

- NFR-001: Cloudflare Workers のバンドルサイズ制限（1MB）を遵守する
- NFR-002: Workers 上で Node.js ネイティブモジュールを使用しない（Web標準APIのみ）
- NFR-003: セッションはメモリストアを使用せず、Workers KV または Cookie ベースで管理する
- NFR-004: モックデータはコード内にハードコードし、外部DBへの依存を排除する

### 4.2 開発品質

- NFR-005: TypeScript の strict モードを有効にし、型安全性を最大化する
- NFR-006: Biome によるコードの統一フォーマット・リンティングを適用する
- NFR-007: Hono の型推論（ExtractSchema）を活用し、サーバー・クライアント間の型整合性を保つ

### 4.3 UI/UX

- NFR-008: デザインテーマはプロフェッショナル・コーポレート（ビジネス向けの落ち着いた配色）
- NFR-009: Shadcn/ui コンポーネントを活用し、アクセシビリティを確保する
- NFR-010: レスポンシブデザイン（モバイル・タブレット・デスクトップ対応）

### 4.4 セキュリティ

- NFR-011: パスワードは argon2 または bcrypt でハッシュ化して保存する
- NFR-012: セッション Cookie は HttpOnly・SameSite=Lax・Secure（本番）フラグを設定する
- NFR-013: CSRF対策として Inertia の X-CSRF-Token ヘッダー検証を有効にする
- NFR-014: 認証が必要なルートはサーバーサイドでミドルウェアにより保護する

### 4.5 デプロイ

- NFR-015: wrangler.toml でCloudflare Workers の設定を管理する
- NFR-016: 開発時は `wrangler dev` または `vite dev` で起動できる
- NFR-017: 本番デプロイは `wrangler deploy` コマンド一発で完了できる

---

## 5. ページ構成

| ページ | パス | 認証要否 | 概要 |
|-------|------|----------|------|
| トップ/記事一覧 | `/` | 不要 | 記事カード一覧 |
| 記事詳細 | `/posts/:id` | 不要 | 本文・コメント閲覧 |
| 記事投稿 | `/posts/new` | 必要 | 新規記事作成フォーム |
| 記事編集 | `/posts/:id/edit` | 必要 | 記事編集フォーム |
| ユーザー登録 | `/register` | 不要 | アカウント作成フォーム |
| ログイン | `/login` | 不要 | ログインフォーム |

---

## 6. データモデル（モックデータ）

### 6.1 ユーザー (User)

```typescript
type User = {
  id: string
  email: string
  name: string
  hashedPassword: string
  createdAt: Date
}
```

### 6.2 記事 (Post)

```typescript
type Post = {
  id: string
  title: string
  body: string         // Markdown テキスト
  excerpt: string      // 要約（一覧表示用）
  authorId: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
}
```

### 6.3 コメント (Comment)

```typescript
type Comment = {
  id: string
  postId: string
  authorId: string
  body: string
  createdAt: Date
}
```

---

## 7. モノレポ構成

```
hono-inertia--sample-app/
├── apps/
│   ├── server/                   # Hono バックエンド
│   │   ├── src/
│   │   │   ├── index.ts          # Hono エントリポイント
│   │   │   ├── routes/           # ルート定義
│   │   │   ├── middleware/       # 認証・セッション
│   │   │   ├── data/             # モックデータ
│   │   │   └── lib/              # ユーティリティ
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── client/                   # React フロントエンド
│       ├── src/
│       │   ├── main.tsx          # createInertiaApp エントリ
│       │   ├── pages/            # Inertia ページコンポーネント
│       │   ├── components/       # 共有UIコンポーネント
│       │   └── layouts/          # レイアウトコンポーネント
│       └── package.json
├── packages/
│   └── shared/                   # 共有型・Zodスキーマ
│       └── src/
│           └── schemas/
├── pnpm-workspace.yaml
├── biome.json
└── package.json
```

---

## 8. 制約事項・前提条件

- データベースは使用しない。全データはモック（TypeScript オブジェクト）として管理する
- テストコード（ユニット・E2E）は実装しない
- Cloudflare Workers の制約（Node.js API不可・バンドルサイズ1MB以内）を最初から遵守する
- セッションの永続化は Workers KV または Cookie ベースとする（メモリ不可）
- 認証は自前実装（Better Auth または DIYセッション + Hono Cookie）を使用する

---

## 9. 想定する学習成果

このプロジェクトを通じて習得することを目的とする技術：

1. Hono の基本的なルーティング・ミドルウェア・型システム
2. @hono/inertia による Inertia プロトコルの実装
3. Inertia.js の `c.render()` / `useForm` / `usePage` パターン
4. Cloudflare Workers へのデプロイと Workers の制約理解
5. pnpm モノレポの構成と管理
6. Biome によるコード品質管理

---

*作成: AI-DLC Requirements Analysis ステージ*
*最終更新: 2026-05-04*
