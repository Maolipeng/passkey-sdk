/**
 * Passkey SDK 完整示例 - 服务端
 *
 * 展示功能：
 * - PasskeyServer 基础使用
 * - 可配置的存储适配器
 * - 自定义路由挂载
 * - 环境检测 API
 */

import express from 'express'
import cors from 'cors'
import { PasskeyServer } from '@maolipeng/passkey-server-sdk'
import { MemoryUserStorage, MemoryChallengeStorage } from '@maolipeng/passkey-server-sdk/storages'
import { type PasskeyServerConfig, type UserStorageAdapter, type ChallengeStorageAdapter } from '@maolipeng/passkey-sdk-core'

const app = express()
const PORT = Number(process.env.PORT ?? 3002)

// ============================================================================
// 存储配置示例
// ============================================================================

/**
 * 存储类型选择
 * 生产环境可切换为 SQLite 或 PostgreSQL + Redis
 */
type StorageType = 'memory' | 'sqlite' | 'postgres'

function createStorages(type: StorageType): {
  userStorage: UserStorageAdapter
  challengeStorage: ChallengeStorageAdapter
} {
  switch (type) {
    case 'memory':
      // 内存存储 - 仅用于开发和测试
      return {
        userStorage: new MemoryUserStorage(),
        challengeStorage: new MemoryChallengeStorage(),
      }

    case 'sqlite':
      // SQLite 存储 - 需要 better-sqlite3
      // 实际使用时需要安装并导入 SQLiteUserStorage
      throw new Error('SQLite storage requires better-sqlite3. See documentation.')

    case 'postgres':
      // PostgreSQL 存储 - 需要数据库连接
      throw new Error('PostgreSQL storage requires database setup. See documentation.')

    default:
      return {
        userStorage: new MemoryUserStorage(),
        challengeStorage: new MemoryChallengeStorage(),
      }
  }
}

// ============================================================================
// PasskeyServer 配置
// ============================================================================

const config: PasskeyServerConfig = {
  // RP (Relaying Party) 配置
  rpName: 'Passkey SDK Example',
  rpID: 'localhost',

  // 允许的 origins（生产环境改为实际域名）
  expectedOrigins: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ],

  // 存储配置
  ...createStorages('memory'),

  // 可选配置
  userVerification: 'preferred',
  attestationType: 'none',
  challengeTimeout: 60000, // 60秒
}

// 创建 PasskeyServer 实例
const passkeyServer = new PasskeyServer(config)

// ============================================================================
// Express 应用配置
// ============================================================================

// CORS
app.use(cors({
  origin: config.expectedOrigins,
  credentials: true,
}))

// JSON 解析
app.use(express.json())

// ============================================================================
// 路由配置
// ============================================================================

// 挂载 Passkey API 到 /api/passkey
// 可以挂载到任意路径，如 /auth/passkey、/webauthn 等
const passkeyRouter = express.Router()
passkeyServer.createRouter(passkeyRouter)
app.use('/api/passkey', passkeyRouter)

// ============================================================================
// 扩展 API
// ============================================================================

// 环境信息 API
app.get('/api/env', (_req, res) => {
  res.json({
    rpName: config.rpName,
    rpID: config.rpID,
    origins: config.expectedOrigins,
    userVerification: config.userVerification,
  })
})

// 用户列表 API（仅用于演示，生产环境不应暴露）
app.get('/api/users', async (_req, res) => {
  // MemoryUserStorage 没有列出所有用户的方法
  // 这里仅作为示例展示存储结构
  res.json({
    message: 'User list not available in demo mode',
    note: 'In production, implement proper user management with authentication',
  })
})

// ============================================================================
// 错误处理
// ============================================================================

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  })
})

// ============================================================================
// 启动服务
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n✅ Passkey SDK Example API running at http://localhost:${PORT}`)
  console.log(`\n📋 Available endpoints:`)
  console.log(`   GET  /api/env           - Environment info`)
  console.log(`   Web UI: http://localhost:3001`)
  console.log(`   GET  /api/passkey/health - Health check`)
  console.log(`   POST /api/passkey/register/options - Get registration options`)
  console.log(`   POST /api/passkey/register/verify  - Verify registration`)
  console.log(`   POST /api/passkey/login/options    - Get login options`)
  console.log(`   POST /api/passkey/login/verify     - Verify login`)
  console.log(`\n⚙️  Configuration:`)
  console.log(`   RP Name: ${config.rpName}`)
  console.log(`   RP ID: ${config.rpID}`)
  console.log(`   Storage: Memory (dev mode)`)
  console.log(``)
})
