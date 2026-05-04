# Infrastructure Design - Unit-01: 基盤セットアップ

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-01 基盤セットアップ
**作成日**: 2026-05-04
**バージョン**: 1.0

---

## 1. デプロイアーキテクチャ

```
[ブラウザ]
    |
    | HTTP/HTTPS
    v
[Cloudflare Edge Network]
    |
    +-- Workers（Hono サーバー）
    |       - src/index.ts エントリポイント
    |       - Inertia SSR レスポンス（HTML）
    |       - API レスポンス（JSON）
    |
    +-- Assets（静的ファイル）
            - apps/client ビルド成果物
            - React バンドル（JS/CSS）
            - index.html（Inertia SPA テンプレート）
```

---

## 2. モノレポディレクトリ構造（最終形）

```
hono-inertia--sample-app/             # リポジトリルート
├── apps/
│   ├── server/                       # Hono バックエンド（Workers ターゲット）
│   │   ├── src/
│   │   │   ├── index.ts              # Hono アプリ初期化・ミドルウェア登録
│   │   │   ├── routes/               # ルート定義（Unit-02, 03 で追加）
│   │   │   ├── middleware/           # 認証・セッション（Unit-02 で追加）
│   │   │   ├── data/                 # モックデータ（Unit-02, 03 で追加）
│   │   │   └── lib/                  # ユーティリティ（Unit-02 で追加）
│   │   ├── public/                   # クライアントビルド出力先
│   │   │   └── （client build 成果物が入る）
│   │   ├── vite.config.ts            # @hono/vite-dev-server 設定
│   │   ├── wrangler.toml             # Cloudflare Workers デプロイ設定
│   │   ├── tsconfig.json             # サーバー TS 設定
│   │   └── package.json              # サーバーパッケージ定義
│   └── client/                       # React フロントエンド
│       ├── src/
│       │   ├── main.tsx              # createInertiaApp エントリポイント
│       │   ├── layouts/
│       │   │   └── RootLayout.tsx    # 共通レイアウト
│       │   ├── pages/                # Inertia ページ（Unit-02, 03 で追加）
│       │   └── components/           # 共有 UI コンポーネント（Unit-03 で追加）
│       ├── index.html                # Vite HTML テンプレート
│       ├── vite.config.ts            # クライアント Vite 設定
│       ├── tsconfig.json             # クライアント TS 設定
│       └── package.json              # クライアントパッケージ定義
├── packages/
│   └── shared/                       # 共有型・Zodスキーマ
│       ├── src/
│       │   ├── types/
│       │   │   └── index.ts          # User / Post / Comment / PublicUser
│       │   └── schemas/
│       │       ├── auth.ts           # registerSchema / loginSchema
│       │       ├── posts.ts          # createPostSchema / updatePostSchema
│       │       └── comments.ts       # createCommentSchema
│       ├── tsconfig.json             # 共有パッケージ TS 設定
│       └── package.json              # 共有パッケージ定義
├── pnpm-workspace.yaml               # pnpm モノレポ設定
├── biome.json                        # リンター・フォーマッター設定
├── tsconfig.json                     # ルート TS 設定（references）
├── package.json                      # ルートスクリプト定義
└── .gitignore                        # node_modules / .dev.vars など
```

---

## 3. 各設定ファイルの詳細仕様

### 3.1 pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 3.2 package.json（ルート）

```json
{
  "name": "hono-inertia-blog",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @repo/server dev",
    "build:client": "pnpm --filter @repo/client build",
    "build:server": "pnpm --filter @repo/server build",
    "build": "pnpm build:client && pnpm build:server",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "tsc --build --noEmit"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "typescript": "^5.7.0"
  }
}
```

### 3.3 apps/server/package.json

```json
{
  "name": "@repo/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@hono/vite-dev-server": "^0.x",
    "hono": "^4.x",
    "@hono/inertia": "^0.x",
    "@repo/shared": "workspace:*",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.x",
    "vite": "^6.x",
    "wrangler": "^3.x"
  }
}
```

### 3.4 apps/client/package.json

```json
{
  "name": "@repo/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@inertiajs/react": "^2.x",
    "@repo/shared": "workspace:*",
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "@vitejs/plugin-react": "^4.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x",
    "tailwindcss": "^3.x",
    "vite": "^6.x"
  }
}
```

### 3.5 packages/shared/package.json

```json
{
  "name": "@repo/shared",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./schemas/*": "./src/schemas/*.ts"
  },
  "dependencies": {
    "zod": "^3.x"
  }
}
```

### 3.6 apps/server/wrangler.toml

```toml
name = "hono-inertia-blog"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = ""

[vars]
ENVIRONMENT = "production"

[[assets]]
directory = "public"
binding = "ASSETS"
```

### 3.7 apps/server/vite.config.ts

```typescript
import { defineConfig } from 'vite'
import { devServer } from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'

export default defineConfig({
  plugins: [
    devServer({
      adapter,
      entry: 'src/index.ts',
    }),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: 'src/index.ts',
      output: {
        format: 'es',
      },
    },
  },
})
```

### 3.8 apps/client/vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          inertia: ['@inertiajs/react'],
        },
      },
    },
  },
})
```

### 3.9 TypeScript 設定

**tsconfig.json（ルート）**:
```json
{
  "compilerOptions": {
    "composite": true
  },
  "references": [
    { "path": "./apps/server" },
    { "path": "./apps/client" },
    { "path": "./packages/shared" }
  ],
  "files": []
}
```

**apps/server/tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@repo/shared": ["../../packages/shared/src/index.ts"],
      "@repo/shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

**apps/client/tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@": ["./src"],
      "@repo/shared": ["../../packages/shared/src/index.ts"],
      "@repo/shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

**packages/shared/tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

### 3.10 .gitignore（追加項目）

```
# Cloudflare Workers
.dev.vars
.wrangler/

# pnpm
node_modules/
.pnpm-store/

# Build outputs
dist/
apps/server/public/

# TypeScript
*.tsbuildinfo
```

---

## 4. 開発フロー設計

```
開発時:
  1. pnpm install                # 全パッケージインストール
  2. pnpm build:client           # React バンドルを apps/server/public/ に出力
  3. pnpm dev (apps/server)      # Hono 開発サーバー起動（localhost:5173）

デプロイ時:
  1. pnpm build                  # クライアント + サーバービルド
  2. cd apps/server
  3. wrangler deploy             # Cloudflare Workers にデプロイ
```

---

## 5. Infrastructure Design チェックリスト

- [x] モノレポ全体のディレクトリ構造を設計済み
- [x] pnpm-workspace.yaml の設定仕様を定義済み
- [x] 各 package.json（ルート・server・client・shared）の依存関係を定義済み
- [x] wrangler.toml の設定仕様を定義済み
- [x] vite.config.ts（server・client）の設定仕様を定義済み
- [x] tsconfig.json（プロジェクト参照構成）を設計済み
- [x] .gitignore の必要エントリを定義済み
- [x] 開発フロー（dev・build・deploy）を設計済み

---

*作成: AI-DLC Construction Phase - Unit-01 Infrastructure Design ステージ*
*最終更新: 2026-05-04*
