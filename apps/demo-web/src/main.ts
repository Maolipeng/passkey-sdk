import { PasskeyClient } from '@passkey/browser-sdk'

const logEl = document.querySelector('#log')
const envEl = document.querySelector('#env')
const usernameEl = document.querySelector('#username')
const registerBtn = document.querySelector('#registerBtn')
const loginBtn = document.querySelector('#loginBtn')

const client = new PasskeyClient(
  { baseURL: 'http://localhost:3000/api', debug: true },
  {
    register: {
      onStart: (username) => console.log(`Register started: ${username}`),
      onSuccess: (username, count) => console.log(`Register success: ${username}, ${count} credentials`),
      onError: (username, error) => console.error(`Register error: ${username}`, error),
    },
    login: {
      onStart: (username) => console.log(`Login started: ${username}`),
      onSuccess: (username) => console.log(`Login success: ${username}`),
      onError: (username, error) => console.error(`Login error: ${username}`, error),
    },
  }
)

function setLog(value) {
  logEl.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function setBusy(busy) {
  registerBtn.disabled = busy
  loginBtn.disabled = busy
}

async function renderEnv() {
  const env = await client.getEnvironment()
  const items = [
    `WebAuthn 支持：${env.supported ? '是' : '否'}`,
    `平台认证器：${env.platformAvailable ? '可用' : '不可用/未知'}`,
    'API：http://localhost:3000/api',
  ]
  envEl.innerHTML = items.map((item) => `<span class="chip">${item}</span>`).join('')
}

registerBtn.addEventListener('click', async () => {
  try {
    setBusy(true)
    setLog('正在拉取注册参数并触发系统通行密钥面板...')
    const result = await client.register(usernameEl.value.trim())
    setLog({ action: 'register', ...result })
  } catch (error) {
    setLog({ action: 'register', error: error.message })
  } finally {
    setBusy(false)
  }
})

loginBtn.addEventListener('click', async () => {
  try {
    setBusy(true)
    setLog('正在拉取登录参数并触发系统通行密钥登录...')
    const result = await client.login(usernameEl.value.trim())
    setLog({ action: 'login', ...result })
  } catch (error) {
    setLog({ action: 'login', error: error.message })
  } finally {
    setBusy(false)
  }
})

renderEnv().catch((error) => setLog({ action: 'env', error: error.message }))