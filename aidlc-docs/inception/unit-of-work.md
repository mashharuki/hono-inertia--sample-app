# Unit of Work 定義書

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**作成日**: 2026-05-04
**バージョン**: 1.0
**ステータス**: レビュー中

---

## 1. Unit 分解方針

本プロジェクトは 3 つの機能領域を並行開発可能な Unit として分割する。
各 Unit は明確な責務境界を持ち、前の Unit が完了してから次の Unit へ進む逐次実行方式を採用する。

```
Unit-01 (基盤セットアップ)
     |
     v
Unit-02 (認証機能)  ←── Unit-01 完了が前提
     |
     v
Unit-03 (ブログ機能) ←── Unit-02 完了が前提
```

---

## 2. Unit 一覧サマリー

| Unit ID | 名称 | 実装順序 | 依存 Unit | 優先度 | 推定工数 |
|---------|------|---------|---------|--------|---------|
| Unit-01 | 基盤セットアップ | 1番目 | なし | Critical | 大 |
| Unit-02 | 認証機能 | 2番目 | Unit-01 | High | 中 |
| Unit-03 | ブログ機能 | 3番目 | Unit-02 | High | 大 |

---

## 3. Unit-01: 基盤セットアップ

### 3.1 目的・スコープ

**目的**: プロジェクト全体の技術的基盤を確立する。後続のすべての Unit が依存する共通インフラ・設定・型定義を整備する。

**スコープ**:
- pnpm モノレポ構造の初期設定
- Hono サーバーの骨格（エントリポイント・設定ファイル）
- React + Inertia.js クライアントの骨格（エントリポイント・ビルド設定）
- 共通型定義・Zod スキーマの基盤
- Tailwind CSS + Shadcn/ui の導入
- Cloudflare Workers デプロイ設定
- Biome によるリンター・フォーマッター設定

### 3.2 含まれるコンポーネント（Application Design 参照）

#### apps/server
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| App Entry | `src/index.ts` | Hono アプリ初期化・ルート集約・Inertia ミドルウェア登録 |

#### apps/client
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Client Entry | `src/main.tsx` | createInertiaApp・ページ解決ロジック |
| Root Layout | `src/layouts/RootLayout.tsx` | 共通レイアウト（ヘッダー・フッター・ナビ） |

#### packages/shared
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Type Definitions | `src/types/index.ts` | User / Post / Comment / PublicUser 型 |
| Auth Schema | `src/schemas/auth.ts` | registerSchema / loginSchema (Zod) |
| Post Schema | `src/schemas/posts.ts` | createPostSchema / updatePostSchema (Zod) |
| Comment Schema | `src/schemas/comments.ts` | createCommentSchema (Zod) |

#### ルートファイル（モノレポ設定）
| ファイル | 役割 |
|---------|------|
| `pnpm-workspace.yaml` | pnpm ワークスペース定義 |
| `biome.json` | リンター・フォーマッター設定 |
| `package.json` (root) | ルートスクリプト定義 |
| `apps/server/vite.config.ts` | @hono/vite-dev-server 設定 |
| `apps/server/wrangler.toml` | Cloudflare Workers デプロイ設定 |
| `apps/server/package.json` | サーバーパッケージ設定 |
| `apps/client/package.json` | クライアントパッケージ設定 |
| `packages/shared/package.json` | 共有パッケージ設定 |

### 3.3 Construction ステージ計画

| ステージ | 実行有無 | 理由 |
|---------|---------|------|
| Functional Design | スキップ | データモデルの実質的な定義は Unit-02 以降 |
| NFR Requirements | 実行 | Cloudflare Workers 制約・バンドルサイズ・Node.js API 不可等のNFR設定が必要 |
| NFR Design | 実行 | NFR Requirements の結果を受けて設計に落とし込む |
| Infrastructure Design | 実行 | wrangler.toml・Vite 設定・モノレポ設定の詳細設計が必要 |
| Code Generation | 実行 | 常時実行 |

### 3.4 成功条件

- [ ] `pnpm install` でモノレポ全体のパッケージインストールが成功する
- [ ] `pnpm dev` (apps/server) でローカル開発サーバーが起動する
- [ ] ブラウザで `http://localhost:5173` にアクセスして初期ページが表示される
- [ ] TypeScript コンパイルエラーがゼロの状態でビルドできる
- [ ] `wrangler deploy` コマンドが実行可能な状態になっている（実際のデプロイは任意）
- [ ] `packages/shared` の型定義が `apps/server` と `apps/client` 双方から参照できる
- [ ] Tailwind CSS と Shadcn/ui の基本スタイルが適用されている

---

## 4. Unit-02: 認証機能

### 4.1 目的・スコープ

**目的**: メールアドレス・パスワードによる認証機能を実装する。Cloudflare Workers 対応の Web Crypto API を活用し、ステートレスな署名付き Cookie セッション管理を実現する。

**スコープ**:
- ユーザーモックデータの定義と CRUD 操作
- PBKDF2 パスワードハッシュ（Web Crypto API）
- HMAC-SHA256 署名付き Cookie セッション管理
- ユーザー登録・ログイン・ログアウト エンドポイント
- 認証ミドルウェア（requireAuth）
- セッション検証ミドルウェア
- 登録・ログインページ React コンポーネント

### 4.2 含まれるコンポーネント（Application Design 参照）

#### apps/server - ミドルウェア
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Auth Middleware | `src/middleware/auth.ts` | Cookie 検証・ユーザー情報コンテキスト付与・requireAuth |
| Session Middleware | `src/middleware/session.ts` | HMAC-SHA256 署名 Cookie 生成・検証 |

#### apps/server - データ
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Users Store | `src/data/users.ts` | ユーザーモックデータ・findByEmail・findById・create・existsByEmail |

#### apps/server - ライブラリ
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Crypto Utils | `src/lib/crypto.ts` | PBKDF2 hashPassword / verifyPassword (Web Crypto) |
| Session Utils | `src/lib/session.ts` | createSession / verifySession / clearSession (HMAC-SHA256) |

#### apps/server - ルート
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Auth Routes | `src/routes/auth.ts` | POST /register / POST /login / POST /logout |

#### apps/client - ページ
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Register Page | `src/pages/Register.tsx` | ユーザー登録フォーム |
| Login Page | `src/pages/Login.tsx` | ログインフォーム |

#### apps/server - 追加 Inertia ページ（Register / Login ルートハンドラー）
| ルート | ハンドラー所在 | Inertia コンポーネント |
|--------|------------|---------------------|
| `GET /register` | `src/routes/auth.ts` | `Register` |
| `GET /login` | `src/routes/auth.ts` | `Login` |

### 4.3 Construction ステージ計画

| ステージ | 実行有無 | 理由 |
|---------|---------|------|
| Functional Design | 実行 | ユーザーデータモデル・認証ビジネスロジック（PBKDF2・Cookie仕様）の設計が必要 |
| NFR Requirements | 実行 | セキュリティ要件（XSS対策・HttpOnly Cookie・CSRF対策）の確認が必要 |
| NFR Design | 実行 | NFR Requirements の結果を受けて設計に落とし込む |
| Infrastructure Design | スキップ | インフラ変更なし（Unit-01 で設定済み） |
| Code Generation | 実行 | 常時実行 |

### 4.4 成功条件

- [ ] `POST /register` でユーザー登録が成功し、セッション Cookie が発行される
- [ ] `POST /login` で正しい認証情報を入力するとログインに成功し Cookie が発行される
- [ ] `POST /login` で誤った認証情報を入力するとエラーメッセージが返る
- [ ] `POST /logout` でセッション Cookie が削除され未認証状態になる
- [ ] 認証必須ルートに未認証でアクセスすると `/login` にリダイレクトされる
- [ ] Register / Login ページが Inertia 経由で正常にレンダリングされる
- [ ] PBKDF2 ハッシュが Web Crypto API のみで実装されている（Node.js API 未使用）
- [ ] HttpOnly・SameSite=Lax フラグが Cookie に設定されている

---

## 5. Unit-03: ブログ機能

### 5.1 目的・スコープ

**目的**: ブログサイトのコア機能（記事の CRUD・コメント投稿・Markdown 表示）を実装する。認証済みユーザーの投稿・編集機能と、未認証ユーザーの閲覧機能を含む全 6 ページを完成させる。

**スコープ**:
- 記事・コメントのモックデータ定義と CRUD 操作
- 記事一覧・詳細・投稿・編集エンドポイント
- コメント投稿エンドポイント
- 全 6 ページ React コンポーネント（Home・PostShow・PostNew・PostEdit・Register・Loginはすでに Unit-02 で実装）
- 共有 UI コンポーネント（PostCard・CommentList・CommentForm・MarkdownRenderer）
- 記事所有者チェック（編集・削除は作成者のみ）

### 5.2 含まれるコンポーネント（Application Design 参照）

#### apps/server - データ
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Posts Store | `src/data/posts.ts` | 記事モックデータ（5件）・findAll・findById・create・update・delete |
| Comments Store | `src/data/comments.ts` | コメントモックデータ・findByPostId・create |

#### apps/server - ルート
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Post Routes | `src/routes/posts.ts` | GET / / GET /posts/:id / GET /posts/new / POST /posts / GET /posts/:id/edit / PUT /posts/:id |
| Comment Routes | `src/routes/comments.ts` | POST /posts/:id/comments |

#### apps/client - ページ
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| Home Page | `src/pages/Home.tsx` | 記事一覧ページ（PostCard 使用） |
| PostShow Page | `src/pages/PostShow.tsx` | 記事詳細 + コメント一覧・投稿フォーム |
| PostNew Page | `src/pages/PostNew.tsx` | 記事投稿フォーム（認証保護） |
| PostEdit Page | `src/pages/PostEdit.tsx` | 記事編集フォーム（認証保護・所有者チェック） |

#### apps/client - 共有 UI コンポーネント
| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| PostCard | `src/components/PostCard.tsx` | 記事カード（一覧用・タイトル・日付・抜粋） |
| CommentList | `src/components/CommentList.tsx` | コメント一覧表示 |
| CommentForm | `src/components/CommentForm.tsx` | コメント投稿フォーム（認証済み時のみ表示） |
| MarkdownRenderer | `src/components/MarkdownRenderer.tsx` | Markdown → HTML 変換表示 |

### 5.3 Inertia ページマッピング（全件）

| URL | ハンドラー | Inertia コンポーネント | 認証 |
|-----|-----------|---------------------|------|
| `GET /` | posts.ts | Home | 不要 |
| `GET /posts/:id` | posts.ts | PostShow | 不要 |
| `GET /posts/new` | posts.ts | PostNew | 必要 |
| `GET /posts/:id/edit` | posts.ts | PostEdit | 必要（所有者のみ） |
| `GET /register` | auth.ts | Register | 不要 |
| `GET /login` | auth.ts | Login | 不要 |

### 5.4 Construction ステージ計画

| ステージ | 実行有無 | 理由 |
|---------|---------|------|
| Functional Design | 実行 | 記事・コメントデータモデル・所有者チェックロジック・Markdown処理の設計が必要 |
| NFR Requirements | スキップ | Unit-02 で認証 NFR は確立済み。追加の NFR なし |
| NFR Design | スキップ | NFR Requirements をスキップするため |
| Infrastructure Design | スキップ | インフラ変更なし（Unit-01 で設定済み） |
| Code Generation | 実行 | 常時実行 |

### 5.5 成功条件

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

## 6. 実装順序サマリー

```
Step 1: Unit-01 (基盤セットアップ)
  - モノレポ設定・Hono・React・Inertia.js・Tailwind・Shadcn/ui・wrangler
  - 完了後: ローカル開発環境が動作する状態

Step 2: Unit-02 (認証機能)
  - ユーザーモックデータ・PBKDF2・署名 Cookie・認証ミドルウェア・Register/Login ページ
  - 完了後: 登録・ログイン・ログアウトが動作する状態

Step 3: Unit-03 (ブログ機能)
  - 記事・コメントモックデータ・全 Hono ルート・全 React ページ・UI コンポーネント
  - 完了後: フル機能のブログサイトが動作する状態
```

---

## 7. 技術スタックサマリー

| レイヤー | 技術 | バージョン方針 |
|---------|------|--------------|
| ランタイム | Cloudflare Workers | latest |
| サーバーフレームワーク | Hono | v4.x |
| クライアントフレームワーク | React | v18.x |
| SPA ブリッジ | Inertia.js | v2.x |
| スタイリング | Tailwind CSS | v3.x |
| UI コンポーネント | Shadcn/ui | latest |
| ビルドツール | Vite + @hono/vite-dev-server | latest |
| パッケージマネージャー | pnpm (workspaces) | v9.x |
| 型チェック | TypeScript | v5.x |
| バリデーション | Zod | v3.x |
| リンター/フォーマッター | Biome | v1.x |
| デプロイツール | Wrangler | v3.x |
| 暗号化 | Web Crypto API (PBKDF2 + HMAC-SHA256) | 標準 API |

---

*作成: AI-DLC Units Generation ステージ*
*最終更新: 2026-05-04*
