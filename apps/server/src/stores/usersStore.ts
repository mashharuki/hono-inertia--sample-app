/**
 * ユーザーデータストア（メモリモック）
 * Unit-02 では DB を使用せずメモリ上のモックデータを使用する
 * Unit-04 以降で Cloudflare D1 等への移行を想定
 */

import type { PublicUser, User } from '@repo/shared'
import { hashPassword } from '../lib/crypto.js'

/** 内部ユーザーストレージ（パスワードハッシュを含む） */
const users: User[] = []

/** ストア初期化フラグ */
let initialized = false

/**
 * モックユーザーを初期化する
 * Cloudflare Workers ではトップレベル await を使用できないため、
 * 初回アクセス時に遅延初期化する
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return
  initialized = true

  const now = new Date().toISOString()

  const [adminHash, writerHash] = await Promise.all([
    hashPassword('password123'),
    hashPassword('password123'),
  ])

  users.push(
    {
      id: 'user-admin-001',
      email: 'admin@example.com',
      displayName: '管理者',
      passwordHash: adminHash,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-writer-001',
      email: 'writer@example.com',
      displayName: 'ライター',
      passwordHash: writerHash,
      createdAt: now,
      updatedAt: now,
    }
  )
}

/** User から PublicUser へ変換する（passwordHash を除外） */
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  }
}

export const usersStore = {
  /**
   * メールアドレスでユーザーを検索する（大文字小文字を無視）
   * @param email 検索するメールアドレス
   * @returns 見つかった User（内部表現）または undefined
   */
  async findByEmail(email: string): Promise<User | undefined> {
    await ensureInitialized()
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase())
  },

  /**
   * ID でユーザーを検索する（PublicUser を返す）
   * @param id 検索するユーザー ID
   * @returns 見つかった PublicUser または undefined
   */
  findById(id: string): PublicUser | undefined {
    const user = users.find((u) => u.id === id)
    return user ? toPublicUser(user) : undefined
  },

  /**
   * 新しいユーザーを作成する
   * @param input ユーザー作成入力
   * @returns 作成された PublicUser
   */
  create(input: { email: string; displayName: string; hashedPassword: string }): PublicUser {
    const now = new Date().toISOString()
    const newUser: User = {
      id: `user-${Date.now()}`,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      passwordHash: input.hashedPassword,
      createdAt: now,
      updatedAt: now,
    }
    users.push(newUser)
    return toPublicUser(newUser)
  },
}
