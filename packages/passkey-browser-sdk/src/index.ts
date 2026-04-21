import {
  type PasskeyClientConfig,
  type PasskeyClientEvents,
  type PasskeyEnvironment,
  type RegisterResult,
  type LoginResult,
  type ApiResponse,
  PasskeyError,
  PasskeyInvalidUsernameError,
  PasskeyApiError,
} from '@passkey/sdk-core'
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from '@simplewebauthn/browser'

/** 默认超时时间 */
const DEFAULT_TIMEOUT = 30000

/** 默认请求头 */
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
}

/**
 * Passkey 前端 SDK 客户端
 */
export class PasskeyClient {
  private baseURL: string
  private timeout: number
  private headers: Record<string, string>
  private events?: PasskeyClientEvents
  private debug: boolean

  constructor(config: PasskeyClientConfig, events?: PasskeyClientEvents) {
    this.baseURL = config.baseURL.replace(/\/$/, '')
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    this.headers = { ...DEFAULT_HEADERS, ...config.headers }
    this.events = events
    this.debug = config.debug ?? false
  }

  /**
   * 检测浏览器 WebAuthn 环境
   */
  async getEnvironment(): Promise<PasskeyEnvironment> {
    const supported = browserSupportsWebAuthn()
    let platformAvailable = false

    if (supported) {
      try {
        platformAvailable = await platformAuthenticatorIsAvailable()
      } catch {
        platformAvailable = false
      }
    }

    return {
      supported,
      platformAvailable,
    }
  }

  /**
   * 注册 Passkey
   */
  async register(username: string): Promise<RegisterResult> {
    if (!username || !username.trim()) {
      throw new PasskeyInvalidUsernameError()
    }

    const trimmedUsername = username.trim()

    this.log('register:start', { username: trimmedUsername })
    this.events?.register?.onStart?.(trimmedUsername)

    try {
      // 1. 获取注册选项
      const optionsResponse = await this.fetchJson<{
        success: boolean
        data?: unknown
        error?: string
      }>(`${this.baseURL}/register/options`, {
        method: 'POST',
        body: JSON.stringify({ username: trimmedUsername }),
      })

      if (!optionsResponse.success || !optionsResponse.data) {
        throw new PasskeyApiError(
          optionsResponse.error ?? 'Failed to get registration options',
          400
        )
      }

      this.log('register:options', { options: optionsResponse.data })

      // 2. 启动浏览器注册流程
      const attestationResponse = await startRegistration({
        optionsJSON: optionsResponse.data as any,
      })

      this.log('register:attestation', { response: attestationResponse })

      // 3. 验证注册结果
      const verifyResponse = await this.fetchJson<RegisterResult>(
        `${this.baseURL}/register/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            username: trimmedUsername,
            response: attestationResponse,
          }),
        }
      )

      if (verifyResponse.verified) {
        this.log('register:success', { credentialCount: verifyResponse.credentialCount })
        this.events?.register?.onSuccess?.(
          trimmedUsername,
          verifyResponse.credentialCount ?? 1
        )
      }

      return verifyResponse
    } catch (error) {
      const err = this.normalizeError(error)
      this.log('register:error', { error: err.message })
      this.events?.register?.onError?.(trimmedUsername, err)
      throw err
    }
  }

  /**
   * 使用 Passkey 登录
   */
  async login(username?: string): Promise<LoginResult> {
    if (username && !username.trim()) {
      throw new PasskeyInvalidUsernameError()
    }

    const trimmedUsername = username?.trim()

    this.log('login:start', { username: trimmedUsername })
    this.events?.login?.onStart?.(trimmedUsername ?? '')

    try {
      // 1. 获取登录选项
      const optionsResponse = await this.fetchJson<{
        success: boolean
        data?: unknown
        error?: string
      }>(`${this.baseURL}/login/options`, {
        method: 'POST',
        body: JSON.stringify({ username: trimmedUsername }),
      })

      if (!optionsResponse.success || !optionsResponse.data) {
        throw new PasskeyApiError(
          optionsResponse.error ?? 'Failed to get authentication options',
          400
        )
      }

      this.log('login:options', { options: optionsResponse.data })

      // 2. 启动浏览器认证流程
      const assertionResponse = await startAuthentication({
        optionsJSON: optionsResponse.data as any,
      })

      this.log('login:assertion', { response: assertionResponse })

      // 3. 验证登录结果
      const verifyResponse = await this.fetchJson<LoginResult>(
        `${this.baseURL}/login/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            username: trimmedUsername,
            response: assertionResponse,
          }),
        }
      )

      if (verifyResponse.verified) {
        this.log('login:success', { username: verifyResponse.username })
        this.events?.login?.onSuccess?.(verifyResponse.username ?? trimmedUsername ?? '')
      }

      return verifyResponse
    } catch (error) {
      const err = this.normalizeError(error)
      this.log('login:error', { error: err.message })
      this.events?.login?.onError?.(trimmedUsername ?? '', err)
      throw err
    }
  }

  /**
   * 发送 JSON 请求
   */
  private async fetchJson<T>(url: string, options: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers: this.headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new PasskeyApiError(
          errorData.error ?? `HTTP ${response.status}`,
          response.status
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new PasskeyApiError('Request timeout', 408)
      }

      throw error
    }
  }

  /**
   * 规范化错误
   */
  private normalizeError(error: unknown): PasskeyError {
    if (error instanceof PasskeyError) {
      return error
    }

    if (error instanceof Error) {
      // 检测用户取消
      if (error.name === 'NotAllowedError') {
        return new PasskeyError('User cancelled the operation or operation timed out')
      }

      return new PasskeyError(error.message)
    }

    return new PasskeyError('Unknown error')
  }

  /**
   * 调试日志
   */
  private log(action: string, data?: Record<string, unknown>): void {
    if (this.debug) {
      console.log(`[PasskeyClient] ${action}`, data ?? '')
    }
  }
}

// 导出所有核心类型
export * from '@passkey/sdk-core'