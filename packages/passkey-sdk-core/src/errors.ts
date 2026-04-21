/**
 * Passkey SDK 自定义错误类
 */

/** Passkey SDK 基础错误 */
export class PasskeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PasskeyError'
  }
}

/** 浏览器不支持 WebAuthn */
export class PasskeyNotSupportedError extends PasskeyError {
  constructor() {
    super('WebAuthn is not supported in this browser')
    this.name = 'PasskeyNotSupportedError'
  }
}

/** 平台认证器不可用 */
export class PasskeyPlatformUnavailableError extends PasskeyError {
  constructor() {
    super('Platform authenticator is not available')
    this.name = 'PasskeyPlatformUnavailableError'
  }
}

/** 用户取消操作 */
export class PasskeyUserCancelledError extends PasskeyError {
  constructor() {
    super('User cancelled the operation')
    this.name = 'PasskeyUserCancelledError'
  }
}

/** 用户名无效 */
export class PasskeyInvalidUsernameError extends PasskeyError {
  constructor(message: string = 'Invalid username') {
    super(message)
    this.name = 'PasskeyInvalidUsernameError'
  }
}

/** 凭证未找到 */
export class PasskeyCredentialNotFoundError extends PasskeyError {
  constructor(message: string = 'Credential not found') {
    super(message)
    this.name = 'PasskeyCredentialNotFoundError'
  }
}

/** 用户未找到 */
export class PasskeyUserNotFoundError extends PasskeyError {
  constructor(username?: string) {
    super(username ? `User not found: ${username}` : 'User not found')
    this.name = 'PasskeyUserNotFoundError'
  }
}

/** Challenge 无效或过期 */
export class PasskeyInvalidChallengeError extends PasskeyError {
  constructor(message: string = 'Invalid or expired challenge') {
    super(message)
    this.name = 'PasskeyInvalidChallengeError'
  }
}

/** 注册失败 */
export class PasskeyRegistrationError extends PasskeyError {
  constructor(message: string) {
    super(`Registration failed: ${message}`)
    this.name = 'PasskeyRegistrationError'
  }
}

/** 登录失败 */
export class PasskeyAuthenticationError extends PasskeyError {
  constructor(message: string) {
    super(`Authentication failed: ${message}`)
    this.name = 'PasskeyAuthenticationError'
  }
}

/** API 错误 */
export class PasskeyApiError extends PasskeyError {
  /** HTTP 状态码 */
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(`API error: ${message}`)
    this.name = 'PasskeyApiError'
    this.statusCode = statusCode
  }
}

/** 存储错误 */
export class PasskeyStorageError extends PasskeyError {
  constructor(message: string) {
    super(`Storage error: ${message}`)
    this.name = 'PasskeyStorageError'
  }
}