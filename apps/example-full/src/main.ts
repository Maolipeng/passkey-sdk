/**
 * Passkey SDK 完整示例 - 前端
 *
 * 展示功能：
 * - PasskeyClient 完整使用
 * - 事件钩子（生命周期回调）
 * - 调试模式
 * - 错误处理
 * - 自动发现 Passkey
 * - 统计追踪
 */

import { PasskeyClient, type PasskeyEnvironment } from '@passkey/browser-sdk'

// ============================================================================
// 统计追踪
// ============================================================================

interface Stats {
  registerSuccess: number
  registerFail: number
  loginSuccess: number
  loginFail: number
}

const stats: Stats = {
  registerSuccess: 0,
  registerFail: 0,
  loginSuccess: 0,
  loginFail: 0,
}

function updateStatsDisplay() {
  document.getElementById('stat-register-success')!.textContent = stats.registerSuccess.toString()
  document.getElementById('stat-register-fail')!.textContent = stats.registerFail.toString()
  document.getElementById('stat-login-success')!.textContent = stats.loginSuccess.toString()
  document.getElementById('stat-login-fail')!.textContent = stats.loginFail.toString()
}

// ============================================================================
// 日志系统
// ============================================================================

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const logEl = document.getElementById('event-log')!
  const timestamp = new Date().toLocaleTimeString()
  const newLog = `[${timestamp}] ${message}\n`
  logEl.textContent = newLog + (logEl.textContent || '')
}

function showResult(elementId: string, message: string, isSuccess: boolean) {
  const el = document.getElementById(elementId)!
  el.style.display = 'block'
  el.className = `log-entry ${isSuccess ? 'success' : 'error'}`
  el.textContent = message
}

// ============================================================================
// PasskeyClient 配置
// ============================================================================

// 创建客户端实例，配置调试模式和事件钩子
const client = new PasskeyClient(
  {
    baseURL: 'http://localhost:3002/api/passkey',
    debug: true, // 开启调试日志
    timeout: 30000, // 30秒超时
  },
  {
    // 注册事件钩子
    register: {
      onStart: (username) => {
        log(`🚀 注册开始: ${username}`, 'info')
      },
      onSuccess: (username, credentialCount) => {
        log(`✅ 注册成功: ${username}，凭证数量: ${credentialCount}`, 'success')
        stats.registerSuccess++
        updateStatsDisplay()
      },
      onError: (username, error) => {
        log(`❌ 注册失败: ${username} - ${error.message}`, 'error')
        stats.registerFail++
        updateStatsDisplay()
      },
    },
    // 登录事件钩子
    login: {
      onStart: (username) => {
        log(`🚀 登录开始: ${username || '自动发现'}`, 'info')
      },
      onSuccess: (username) => {
        log(`✅ 登录成功: ${username}`, 'success')
        stats.loginSuccess++
        updateStatsDisplay()
      },
      onError: (username, error) => {
        log(`❌ 登录失败: ${username || '自动发现'} - ${error.message}`, 'error')
        stats.loginFail++
        updateStatsDisplay()
      },
    },
  }
)

// ============================================================================
// UI 初始化
// ============================================================================

// DOM 元素
const envChips = document.getElementById('env-chips')!
const registerUsername = document.getElementById('register-username') as HTMLInputElement
const registerBtn = document.getElementById('register-btn') as HTMLButtonElement
const registerAdvancedBtn = document.getElementById('register-advanced-btn') as HTMLButtonElement
const loginUsername = document.getElementById('login-username') as HTMLInputElement
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement
const loginDiscoverableBtn = document.getElementById('login-discoverable-btn') as HTMLButtonElement

// 检测环境
async function checkEnvironment() {
  try {
    const env = await client.getEnvironment()
    renderEnvironment(env)
    log(`🔍 环境检测完成: WebAuthn=${env.supported}, Platform=${env.platformAvailable}`)
  } catch (error) {
    renderEnvironment({ supported: false, platformAvailable: false })
    log(`❌ 环境检测失败: ${error}`)
  }
}

function renderEnvironment(env: PasskeyEnvironment) {
  const chips = []

  if (env.supported) {
    chips.push(`<span class="chip success">WebAuthn 支持</span>`)
  } else {
    chips.push(`<span class="chip error">WebAuthn 不支持</span>`)
  }

  if (env.platformAvailable) {
    chips.push(`<span class="chip success">平台认证器可用</span>`)
  } else {
    chips.push(`<span class="chip neutral">平台认证器不可用</span>`)
  }

  chips.push(`<span class="chip neutral">API: localhost:3002</span>`)

  envChips.innerHTML = chips.join('')
}

// ============================================================================
// 按钮状态管理
// ============================================================================

function setBusy(busy: boolean) {
  registerBtn.disabled = busy
  registerAdvancedBtn.disabled = busy
  loginBtn.disabled = busy
  loginDiscoverableBtn.disabled = busy

  // 更新按钮文字
  if (busy) {
    registerBtn.textContent = '注册中...'
    loginBtn.textContent = '登录中...'
  } else {
    registerBtn.textContent = '注册通行密钥'
    loginBtn.textContent = '登录'
  }
}

// ============================================================================
// 注册功能
// ============================================================================

// 基础注册
registerBtn.addEventListener('click', async () => {
  const username = registerUsername.value.trim()
  if (!username) {
    showResult('register-result', '请输入用户名', false)
    return
  }

  setBusy(true)
  showResult('register-result', '正在注册...', true)

  try {
    const result = await client.register(username)
    showResult('register-result', `注册成功！凭证数量: ${result.credentialCount}`, result.verified)
    log(`📊 注册结果: ${JSON.stringify(result)}`)
  } catch (error) {
    const err = error as Error
    showResult('register-result', `注册失败: ${err.message}`, false)
  } finally {
    setBusy(false)
  }
})

// 高级选项注册（展示自定义配置）
registerAdvancedBtn.addEventListener('click', async () => {
  const username = registerUsername.value.trim()
  if (!username) {
    showResult('register-result', '请输入用户名', false)
    return
  }

  setBusy(true)
  showResult('register-result', '使用高级选项注册...', true)
  log('⚙️ 高级选项: 调试模式已开启，事件钩子已绑定')

  try {
    const result = await client.register(username)
    showResult('register-result', `高级注册成功！凭证数量: ${result.credentialCount}`, result.verified)
  } catch (error) {
    const err = error as Error
    showResult('register-result', `高级注册失败: ${err.message}`, false)
  } finally {
    setBusy(false)
  }
})

// ============================================================================
// 登录功能
// ============================================================================

// 基础登录（指定用户名）
loginBtn.addEventListener('click', async () => {
  const username = loginUsername.value.trim()
  if (!username) {
    showResult('login-result', '请输入用户名或使用自动发现', false)
    return
  }

  setBusy(true)
  showResult('login-result', '正在登录...', true)

  try {
    const result = await client.login(username)
    showResult('login-result', `登录成功！用户: ${result.username}`, result.verified)
    log(`📊 登录结果: ${JSON.stringify(result)}`)
  } catch (error) {
    const err = error as Error
    showResult('login-result', `登录失败: ${err.message}`, false)
  } finally {
    setBusy(false)
  }
})

// 自动发现 Passkey（不指定用户名）
loginDiscoverableBtn.addEventListener('click', async () => {
  setBusy(true)
  showResult('login-result', '自动发现 Passkey...', true)
  log('🔍 自动发现模式: 不指定用户名，由系统选择可用凭证')

  try {
    // 不传用户名，触发自动发现流程
    const result = await client.login()
    showResult('login-result', `自动登录成功！用户: ${result.username}`, result.verified)
  } catch (error) {
    const err = error as Error
    showResult('login-result', `自动登录失败: ${err.message}`, false)
    log('💡 提示: 自动发现需要支持 discoverable credentials 的认证器')
  } finally {
    setBusy(false)
  }
})

// ============================================================================
// 初始化
// ============================================================================

checkEnvironment()
log('📱 Passkey SDK 示例已加载')
log('💡 提示: 首次使用请先注册，然后登录验证')
