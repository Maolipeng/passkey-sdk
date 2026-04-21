/**
 * Passkey SDK 核心类型定义
 */

/** Authenticator 传输方式 */
export type AuthenticatorTransport =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb'

/** 设备类型 */
export type DeviceType = 'single_device' | 'multi_device'

/** 用户验证偏好 */
export type UserVerificationPreference = 'required' | 'preferred' | 'discouraged'

/** Attestation 类型 */
export type AttestationType = 'none' | 'direct' | 'indirect' | 'enterprise'

// ============================================================================
// 用户和凭证数据结构
// ============================================================================

/** 存储的凭证信息 */
export interface StoredCredential {
  /** 凭证 ID（base64url 编码） */
  id: string
  /** 公钥（COSE 格式，Uint8Array） */
  publicKey: Uint8Array
  /** 签名计数器 */
  counter: number
  /** 支持的传输方式 */
  transports?: AuthenticatorTransport[]
  /** 设备类型 */
  deviceType: DeviceType
  /** 是否已备份 */
  backedUp: boolean
  /** 创建时间 */
  createdAt?: Date
  /** 最后使用时间 */
  lastUsedAt?: Date
}

/** 用户数据 */
export interface User {
  /** 用户名 */
  username: string
  /** 用户 ID（Uint8Array） */
  userID: Uint8Array
  /** 用户显示名 */
  displayName?: string
  /** 已注册的凭证列表 */
  credentials: StoredCredential[]
  /** 创建时间 */
  createdAt?: Date
}

// ============================================================================
// 存储接口
// ============================================================================

/** 用户数据存储接口 */
export interface UserStorageAdapter {
  /** 查找用户 */
  findUser(username: string): Promise<User | null>
  /** 创建用户 */
  createUser(username: string, displayName?: string): Promise<User>
  /** 更新用户 */
  updateUser?(username: string, updates: Partial<User>): Promise<void>
  /** 删除用户 */
  deleteUser?(username: string): Promise<void>
  /** 添加凭证 */
  addCredential(username: string, credential: StoredCredential): Promise<void>
  /** 查找凭证 */
  findCredential(
    credentialId: string
  ): Promise<{ user: User; credential: StoredCredential } | null>
  /** 更新凭证计数器 */
  updateCounter(credentialId: string, counter: number): Promise<void>
  /** 删除凭证 */
  deleteCredential?(credentialId: string): Promise<void>
  /** 获取用户所有凭证 */
  getCredentials?(username: string): Promise<StoredCredential[]>
}

/** Challenge 存储接口 */
export interface ChallengeStorageAdapter {
  /** 设置 challenge（可选 TTL） */
  set(key: string, challenge: string, ttlMs?: number): Promise<void>
  /** 获取 challenge */
  get(key: string): Promise<string | null>
  /** 删除 challenge */
  delete(key: string): Promise<void>
}

// ============================================================================
// 服务端配置
// ============================================================================

/** 服务端配置 */
export interface PasskeyServerConfig {
  /** RP 名称（显示给用户） */
  rpName: string
  /** RP ID（通常是域名） */
  rpID: string
  /** 允许的 origins */
  expectedOrigins: string[]
  /** 用户数据存储 */
  userStorage: UserStorageAdapter
  /** Challenge 存储 */
  challengeStorage: ChallengeStorageAdapter
  /** 用户验证偏好 */
  userVerification?: UserVerificationPreference
  /** Attestation 类型 */
  attestationType?: AttestationType
  /** authenticator 选择偏好 */
  authenticatorSelection?: AuthenticatorSelectionConfig
  /** Challenge 过期时间（毫秒） */
  challengeTimeout?: number
}

/** Authenticator 选择配置 */
export interface AuthenticatorSelectionConfig {
  /** 认证器类型 */
  authenticatorAttachment?: 'platform' | 'cross-platform'
  /** resident key 偏好 */
  residentKey?: 'discouraged' | 'preferred' | 'required'
  /** 用户验证偏好 */
  userVerification?: UserVerificationPreference
}

// ============================================================================
// 前端 SDK 配置
// ============================================================================

/** 前端 SDK 配置 */
export interface PasskeyClientConfig {
  /** API 基础 URL */
  baseURL: string
  /** 请求超时时间（毫秒） */
  timeout?: number
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 调试模式 */
  debug?: boolean
}

/** 浏览器环境检测结果 */
export interface PasskeyEnvironment {
  /** 是否支持 WebAuthn */
  supported: boolean
  /** 平台认证器是否可用（如 Touch ID、Face ID） */
  platformAvailable: boolean
  /** 是否支持条件式 UI（自动填充） */
  conditionalUIAvailable?: boolean
}

// ============================================================================
// API 结果类型
// ============================================================================

/** 注册结果 */
export interface RegisterResult {
  /** 是否成功 */
  verified: boolean
  /** 凭证数量 */
  credentialCount?: number
  /** 错误信息 */
  error?: string
}

/** 登录结果 */
export interface LoginResult {
  /** 是否成功 */
  verified: boolean
  /** 用户名 */
  username?: string
  /** 错误信息 */
  error?: string
}

/** API 响应通用格式 */
export interface ApiResponse<T> {
  /** 是否成功 */
  success: boolean
  /** 数据 */
  data?: T
  /** 错误信息 */
  error?: string
  /** 元数据 */
  meta?: Record<string, unknown>
}

// ============================================================================
// 事件钩子
// ============================================================================

/** 注册事件 */
export interface RegisterEvents {
  /** 注册开始 */
  onStart?: (username: string) => void
  /** 注册成功 */
  onSuccess?: (username: string, credentialCount: number) => void
  /** 注册失败 */
  onError?: (username: string, error: Error) => void
}

/** 登录事件 */
export interface LoginEvents {
  /** 登录开始 */
  onStart?: (username: string) => void
  /** 登录成功 */
  onSuccess?: (username: string) => void
  /** 登录失败 */
  onError?: (username: string, error: Error) => void
}

/** PasskeyClient 事件钩子 */
export interface PasskeyClientEvents {
  register?: RegisterEvents
  login?: LoginEvents
}