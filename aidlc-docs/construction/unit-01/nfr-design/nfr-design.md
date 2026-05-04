# NFR Design - Unit-01: 基盤セットアップ

**プロジェクト**: Hono x Inertia.js x React ブログサイト
**Unit**: Unit-01 基盤セットアップ
**作成日**: 2026-05-04
**バージョン**: 1.0
**前提**: nfr-requirements.md の要件を設計に落とし込む

---

## 1. Cloudflare Workers 対応設計パターン

### 1.1 Web Crypto API 優先設計

NFR-CW-002（Node.js ネイティブ API 禁止）に対応するため、
すべての暗号化処理は Web Crypto API（`globalThis.crypto`）を使用する。

```typescript
// 使用可能パターン
const crypto = globalThis.crypto  // Workers で利用可能
await crypto.subtle.digest('SHA-256', data)
await crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, key, data)
await crypto.subtle.importKey(...)

// 禁止パターン
import { createHash } from 'crypto'  // Node.js API - 禁止
import { randomBytes } from 'crypto'  // Node.js API - 禁止

// 代替パターン
crypto.getRandomValues(new Uint8Array(32))  // Web Crypto API - 使用可
```

### 1.2 ステートレス設計パターン

NFR-CW-003（メモリ永続化禁止）に対応するため:

```
リクエスト毎に完結する設計:
  Request → Middleware（Cookie検証） → Handler（モックデータ参照）→ Response
         ↑                                    ↑
  状態はCookieに持つ              データはコード内定数（読み取り専用）
```

モックデータは TypeScript の `const` で定義し、実行時に変更しない（注: ユニット02以降でCRUD実装時は配列操作を行うが、Workers の再起動で初期化される学習用途と明示）。

---

## 2. モノレポ構成設計

### 2.1 pnpm workspace 設計

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

パッケージ間依存関係:

```
apps/server  ──depends on──> packages/shared
apps/client  ──depends on──> packages/shared
```

```json
// apps/server/package.json
{
  "dependencies": {
    "@repo/shared": "workspace:*"
  }
}

// apps/client/package.json
{
  "dependencies": {
    "@repo/shared": "workspace:*"
  }
}

// packages/shared/package.json
{
  "name": "@repo/shared"
}
```

### 2.2 TypeScript プロジェクト参照設計

各パッケージに `tsconfig.json` を配置し、`references` で型解決を高速化:

```json
// tsconfig.json（ルート）
{
  "references": [
    { "path": "./apps/server" },
    { "path": "./apps/client" },
    { "path": "./packages/shared" }
  ]
}
```

---

## 3. Vite 設定設計

### 3.1 apps/server の Vite 設定

```typescript
// apps/server/vite.config.ts
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
        format: 'es',  // Cloudflare Workers は ES modules
      },
    },
  },
})
```

### 3.2 apps/client の Vite 設定

```typescript
// apps/client/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/public',  // サーバーの public ディレクトリに出力
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

---

## 4. バンドルサイズ管理設計

### 4.1 Workers バンドル（サーバー側）

NFR-CW-001（1MB 制限）への対応:

| 依存ライブラリ | 概算サイズ | 備考 |
|-------------|---------|------|
| hono | ~35 KB | コア機能のみ使用 |
| @hono/inertia | ~10 KB | 予想値 |
| zod | ~30 KB | Tree-shaking 前提 |
| **合計（予想）** | ~75 KB | 1MB 制限の余裕あり |

### 4.2 クライアントバンドル

| チャンク | 概算サイズ（gzip）| 備考 |
|---------|-----------------|------|
| vendor（React系）| ~45 KB | React + ReactDOM |
| inertia | ~15 KB | @inertiajs/react |
| app（コード）| ~30 KB | ページ・コンポーネント |
| **合計（予想）** | ~90 KB | 目標 200KB 以内 |

---

## 5. Wrangler 設定設計

```toml
# apps/server/wrangler.toml
name = "hono-inertia-blog"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[build]
command = "cd ../.. && pnpm --filter apps/client build"

[vars]
ENVIRONMENT = "production"

# ローカル開発用（.dev.vars に SESSION_SECRET を記載）
# SESSION_SECRET はシークレット管理（wrangler secret put SESSION_SECRET）

[[assets]]
directory = "public"
```

### .dev.vars（ローカル開発用・gitignore 対象）

```
SESSION_SECRET=local-development-secret-key-32chars
ENVIRONMENT=development
```

---

## 6. Biome 設定設計

```json
// biome.json（ルート）
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "useImportType": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "files": {
    "ignore": ["node_modules", "dist", "public", ".wrangler"]
  }
}
```

---

## 7. セキュリティヘッダー設計

NFR-SEC-002 に基づき、Hono ミドルウェアでデフォルトヘッダーを設定:

```typescript
// apps/server/src/index.ts にて
import { secureHeaders } from 'hono/secure-headers'

app.use('*', secureHeaders())
// X-Content-Type-Options, X-Frame-Options, X-XSS-Protection などを自動設定
```

---

## 8. ルートスクリプト設計

```json
// package.json（ルート）
{
  "scripts": {
    "dev": "pnpm --filter @repo/server dev",
    "build": "pnpm --filter @repo/client build && pnpm --filter @repo/server build",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "typecheck": "tsc --build --noEmit"
  }
}
```

---

## 9. NFR 設計チェックリスト

- [x] Web Crypto API 使用パターンを定義済み
- [x] ステートレス設計パターンを定義済み
- [x] pnpm workspace 構成を設計済み
- [x] TypeScript プロジェクト参照を設計済み
- [x] Vite 設定（サーバー・クライアント）を設計済み
- [x] バンドルサイズ予測（Workers 1MB 制限内）を確認済み
- [x] wrangler.toml 設定を設計済み
- [x] .dev.vars の gitignore 対応を設計済み
- [x] Biome 設定を設計済み
- [x] セキュリティヘッダー（Hono secureHeaders）を設計済み
- [x] ルートスクリプトを設計済み

---

*作成: AI-DLC Construction Phase - Unit-01 NFR Design ステージ*
*最終更新: 2026-05-04*
