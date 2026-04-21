import {
  type PasskeyServerConfig,
  type User,
  type StoredCredential,
  type RegisterResult,
  type LoginResult,
  PasskeyError,
  PasskeyUserNotFoundError,
  PasskeyCredentialNotFoundError,
  PasskeyInvalidChallengeError,
} from '@passkey/sdk-core'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type { Router, Request, Response } from 'express'

/** 默认 Challenge 过期时间（毫秒） */
const DEFAULT_CHALLENGE_TIMEOUT = 60000

/** 注册选项 API 响应 */
export interface RegistrationOptionsResponse {
  success: boolean
  data?: any
  error?: string
}

/** 登录选项 API 响应 */
export interface AuthenticationOptionsResponse {
  success: boolean
  data?: any
  error?: string
}

/**
 * 转换 deviceType
 * @simplewebauthn/server 使用 'singleDevice' | 'multiDevice'
 * SDK 使用 'single_device' | 'multi_device'
 */
function convertDeviceType(type: 'singleDevice' | 'multiDevice'): 'single_device' | 'multi_device' {
  return type === 'singleDevice' ? 'single_device' : 'multi_device'
}

/**
 * 转换 attestationType
 * @simplewebauthn/server 不支持 'indirect'
 */
function convertAttestationType(type: string): 'none' | 'direct' | 'enterprise' {
  if (type === 'indirect') return 'none'
  return type as 'none' | 'direct' | 'enterprise'
}

/**
 * Passkey 服务端 SDK
 */
export class PasskeyServer {
  private config: PasskeyServerConfig

  constructor(config: PasskeyServerConfig) {
    this.config = {
      challengeTimeout: DEFAULT_CHALLENGE_TIMEOUT,
      userVerification: 'preferred',
      attestationType: 'none',
      ...config,
    }
  }

  /**
   * 创建 Express Router
   * 可以挂载到任意 Express 应用
   */
  createRouter(router: Router): Router {
    // Health check
    router.get('/health', (_req: Request, res: Response) => {
      res.json({ success: true, data: { ok: true } })
    })

    // 注册选项
    router.post('/register/options', async (req: Request, res: Response) => {
      try {
        const username = this.validateUsername(req.body?.username)
        const result = await this.generateRegistrationOptions(username)
        res.json(result)
      } catch (error) {
        this.handleError(res, error)
      }
    })

    // 验证注册
    router.post('/register/verify', async (req: Request, res: Response) => {
      try {
        const username = this.validateUsername(req.body?.username)
        const response = req.body?.response
        if (!response) {
          res.status(400).json({ verified: false, error: 'response is required' })
          return
        }
        const result = await this.verifyRegistration(username, response)
        res.json(result)
      } catch (error) {
        this.handleError(res, error)
      }
    })

    // 登录选项
    router.post('/login/options', async (req: Request, res: Response) => {
      try {
        const username = req.body?.username?.trim()
        const result = await this.generateAuthenticationOptions(username)
        res.json(result)
      } catch (error) {
        this.handleError(res, error)
      }
    })

    // 验证登录
    router.post('/login/verify', async (req: Request, res: Response) => {
      try {
        const username = req.body?.username?.trim()
        const response = req.body?.response
        if (!response) {
          res.status(400).json({ verified: false, error: 'response is required' })
          return
        }
        const result = await this.verifyAuthentication(username, response)
        res.json(result)
      } catch (error) {
        this.handleError(res, error)
      }
    })

    return router
  }

  /**
   * 生成注册选项
   */
  async generateRegistrationOptions(username: string): Promise<RegistrationOptionsResponse> {
    const user = await this.getOrCreateUser(username)

    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userName: user.username,
      userID: Buffer.from(user.userID) as any,
      userDisplayName: user.displayName ?? user.username,
      attestationType: convertAttestationType(this.config.attestationType!),
      excludeCredentials: user.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports as any[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: this.config.userVerification!,
        authenticatorAttachment: 'platform',
      },
    })

    // 存储 challenge
    await this.config.challengeStorage.set(
      `register:${username}`,
      options.challenge,
      this.config.challengeTimeout
    )

    return { success: true, data: options }
  }

  /**
   * 验证注册结果
   */
  async verifyRegistration(
    username: string,
    response: any
  ): Promise<RegisterResult> {
    const user = await this.config.userStorage.findUser(username)
    if (!user) {
      throw new PasskeyUserNotFoundError(username)
    }

    const expectedChallenge = await this.config.challengeStorage.get(`register:${username}`)
    if (!expectedChallenge) {
      throw new PasskeyInvalidChallengeError()
    }

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.expectedOrigins,
        expectedRPID: this.config.rpID,
        requireUserVerification: false,
      })

      const { verified, registrationInfo } = verification

      if (verified && registrationInfo) {
        const credential: StoredCredential = {
          id: registrationInfo.credential.id,
          publicKey: new Uint8Array(registrationInfo.credential.publicKey),
          counter: registrationInfo.credential.counter,
          transports: response.response?.transports ?? [],
          deviceType: convertDeviceType(registrationInfo.credentialDeviceType),
          backedUp: registrationInfo.credentialBackedUp,
          createdAt: new Date(),
        }

        await this.config.userStorage.addCredential(username, credential)
      }

      // 删除 challenge
      await this.config.challengeStorage.delete(`register:${username}`)

      return {
        verified,
        credentialCount: user.credentials.length + (verified ? 1 : 0),
      }
    } catch (error) {
      await this.config.challengeStorage.delete(`register:${username}`)
      throw new PasskeyError(
        error instanceof Error ? error.message : 'Registration verification failed'
      )
    }
  }

  /**
   * 生成登录选项
   */
  async generateAuthenticationOptions(
    username?: string
  ): Promise<AuthenticationOptionsResponse> {
    // 无用户名时，使用 discoverable credentials（passkey 自动发现）
    if (!username) {
      const options = await generateAuthenticationOptions({
        rpID: this.config.rpID,
        userVerification: this.config.userVerification!,
        allowCredentials: [],
      })

      // 存储 challenge（无用户名时使用特殊 key）
      await this.config.challengeStorage.set(
        'login:discoverable',
        options.challenge,
        this.config.challengeTimeout
      )

      return { success: true, data: options }
    }

    const user = await this.config.userStorage.findUser(username)
    if (!user || user.credentials.length === 0) {
      return {
        success: false,
        error: 'No passkey found for this username. Register first.',
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: this.config.rpID,
      allowCredentials: user.credentials.map((cred) => ({
        id: cred.id,
        transports: cred.transports as any[],
      })),
      userVerification: this.config.userVerification!,
    })

    await this.config.challengeStorage.set(
      `login:${username}`,
      options.challenge,
      this.config.challengeTimeout
    )

    return { success: true, data: options }
  }

  /**
   * 验证登录结果
   */
  async verifyAuthentication(
    username: string | undefined,
    response: any
  ): Promise<LoginResult> {
    // 从 credential ID 查找用户
    const matched = await this.config.userStorage.findCredential(response.id)
    if (!matched) {
      throw new PasskeyCredentialNotFoundError()
    }

    // 如果提供了用户名，验证是否匹配
    if (username && matched.user.username !== username) {
      throw new PasskeyCredentialNotFoundError('Credential does not belong to this user')
    }

    const challengeKey = username ? `login:${username}` : 'login:discoverable'
    const expectedChallenge = await this.config.challengeStorage.get(challengeKey)
    if (!expectedChallenge) {
      throw new PasskeyInvalidChallengeError()
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.config.expectedOrigins,
        expectedRPID: this.config.rpID,
        credential: {
          id: matched.credential.id,
          publicKey: new Uint8Array(matched.credential.publicKey),
          counter: matched.credential.counter,
          transports: matched.credential.transports as any[],
        },
        requireUserVerification: false,
      })

      const { verified, authenticationInfo } = verification

      if (verified) {
        await this.config.userStorage.updateCounter(
          matched.credential.id,
          authenticationInfo.newCounter
        )
      }

      await this.config.challengeStorage.delete(challengeKey)

      return {
        verified,
        username: matched.user.username,
      }
    } catch (error) {
      await this.config.challengeStorage.delete(challengeKey)
      throw new PasskeyError(
        error instanceof Error ? error.message : 'Authentication verification failed'
      )
    }
  }

  /**
   * 获取或创建用户
   */
  private async getOrCreateUser(username: string): Promise<User> {
    let user = await this.config.userStorage.findUser(username)
    if (!user) {
      user = await this.config.userStorage.createUser(username)
    }
    return user
  }

  /**
   * 验证用户名
   */
  private validateUsername(username: unknown): string {
    if (!username || typeof username !== 'string') {
      throw new PasskeyError('username is required')
    }
    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      throw new PasskeyError('username is required')
    }
    return trimmedUsername
  }

  /**
   * 处理错误响应
   */
  private handleError(res: Response, error: unknown): void {
    if (error instanceof PasskeyError) {
      res.status(400).json({ success: false, error: error.message })
    } else if (error instanceof Error) {
      res.status(500).json({ success: false, error: error.message })
    } else {
      res.status(500).json({ success: false, error: 'Unknown error' })
    }
  }
}

// 导出所有核心类型
export * from '@passkey/sdk-core'
