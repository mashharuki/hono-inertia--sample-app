# Code Generation Plan - Unit-01: 基盤セットアップ

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-01 基盤セットアップ
**作成日**: 2026-05-04
**ステータス**: 完了（Part 2 - 全ステップ完了）

---

## 生成するファイル一覧（実装順）

### Step 1: モノレポルート設定ファイル群

- [x] `pnpm-workspace.yaml` - pnpm ワークスペース定義
- [x] `package.json`（ルート）- ルートスクリプト・devDependencies
- [x] `biome.json` - リンター・フォーマッター設定
- [x] `tsconfig.json`（ルート）- TypeScript プロジェクト参照
- [x] `.gitignore` - 無視ファイル設定（.dev.vars・.wrangler 含む）

### Step 2: packages/shared（共有型・スキーマ）

- [x] `packages/shared/package.json` - 共有パッケージ定義
- [x] `packages/shared/tsconfig.json` - TypeScript 設定
- [x] `packages/shared/src/types/index.ts` - User / Post / Comment / PublicUser 型定義
- [x] `packages/shared/src/schemas/auth.ts` - registerSchema / loginSchema（Zod）
- [x] `packages/shared/src/schemas/posts.ts` - createPostSchema / updatePostSchema（Zod）
- [x] `packages/shared/src/schemas/comments.ts` - createCommentSchema（Zod）
- [x] `packages/shared/src/index.ts` - エクスポートエントリポイント

### Step 3: apps/server（Hono サーバー骨格）

- [x] `apps/server/package.json` - サーバーパッケージ定義
- [x] `apps/server/tsconfig.json` - TypeScript 設定（@cloudflare/workers-types）
- [x] `apps/server/vite.config.ts` - @hono/vite-dev-server 設定
- [x] `apps/server/wrangler.toml` - Cloudflare Workers デプロイ設定
- [x] `apps/server/src/index.ts` - Hono アプリ初期化・ミドルウェア登録・静的ファイル配信

### Step 4: apps/client（React + Inertia クライアント骨格）

- [x] `apps/client/package.json` - クライアントパッケージ定義
- [x] `apps/client/tsconfig.json` - TypeScript 設定（JSX 含む）
- [x] `apps/client/vite.config.ts` - Vite + React プラグイン設定
- [x] `apps/client/index.html` - Vite HTML テンプレート（Inertia root div）
- [x] `apps/client/tailwind.config.ts` - Tailwind CSS 設定
- [x] `apps/client/postcss.config.js` - PostCSS 設定
- [x] `apps/client/src/main.tsx` - createInertiaApp エントリポイント
- [x] `apps/client/src/layouts/RootLayout.tsx` - 共通レイアウト（ヘッダー・フッター・ナビ）
- [x] `apps/client/src/styles/globals.css` - Tailwind ディレクティブ + CSS 変数

---

## 実装方針

1. **既存コードの確認**: 現在のリポジトリに既存ファイルがあれば確認・活用する
2. **Cloudflare Workers 準拠**: Node.js API を使用しない
3. **最小構成**: Unit-01 では骨格のみ実装。CRUD・認証は Unit-02, 03 で追加
4. **Hono の最新パターン**: `@hono/inertia` を使用した Inertia プロトコル実装
5. **Shadcn/ui**: RootLayout に基本的な Shadcn/ui コンポーネントを設置

---

*作成: AI-DLC Construction Phase - Unit-01 Code Generation Plan*
*最終更新: 2026-05-04*
