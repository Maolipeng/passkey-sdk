# Passkey SDK

[English](./README.md) | [简体中文](./README.zh-CN.md)

TypeScript Passkey/WebAuthn SDK monorepo，提供浏览器客户端、兼容 Express 的服务端 Router、共享类型/错误类、开发用内存存储，以及生产存储集成的基础类。

## 包说明

| 包 | 作用 |
| --- | --- |
| `@maolipeng/passkey-sdk-core` | 共享 TypeScript 类型和 SDK 错误类 |
| `@maolipeng/passkey-browser-sdk` | 基于 `@simplewebauthn/browser` 的浏览器端 `PasskeyClient` |
| `@maolipeng/passkey-server-sdk` | 基于 `@simplewebauthn/server` 的服务端 `PasskeyServer` |
| `@maolipeng/passkey-server-sdk/storages` | 内存存储，以及 SQLite/Redis 存储基础类 |

所有 SDK 包都会构建为 ESM 和 CommonJS，并生成 `.d.ts` 类型声明文件。

## 已实现功能

- 浏览器 WebAuthn 环境检测：`getEnvironment()`。
- Passkey 注册：`PasskeyClient.register(username)`。
- Passkey 登录：`PasskeyClient.login(username)`。
- Discoverable credential 自动发现登录：`PasskeyClient.login()`。
- 注册/登录生命周期事件钩子：开始、成功、失败。
- 调试日志，以及可配置的请求超时和请求头。
- Express Router，包含健康检查、注册 options/verify、登录 options/verify 端点。
- 共享的 `UserStorageAdapter` 和 `ChallengeStorageAdapter` 接口。
- 内置开发/演示用内存用户存储和 challenge 存储。
- SQLite 用户存储基础类，以及 Redis challenge 存储基础类。
- 最小 demo 和完整 example。
- 仓库级 `build` 和 `typecheck` 命令。

## 快速开始

安装依赖：

```bash
pnpm install
```

运行完整示例：

```bash
pnpm dev:example
```

打开：

```text
http://localhost:3001/
```

完整示例使用：

| 服务 | URL |
| --- | --- |
| Web UI | `http://localhost:3001/` |
| API | `http://localhost:3002/api/passkey` |

这里拆分端口是有意设计：Vite 在 `3001` 提供 Web UI，Express API 在 `3002` 运行。

## 最小 Demo

运行最小 demo：

```bash
pnpm dev:demo
```

它会启动：

| 服务 | URL |
| --- | --- |
| Demo API | `http://localhost:3000/api` |
| Demo Web | `http://localhost:5173/` |

也可以单独运行：

```bash
pnpm dev:server
pnpm dev:web
```

## 浏览器端用法

```typescript
import { PasskeyClient } from '@maolipeng/passkey-browser-sdk'

const client = new PasskeyClient(
  {
    baseURL: 'https://your-domain.com/api/passkey',
    timeout: 30000,
    debug: true,
  },
  {
    register: {
      onStart: (username) => console.log('register start', username),
      onSuccess: (username, credentialCount) => {
        console.log('register success', username, credentialCount)
      },
      onError: (username, error) => {
        console.error('register failed', username, error)
      },
    },
    login: {
      onStart: (username) => console.log('login start', username),
      onSuccess: (username) => console.log('login success', username),
      onError: (username, error) => {
        console.error('login failed', username, error)
      },
    },
  }
)

const env = await client.getEnvironment()
console.log(env.supported, env.platformAvailable)

const registration = await client.register('alice')
const login = await client.login('alice')
const discoverableLogin = await client.login()
```

`baseURL` 必须指向由 `PasskeyServer.createRouter()` 创建并挂载的 Router。

## 服务端用法

```typescript
import express from 'express'
import { PasskeyServer } from '@maolipeng/passkey-server-sdk'
import {
  MemoryChallengeStorage,
  MemoryUserStorage,
} from '@maolipeng/passkey-server-sdk/storages'

const app = express()

app.use(express.json())

const passkeyServer = new PasskeyServer({
  rpName: 'My App',
  rpID: 'localhost',
  expectedOrigins: ['http://localhost:3001'],
  userStorage: new MemoryUserStorage(),
  challengeStorage: new MemoryChallengeStorage(),
})

app.use('/api/passkey', passkeyServer.createRouter(express.Router()))

app.listen(3002)
```

生产环境中，`rpID` 应配置为真实域名，`expectedOrigins` 应配置为完整 HTTPS origin。

## HTTP 端点

`PasskeyServer.createRouter()` 会在你的挂载路径下注册这些端点：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `POST` | `/register/options` | 生成注册 options |
| `POST` | `/register/verify` | 验证注册响应 |
| `POST` | `/login/options` | 生成登录 options |
| `POST` | `/login/verify` | 验证登录响应 |

Options 和错误响应使用简单 envelope：

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

验证端点返回 `RegisterResult` 或 `LoginResult`。

## 存储

服务端 SDK 基于 storage adapter。

### UserStorageAdapter

```typescript
interface UserStorageAdapter {
  findUser(username: string): Promise<User | null>
  createUser(username: string, displayName?: string): Promise<User>
  updateUser?(username: string, updates: Partial<User>): Promise<void>
  deleteUser?(username: string): Promise<void>
  addCredential(username: string, credential: StoredCredential): Promise<void>
  findCredential(
    credentialId: string
  ): Promise<{ user: User; credential: StoredCredential } | null>
  updateCounter(credentialId: string, counter: number): Promise<void>
  deleteCredential?(credentialId: string): Promise<void>
  getCredentials?(username: string): Promise<StoredCredential[]>
}
```

### ChallengeStorageAdapter

```typescript
interface ChallengeStorageAdapter {
  set(key: string, challenge: string, ttlMs?: number): Promise<void>
  get(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}
```

### 内置存储辅助类

从 `storages` 子路径导入存储辅助类：

```typescript
import {
  MemoryChallengeStorage,
  MemoryUserStorage,
  RedisChallengeStorageBase,
  SQLiteUserStorageBase,
} from '@maolipeng/passkey-server-sdk/storages'
```

已实现的辅助类：

| 导出 | 状态 | 说明 |
| --- | --- | --- |
| `MemoryUserStorage` | 已实现 | 仅用于开发/测试，进程内存 |
| `MemoryChallengeStorage` | 已实现 | 仅用于开发/测试，进程内存，支持 TTL |
| `SQLiteUserStorageBase` | 已实现基础类 | 需要应用侧安装并传入 `better-sqlite3` |
| `RedisChallengeStorageBase` | 已实现基础类 | 需要应用侧安装并传入 `ioredis` 或兼容 client |
| `uint8ArrayToBase64url` | 已实现 | 存储序列化工具 |
| `base64urlToUint8Array` | 已实现 | 存储序列化工具 |

SQLite 示例：

```typescript
import Database from 'better-sqlite3'
import { SQLiteUserStorageBase } from '@maolipeng/passkey-server-sdk/storages'

const db = new Database('./passkeys.db')
const userStorage = new SQLiteUserStorageBase(db)
```

Redis 示例：

```typescript
import Redis from 'ioredis'
import { RedisChallengeStorageBase } from '@maolipeng/passkey-server-sdk/storages'

const redis = new Redis('redis://localhost:6379')
const challengeStorage = new RedisChallengeStorageBase(redis, 60000)
```

`better-sqlite3` 和 `ioredis` 不是 SDK 包的依赖。使用这些辅助类时，需要在你的应用中自行安装。

## API 参考

### PasskeyClient

| 方法 | 说明 |
| --- | --- |
| `getEnvironment()` | 检测浏览器 WebAuthn 支持和平台认证器可用性 |
| `register(username)` | 为非空用户名注册新的 passkey |
| `login(username?)` | 使用用户名登录，或走 discoverable credential 自动发现流程 |

### PasskeyClientConfig

| 属性 | 类型 | 必填 | 默认值 |
| --- | --- | --- | --- |
| `baseURL` | `string` | 是 | 无 |
| `timeout` | `number` | 否 | `30000` |
| `headers` | `Record<string, string>` | 否 | `{ "Content-Type": "application/json" }` |
| `debug` | `boolean` | 否 | `false` |

### PasskeyServer

| 方法 | 说明 |
| --- | --- |
| `createRouter(router)` | 在传入的 Express router 上注册路由 |
| `generateRegistrationOptions(username)` | 创建 WebAuthn 注册 options |
| `verifyRegistration(username, response)` | 验证注册响应并存储 credential |
| `generateAuthenticationOptions(username?)` | 创建 WebAuthn 登录 options |
| `verifyAuthentication(username, response)` | 验证登录响应并更新 credential counter |

### PasskeyServerConfig

| 属性 | 类型 | 必填 | 默认值 |
| --- | --- | --- | --- |
| `rpName` | `string` | 是 | 无 |
| `rpID` | `string` | 是 | 无 |
| `expectedOrigins` | `string[]` | 是 | 无 |
| `userStorage` | `UserStorageAdapter` | 是 | 无 |
| `challengeStorage` | `ChallengeStorageAdapter` | 是 | 无 |
| `userVerification` | `'required' | 'preferred' | 'discouraged'` | 否 | `'preferred'` |
| `attestationType` | `'none' | 'direct' | 'indirect' | 'enterprise'` | 否 | `'none'` |
| `authenticatorSelection` | `AuthenticatorSelectionConfig` | 否 | 当前尚未接入 options 生成逻辑 |
| `challengeTimeout` | `number` | 否 | `60000` |

说明：`authenticatorSelection` 当前存在于共享类型中，但服务端生成 options 时仍固定使用平台认证器、`residentKey: 'preferred'`，并使用 config 中的 `userVerification`。

## 错误类型

共享错误从 `@maolipeng/passkey-sdk-core` 导出，并由 browser/server 包重新导出：

```typescript
import {
  PasskeyApiError,
  PasskeyAuthenticationError,
  PasskeyCredentialNotFoundError,
  PasskeyError,
  PasskeyInvalidChallengeError,
  PasskeyInvalidUsernameError,
  PasskeyNotSupportedError,
  PasskeyPlatformUnavailableError,
  PasskeyRegistrationError,
  PasskeyStorageError,
  PasskeyUserCancelledError,
  PasskeyUserNotFoundError,
} from '@maolipeng/passkey-sdk-core'
```

## 仓库结构

```text
packages/
  passkey-sdk-core/
    src/index.ts
    src/types.ts
    src/errors.ts
  passkey-browser-sdk/
    src/index.ts
  passkey-server-sdk/
    src/index.ts
    src/storages/index.ts

apps/
  demo-server/       # API on 3000
  demo-web/          # Web UI on 5173
  example-full/      # Web UI on 3001, API on 3002
```

## 开发命令

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev:demo
pnpm dev:example
```

当前还没有配置测试套件。仓库级验证命令是 `pnpm typecheck` 和 `pnpm build`。

## 发布

```bash
pnpm release
pnpm release:minor
pnpm release:major
```

发布脚本会检查 npm 登录状态、检查 git 工作区是否干净、构建 packages、更新 package 版本、发布 public npm packages，并创建 commit/tag。

## 生产注意事项

- 生产环境必须使用 HTTPS。WebAuthn 允许 `localhost` 用于本地开发，但生产 origin 必须是安全上下文。
- `rpID` 应设置为有效域名，不是 URL。
- `expectedOrigins` 应包含完整 origin，包含 scheme，必要时包含端口。
- 将内存存储替换为持久化用户存储。
- 将 challenge 存储到短生命周期存储中，例如 Redis。
- 在 passkey 注册周围增加限流和你自己的应用级授权逻辑。

## License

MIT
