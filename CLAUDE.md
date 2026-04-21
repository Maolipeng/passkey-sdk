# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Passkey (WebAuthn/FIDO2) SDK monorepo built with TypeScript. It provides production-ready packages for implementing passkey authentication in web applications.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages (SDK packages only)
pnpm build

# Development mode (watch all packages)
pnpm dev

# Run demo apps
pnpm dev:demo       # demo-server (port 3000) + demo-web (port 5173)
pnpm dev:example    # example-full (port 3001, combined server + web)

# Run individual apps
pnpm dev:server     # demo-server only
pnpm dev:web        # demo-web only

# Release to npm
pnpm release           # patch version
pnpm release:minor     # minor version
pnpm release:major     # major version
```

## Architecture

### Monorepo Structure (pnpm + turborepo)

```
packages/
├── passkey-sdk-core/      # Core types and error classes (@maolipeng/passkey-sdk-core)
├── passkey-browser-sdk/  # Browser SDK (@maolipeng/passkey-browser-sdk)
└── passkey-server-sdk/   # Server SDK (@maolipeng/passkey-server-sdk)

apps/
├── demo-server/          # Minimal server demo
├── demo-web/             # Minimal browser demo
└── example-full/         # Full-featured example with event hooks
```

### Package Dependencies

```
@maolipeng/passkey-browser-sdk → @maolipeng/passkey-sdk-core → @simplewebauthn/browser
@maolipeng/passkey-server-sdk  → @maolipeng/passkey-sdk-core → @simplewebauthn/server
```

### Core SDK Architecture

**@maolipeng/passkey-sdk-core**: Type definitions and error classes
- `types.ts`: UserStorageAdapter, ChallengeStorageAdapter, User, StoredCredential, PasskeyServerConfig, PasskeyClientConfig, PasskeyClientEvents
- `errors.ts`: PasskeyError hierarchy (NotSupported, UserCancelled, InvalidUsername, CredentialNotFound, ApiError, etc.)

**@maolipeng/passkey-browser-sdk**: PasskeyClient class
- Methods: `getEnvironment()`, `register(username)`, `login(username?)`
- Event hooks for register/login lifecycle (onStart, onSuccess, onError)
- Auto-discovery support (login without username)

**@maolipeng/passkey-server-sdk**: PasskeyServer class + storage adapters
- Methods: `createRouter(router)`, `generateRegistrationOptions()`, `verifyRegistration()`, `generateAuthenticationOptions()`, `verifyAuthentication()`
- Storage exports via sub-path: `@maolipeng/passkey-server-sdk/storages`

### Storage Adapter Pattern

Both UserStorageAdapter and ChallengeStorageAdapter are interface-based for extensibility:

```typescript
// Built-in (dev only)
MemoryUserStorage, MemoryChallengeStorage

// Production patterns (require external deps)
SQLiteUserStorageBase  // extends with better-sqlite3
RedisChallengeStorageBase // extends with ioredis
```

### API Response Format

All endpoints return consistent envelope:
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### WebAuthn Flow

1. **Registration**: POST /register/options → browser startRegistration → POST /register/verify
2. **Login**: POST /login/options → browser startAuthentication → POST /login/verify

## Package Build Configuration

Each SDK package uses `tsup` for dual-format builds (ESM + CJS):
```bash
tsup src/index.ts --format cjs,esm --dts
```

Server SDK has additional entry point:
```bash
tsup src/index.ts src/storages/index.ts --format cjs,esm --dts
```

## TypeScript Configuration

All packages use ES2022 target, bundler moduleResolution, strict mode. No path aliases - dependencies are resolved via workspace protocol (`workspace:*`).

## Release Process

The `scripts/release.mjs` script:
1. Verifies npm login (`npm whoami`)
2. Checks git is clean
3. Builds all packages
4. Bumps version in all 3 package.jsons
5. Publishes to npm with `--access public`
6. Creates git commit + tag

Requires: `npm login` completed, clean git state.

## WebAuthn Domain Notes

- **rpID**: Must match the domain (localhost for dev)
- **expectedOrigins**: Full URLs including port
- **residentKey: 'preferred'**: Enables discoverable credentials (passkey auto-fill)
- **HTTPS required in production** (localhost exempt for dev)

## Running Tests

Currently no test suite configured. When adding tests, place in package-specific `__tests__` directories.