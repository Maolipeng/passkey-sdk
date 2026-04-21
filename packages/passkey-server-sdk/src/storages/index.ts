import {
  type UserStorageAdapter,
  type ChallengeStorageAdapter,
  type User,
  type StoredCredential,
} from '@passkey/sdk-core'

// ============================================================================
// 内存存储（开发用）
// ============================================================================

/**
 * 内存用户存储
 * 仅用于开发和测试
 */
export class MemoryUserStorage implements UserStorageAdapter {
  private users: Map<string, User> = new Map()

  async findUser(username: string): Promise<User | null> {
    return this.users.get(username) ?? null
  }

  async createUser(username: string, displayName?: string): Promise<User> {
    const user: User = {
      username,
      userID: new TextEncoder().encode(username),
      displayName,
      credentials: [],
      createdAt: new Date(),
    }
    this.users.set(username, user)
    return user
  }

  async deleteUser(username: string): Promise<void> {
    this.users.delete(username)
  }

  async addCredential(username: string, credential: StoredCredential): Promise<void> {
    const user = this.users.get(username)
    if (!user) return

    // 防止重复添加
    const exists = user.credentials.some((c) => c.id === credential.id)
    if (!exists) {
      user.credentials.push(credential)
    }
  }

  async findCredential(
    credentialId: string
  ): Promise<{ user: User; credential: StoredCredential } | null> {
    for (const user of this.users.values()) {
      const credential = user.credentials.find((c) => c.id === credentialId)
      if (credential) {
        return { user, credential }
      }
    }
    return null
  }

  async updateCounter(credentialId: string, counter: number): Promise<void> {
    const matched = await this.findCredential(credentialId)
    if (matched) {
      matched.credential.counter = counter
      matched.credential.lastUsedAt = new Date()
    }
  }

  async deleteCredential(credentialId: string): Promise<void> {
    for (const user of this.users.values()) {
      const index = user.credentials.findIndex((c) => c.id === credentialId)
      if (index !== -1) {
        user.credentials.splice(index, 1)
        return
      }
    }
  }

  async getCredentials(username: string): Promise<StoredCredential[]> {
    const user = this.users.get(username)
    return user?.credentials ?? []
  }

  /** 清空所有数据（测试用） */
  clear(): void {
    this.users.clear()
  }
}

/**
 * 内存 Challenge 存储
 * 仅用于开发和测试
 */
export class MemoryChallengeStorage implements ChallengeStorageAdapter {
  private challenges: Map<string, { challenge: string; expiresAt: number }> = new Map()

  async set(key: string, challenge: string, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs ? Date.now() + ttlMs : Date.now() + 60000
    this.challenges.set(key, { challenge, expiresAt })
  }

  async get(key: string): Promise<string | null> {
    const entry = this.challenges.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.challenges.delete(key)
      return null
    }

    return entry.challenge
  }

  async delete(key: string): Promise<void> {
    this.challenges.delete(key)
  }

  /** 清空所有数据（测试用） */
  clear(): void {
    this.challenges.clear()
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将 Uint8Array 转换为 base64url 字符串
 */
export function uint8ArrayToBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * 将 base64url 字符串转换为 Uint8Array
 */
export function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  return Buffer.from(base64 + padding, 'base64')
}

// ============================================================================
// SQLite 存储
// ============================================================================

/**
 * SQLite 用户存储配置
 */
export interface SQLiteUserStorageConfig {
  /** 数据库路径 */
  dbPath: string
  /** 表名前缀 */
  tablePrefix?: string
}

// SQLite 实现需要 better-sqlite3，这里提供接口定义
// 实际使用时需要安装 better-sqlite3
export type SQLiteDatabase = any // 实际类型来自 better-sqlite3

/**
 * SQLite 用户存储基类
 * 需要配合 better-sqlite3 使用
 */
export abstract class SQLiteUserStorageBase implements UserStorageAdapter {
  protected db: SQLiteDatabase
  protected tablePrefix: string

  constructor(db: SQLiteDatabase, tablePrefix = 'passkey_') {
    this.db = db
    this.tablePrefix = tablePrefix
    this.initTables()
  }

  protected initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}users (
        username TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        display_name TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}credentials (
        id TEXT PRIMARY KEY,
        username TEXT REFERENCES ${this.tablePrefix}users(username),
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL,
        transports TEXT,
        device_type TEXT NOT NULL,
        backed_up INTEGER NOT NULL,
        created_at INTEGER,
        last_used_at INTEGER
      );
    `)
  }

  async findUser(username: string): Promise<User | null> {
    const row = this.db.prepare(`
      SELECT username, user_id, display_name, created_at
      FROM ${this.tablePrefix}users
      WHERE username = ?
    `).get(username)

    if (!row) return null

    const credentials = await this.getCredentials(username)
    return {
      username: row.username,
      userID: base64urlToUint8Array(row.user_id),
      displayName: row.display_name,
      credentials,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
    }
  }

  async createUser(username: string, displayName?: string): Promise<User> {
    const userId = uint8ArrayToBase64url(new TextEncoder().encode(username))
    const now = Date.now()

    this.db.prepare(`
      INSERT INTO ${this.tablePrefix}users (username, user_id, display_name, created_at)
      VALUES (?, ?, ?, ?)
    `).run(username, userId, displayName ?? null, now)

    return {
      username,
      userID: new TextEncoder().encode(username),
      displayName,
      credentials: [],
      createdAt: new Date(now),
    }
  }

  async deleteUser(username: string): Promise<void> {
    this.db.prepare(`DELETE FROM ${this.tablePrefix}credentials WHERE username = ?`).run(username)
    this.db.prepare(`DELETE FROM ${this.tablePrefix}users WHERE username = ?`).run(username)
  }

  async addCredential(username: string, credential: StoredCredential): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO ${this.tablePrefix}credentials
      (id, username, public_key, counter, transports, device_type, backed_up, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      credential.id,
      username,
      uint8ArrayToBase64url(credential.publicKey),
      credential.counter,
      credential.transports?.join(',') ?? null,
      credential.deviceType,
      credential.backedUp ? 1 : 0,
      credential.createdAt?.getTime() ?? Date.now()
    )
  }

  async findCredential(
    credentialId: string
  ): Promise<{ user: User; credential: StoredCredential } | null> {
    const row = this.db.prepare(`
      SELECT c.*, u.username as user_username, u.user_id, u.display_name, u.created_at as user_created_at
      FROM ${this.tablePrefix}credentials c
      JOIN ${this.tablePrefix}users u ON c.username = u.username
      WHERE c.id = ?
    `).get(credentialId)

    if (!row) return null

    const user: User = {
      username: row.user_username,
      userID: base64urlToUint8Array(row.user_id),
      displayName: row.display_name,
      credentials: [],
      createdAt: row.user_created_at ? new Date(row.user_created_at) : undefined,
    }

    const credential: StoredCredential = {
      id: row.id,
      publicKey: base64urlToUint8Array(row.public_key),
      counter: row.counter,
      transports: row.transports?.split(',').filter(Boolean) ?? [],
      deviceType: row.device_type,
      backedUp: row.backed_up === 1,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    }

    return { user, credential }
  }

  async updateCounter(credentialId: string, counter: number): Promise<void> {
    this.db.prepare(`
      UPDATE ${this.tablePrefix}credentials
      SET counter = ?, last_used_at = ?
      WHERE id = ?
    `).run(counter, Date.now(), credentialId)
  }

  async deleteCredential(credentialId: string): Promise<void> {
    this.db.prepare(`DELETE FROM ${this.tablePrefix}credentials WHERE id = ?`).run(credentialId)
  }

  async getCredentials(username: string): Promise<StoredCredential[]> {
    const rows = this.db.prepare(`
      SELECT * FROM ${this.tablePrefix}credentials WHERE username = ?
    `).all(username)

    return rows.map((row: any) => ({
      id: row.id,
      publicKey: base64urlToUint8Array(row.public_key),
      counter: row.counter,
      transports: row.transports?.split(',').filter(Boolean) ?? [],
      deviceType: row.device_type,
      backedUp: row.backed_up === 1,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    }))
  }
}

// ============================================================================
// Redis Challenge 存储
// ============================================================================

/**
 * Redis Challenge 存储配置
 */
export interface RedisChallengeStorageConfig {
  /** Redis URL */
  url?: string
  /** 默认 TTL（毫秒） */
  ttlMs?: number
  /** Key 前缀 */
  keyPrefix?: string
}

// Redis 实现需要 ioredis，这里提供接口定义
export type RedisClient = any // 实际类型来自 ioredis

/**
 * Redis Challenge 存储基类
 * 需要配合 ioredis 使用
 */
export abstract class RedisChallengeStorageBase implements ChallengeStorageAdapter {
  protected redis: RedisClient
  protected defaultTtl: number
  protected keyPrefix: string

  constructor(redis: RedisClient, ttlMs = 60000, keyPrefix = 'passkey:challenge:') {
    this.redis = redis
    this.defaultTtl = ttlMs
    this.keyPrefix = keyPrefix
  }

  async set(key: string, challenge: string, ttlMs?: number): Promise<void> {
    const fullKey = this.keyPrefix + key
    const ttl = ttlMs ?? this.defaultTtl
    await this.redis.set(fullKey, challenge, 'PX', ttl)
  }

  async get(key: string): Promise<string | null> {
    const fullKey = this.keyPrefix + key
    return await this.redis.get(fullKey)
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.keyPrefix + key
    await this.redis.del(fullKey)
  }
}

// 导出所有类型
export * from '@passkey/sdk-core'