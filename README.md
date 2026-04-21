# Passkey SDK

[English](./README.md) | [简体中文](./README.zh-CN.md)

TypeScript Passkey/WebAuthn SDK monorepo. It provides a browser client, an Express-compatible server router, shared types/errors, built-in development storage, and base classes for production storage integrations.

## Packages

| Package | Purpose |
| --- | --- |
| `@passkey/sdk-core` | Shared TypeScript types and SDK error classes |
| `@passkey/browser-sdk` | Browser `PasskeyClient` built on `@simplewebauthn/browser` |
| `@passkey/server-sdk` | Server `PasskeyServer` built on `@simplewebauthn/server` |
| `@passkey/server-sdk/storages` | Memory storage plus SQLite/Redis base storage helpers |

All SDK packages build to ESM and CommonJS with generated `.d.ts` files.

## Implemented Features

- Browser WebAuthn environment detection with `getEnvironment()`.
- Passkey registration with `PasskeyClient.register(username)`.
- Passkey login with `PasskeyClient.login(username)`.
- Discoverable credential login with `PasskeyClient.login()`.
- Client lifecycle hooks for register/login start, success, and error.
- Debug logging and configurable request timeout/headers.
- Express router with health, registration options/verify, and login options/verify endpoints.
- Shared `UserStorageAdapter` and `ChallengeStorageAdapter` interfaces.
- Built-in in-memory user/challenge storage for development and demos.
- SQLite user storage base class and Redis challenge storage base class.
- Demo apps for minimal and full browser/server flows.
- Repository-level build and typecheck commands.

## Quick Start

Install dependencies in this repo:

```bash
pnpm install
```

Run the full example:

```bash
pnpm dev:example
```

Open:

```text
http://localhost:3001/
```

The full example uses:

| Service | URL |
| --- | --- |
| Web UI | `http://localhost:3001/` |
| API | `http://localhost:3002/api/passkey` |

The split ports are intentional: Vite serves the web UI on `3001`, and the Express API runs on `3002`.

## Minimal Demo

Run the minimal demo:

```bash
pnpm dev:demo
```

It starts:

| Service | URL |
| --- | --- |
| Demo API | `http://localhost:3000/api` |
| Demo Web | `http://localhost:5173/` |

You can also run each side separately:

```bash
pnpm dev:server
pnpm dev:web
```

## Browser Usage

```typescript
import { PasskeyClient } from '@passkey/browser-sdk'

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

`baseURL` must point to a router created by `PasskeyServer.createRouter()`.

## Server Usage

```typescript
import express from 'express'
import { PasskeyServer } from '@passkey/server-sdk'
import {
  MemoryChallengeStorage,
  MemoryUserStorage,
} from '@passkey/server-sdk/storages'

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

For production, configure `rpID` as your real domain and `expectedOrigins` as full HTTPS origins.

## HTTP Endpoints

`PasskeyServer.createRouter()` registers these endpoints relative to your mount path:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/register/options` | Generate registration options |
| `POST` | `/register/verify` | Verify registration response |
| `POST` | `/login/options` | Generate authentication options |
| `POST` | `/login/verify` | Verify authentication response |

Responses use a simple envelope for options and errors:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

Verification endpoints return `RegisterResult` or `LoginResult`.

## Storage

The server SDK is storage-adapter based.

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

### Built-In Storage Helpers

Import storage helpers from the `storages` subpath:

```typescript
import {
  MemoryChallengeStorage,
  MemoryUserStorage,
  RedisChallengeStorageBase,
  SQLiteUserStorageBase,
} from '@passkey/server-sdk/storages'
```

Implemented helpers:

| Export | Status | Notes |
| --- | --- | --- |
| `MemoryUserStorage` | Implemented | Development/test only, process memory |
| `MemoryChallengeStorage` | Implemented | Development/test only, process memory with TTL |
| `SQLiteUserStorageBase` | Implemented base helper | Requires your app to install and provide `better-sqlite3` |
| `RedisChallengeStorageBase` | Implemented base helper | Requires your app to install and provide `ioredis` or compatible client |
| `uint8ArrayToBase64url` | Implemented | Utility for storage serialization |
| `base64urlToUint8Array` | Implemented | Utility for storage serialization |

SQLite example:

```typescript
import Database from 'better-sqlite3'
import { SQLiteUserStorageBase } from '@passkey/server-sdk/storages'

const db = new Database('./passkeys.db')
const userStorage = new SQLiteUserStorageBase(db)
```

Redis example:

```typescript
import Redis from 'ioredis'
import { RedisChallengeStorageBase } from '@passkey/server-sdk/storages'

const redis = new Redis('redis://localhost:6379')
const challengeStorage = new RedisChallengeStorageBase(redis, 60000)
```

`better-sqlite3` and `ioredis` are not dependencies of this SDK package. Install them in your application when you use these helpers.

## API Reference

### PasskeyClient

| Method | Description |
| --- | --- |
| `getEnvironment()` | Detect browser WebAuthn support and platform authenticator availability |
| `register(username)` | Register a new passkey for a non-empty username |
| `login(username?)` | Authenticate with a username or discoverable credential flow |

### PasskeyClientConfig

| Property | Type | Required | Default |
| --- | --- | --- | --- |
| `baseURL` | `string` | Yes | none |
| `timeout` | `number` | No | `30000` |
| `headers` | `Record<string, string>` | No | `{ "Content-Type": "application/json" }` |
| `debug` | `boolean` | No | `false` |

### PasskeyServer

| Method | Description |
| --- | --- |
| `createRouter(router)` | Register Express routes on the provided router |
| `generateRegistrationOptions(username)` | Create WebAuthn registration options |
| `verifyRegistration(username, response)` | Verify registration response and store credential |
| `generateAuthenticationOptions(username?)` | Create WebAuthn login options |
| `verifyAuthentication(username, response)` | Verify login response and update credential counter |

### PasskeyServerConfig

| Property | Type | Required | Default |
| --- | --- | --- | --- |
| `rpName` | `string` | Yes | none |
| `rpID` | `string` | Yes | none |
| `expectedOrigins` | `string[]` | Yes | none |
| `userStorage` | `UserStorageAdapter` | Yes | none |
| `challengeStorage` | `ChallengeStorageAdapter` | Yes | none |
| `userVerification` | `'required' | 'preferred' | 'discouraged'` | No | `'preferred'` |
| `attestationType` | `'none' | 'direct' | 'indirect' | 'enterprise'` | No | `'none'` |
| `authenticatorSelection` | `AuthenticatorSelectionConfig` | No | currently not wired into option generation |
| `challengeTimeout` | `number` | No | `60000` |

Note: `authenticatorSelection` exists in the shared type today, but current server option generation uses platform authenticators with `residentKey: 'preferred'` and `userVerification` from config.

## Error Types

Shared errors are exported from `@passkey/sdk-core` and re-exported by the browser/server packages:

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
} from '@passkey/sdk-core'
```

## Repository Layout

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

## Development Commands

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev:demo
pnpm dev:example
```

There is currently no test suite configured. Use `pnpm typecheck` and `pnpm build` as the repository-level verification commands.

## Release

```bash
pnpm release
pnpm release:minor
pnpm release:major
```

The release script checks npm login, checks for a clean git state, builds packages, bumps package versions, publishes public npm packages, and creates a commit/tag.

## Production Notes

- Use HTTPS in production. WebAuthn allows `localhost` for local development, but production origins must be secure.
- Set `rpID` to your effective domain, not a URL.
- Include full origins in `expectedOrigins`, including scheme and port when applicable.
- Replace memory storage with persistent user storage.
- Store challenges in a short-lived store such as Redis.
- Add rate limiting and your own application-level authorization around passkey registration.

## License

MIT
