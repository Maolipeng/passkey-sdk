import express from 'express'
import cors from 'cors'
import { PasskeyServer } from '@passkey/server-sdk'
import { MemoryUserStorage, MemoryChallengeStorage } from '@passkey/server-sdk/storages'

const app = express()
const PORT = Number(process.env.PORT ?? 3000)

// 配置
const config = {
  rpName: 'Passkey Demo',
  rpID: 'localhost',
  expectedOrigins: ['http://localhost:5173'],
  userStorage: new MemoryUserStorage(),
  challengeStorage: new MemoryChallengeStorage(),
}

// 创建 PasskeyServer
const passkeyServer = new PasskeyServer(config)

// CORS
app.use(cors({ origin: config.expectedOrigins, credentials: true }))
app.use(express.json())

// 挂载 Passkey API 路由
app.use('/api', passkeyServer.createRouter(express.Router()))

// 启动服务
app.listen(PORT, () => {
  console.log(`Passkey API running at http://localhost:${PORT}`)
})
