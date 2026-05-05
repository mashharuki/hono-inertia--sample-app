# パフォーマンステスト手順

## 概要

このプロジェクトは **学習用途** のため、自動パフォーマンステストは省略されています。
（Requirements Analysis Q9: 「テスト不要 - 学習用なので省略」）

ただし、Cloudflare Workers のエッジランタイムおよび Inertia.js SPA の特性を踏まえた
手動パフォーマンス確認手順を以下に示します。

---

## Cloudflare Workers パフォーマンス要件（参考）

| 指標 | 目標値 | 理由 |
|------|--------|------|
| Worker CPU 時間 | < 50ms | Workers の CPU 制限（無料: 10ms / 有料: 50ms） |
| バンドルサイズ | < 1MB（圧縮後） | Workers のスクリプトサイズ上限 |
| PBKDF2 処理時間 | < 200ms | NFR-AUTH-PERF-001 の要件 |
| SPA ページ遷移 | < 500ms（XHR） | Inertia.js リクエストの体感速度 |

---

## 手動パフォーマンス確認手順

### 確認 1: バンドルサイズの確認

```bash
# プロダクションビルドを実行
pnpm build

# サーバーバンドルサイズを確認
ls -lh apps/server/dist/index.js

# クライアントアセットサイズを確認
du -sh apps/server/public/assets/
ls -lh apps/server/public/assets/
```

**期待される出力例:**
```
apps/server/dist/index.js   約 200〜500KB
apps/server/public/assets/
  index-[hash].js   約 50〜200KB
  vendor-[hash].js  約 100〜300KB（React コア）
```

### 確認 2: Chrome DevTools Lighthouse によるパフォーマンス計測

1. 開発サーバーを起動: `pnpm dev`
2. Chrome で `http://localhost:5173` にアクセス
3. DevTools (`F12`) → **Lighthouse** タブ → 「Analyze page load」を実行
4. **確認事項**:
   - Performance スコア: 80 以上を目標
   - Largest Contentful Paint (LCP): < 2.5秒
   - Total Blocking Time (TBT): < 200ms
   - Cumulative Layout Shift (CLS): < 0.1

### 確認 3: Network タブでの SPA ナビゲーション計測

1. DevTools → **Network** タブを開く
2. キャッシュを無効化（「Disable cache」にチェック）
3. 記事一覧から記事詳細へ Inertia.js ナビゲーションで遷移
4. **確認事項**:
   - Inertia XHR リクエストのレスポンス時間: < 300ms（ローカル）
   - レスポンスサイズ: フルページ HTML より大幅に小さいこと（JSON のみ）
   - `X-Inertia: true` ヘッダーがリクエストに含まれること

### 確認 4: PBKDF2 処理時間の確認

ブラウザの DevTools コンソールで以下を実行して、
PBKDF2 の処理時間が 200ms 以内であることを確認します:

```javascript
// ブラウザコンソールで実行（Cloudflare Workers と同じ Web Crypto API）
const encoder = new TextEncoder()
const start = performance.now()

const keyMaterial = await crypto.subtle.importKey(
  'raw',
  encoder.encode('test-password-12345'),
  { name: 'PBKDF2' },
  false,
  ['deriveBits']
)

await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt: crypto.getRandomValues(new Uint8Array(16)), iterations: 10000, hash: 'SHA-256' },
  keyMaterial,
  256
)

const elapsed = performance.now() - start
console.log(`PBKDF2 処理時間: ${elapsed.toFixed(2)}ms`)
// 期待値: 200ms 以内
```

---

## 将来的な自動パフォーマンステスト導入（参考）

本プロジェクトをプロダクション向けに発展させる場合は以下を検討してください。

### k6 によるロードテスト

```bash
# k6 のインストール（macOS）
brew install k6

# ロードテストスクリプトの作成
cat > load-test.js << 'EOF'
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 10,          // 仮想ユーザー数
  duration: '30s',  // テスト時間
}

export default function() {
  // 記事一覧エンドポイント
  const res = http.get('https://your-workers-domain.workers.dev/', {
    headers: { 'X-Inertia': 'true' }
  })
  check(res, {
    'status 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })
  sleep(1)
}
EOF

# ロードテスト実行（開発サーバーに対して）
k6 run load-test.js
```

### Cloudflare Workers Analytics

Cloudflare ダッシュボードの **Workers** メトリクスで以下を確認:
- P99 レスポンスタイム
- CPU 使用時間
- リクエスト数・エラー率

アクセス方法: `https://dash.cloudflare.com` → Workers & Pages → [your-worker] → Analytics

---

## パフォーマンス最適化のヒント

| 問題 | 対策 |
|------|------|
| バンドルサイズが大きい | Vite の `rollupOptions.output.manualChunks` でコード分割を調整 |
| PBKDF2 が遅い | イテレーション数を環境変数で調整（最低 10,000 以上を維持） |
| SPA 遷移が遅い | Inertia の SSR（Server-Side Rendering）を検討 |
| 初回ロードが遅い | Cloudflare Assets のキャッシュヘッダーを確認 |
