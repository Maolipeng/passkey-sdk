#!/usr/bin/env node
/**
 * npm 发布脚本
 *
 * 使用方式：
 *   pnpm release        # 发布新版本（自动 bump version）
 *   pnpm release patch  # 发布 patch 版本 (1.0.0 -> 1.0.1)
 *   pnpm release minor  # 发布 minor 版本 (1.0.0 -> 1.1.0)
 *   pnpm release major  # 发布 major 版本 (1.0.0 -> 2.0.0)
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const PACKAGES = [
  'packages/passkey-sdk-core',
  'packages/passkey-browser-sdk',
  'packages/passkey-server-sdk',
]

const VERSION_TYPE = process.argv[2] || 'patch'

function run(cmd, cwd) {
  console.log(`\x1b[36m▶ ${cmd}\x1b[0m`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function getPackageVersion(pkgPath) {
  const pkg = JSON.parse(readFileSync(resolve(pkgPath, 'package.json'), 'utf8'))
  return pkg.version
}

function getCurrentRootVersion() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  return pkg.version
}

function updateWorkspaceDeps(newVersion) {
  // 更新所有包中 workspace:* 依赖的版本提示
  console.log('\x1b[32m✓ 所有包版本同步完成\x1b[0m')
}

function main() {
  console.log('\x1b[35m')
  console.log('╔════════════════════════════════════╗')
  console.log('║     Passkey SDK 发布脚本           ║')
  console.log('╚════════════════════════════════════╝')
  console.log('\x1b[0m')

  const currentVersion = getCurrentRootVersion()
  console.log(`\n当前版本: \x1b[33m${currentVersion}\x1b[0m`)
  console.log(`更新类型: \x1b[33m${VERSION_TYPE}\x1b[0m\n`)

  // 1. 确保已登录 npm
  try {
    execSync('npm whoami', { stdio: 'pipe' })
  } catch {
    console.error('\x1b[31m错误: 未登录 npm，请先运行 npm login\x1b[0m')
    process.exit(1)
  }

  // 2. 确保工作区干净
  const status = execSync('git status --porcelain', { encoding: 'utf8' })
  if (status.trim()) {
    console.error('\x1b[31m错误: 有未提交的更改，请先 commit\x1b[0m')
    process.exit(1)
  }

  // 3. 构建所有包
  console.log('\x1b[34m步骤 1: 构建所有包\x1b[0m')
  run('pnpm build', process.cwd())

  // 4. 更新版本号（使用 pnpm version 命令）
  console.log('\x1b[34m步骤 2: 更新版本号\x1b[0m')

  // 先更新核心包（其他包依赖它）
  for (const pkg of PACKAGES) {
    run(`pnpm version ${VERSION_TYPE} --no-git-tag-version`, resolve(process.cwd(), pkg))
  }

  const newVersions = {}
  for (const pkg of PACKAGES) {
    newVersions[pkg.split('/')[1]] = getPackageVersion(pkg)
  }

  console.log('\n新版本:')
  for (const [name, v] of Object.entries(newVersions)) {
    console.log(`  \x1b[32m${name}: ${v}\x1b[0m`)
  }

  // 5. 发布到 npm
  console.log('\x1b[34m步骤 3: 发布到 npm\x1b[0m')

  for (const pkg of PACKAGES) {
    const pkgJson = JSON.parse(readFileSync(resolve(pkg, 'package.json'), 'utf8'))
    const pkgName = pkgJson.name

    console.log(`\n发布 \x1b[33m${pkgName}\x1b[0m...`)
    run(`pnpm publish --access public --no-git-checks`, resolve(process.cwd(), pkg))
  }

  // 6. 提交版本更新
  console.log('\x1b[34m步骤 4: 提交版本更新\x1b[0m')

  const versionFiles = PACKAGES.map(p => `${p}/package.json`).join(' ')
  run(`git add ${versionFiles}`, process.cwd())

  const firstNewVersion = Object.values(newVersions)[0]
  run(`git commit -m "chore: release v${firstNewVersion}"`, process.cwd())
  run(`git tag v${firstNewVersion}`, process.cwd())

  console.log('\n\x1b[32m')
  console.log('╔════════════════════════════════════╗')
  console.log('║          发布成功！                 ║')
  console.log('╚════════════════════════════════════╝')
  console.log('\x1b[0m')
  console.log(`\n已发布版本: \x1b[33mv${firstNewVersion}\x1b[0m`)
  console.log('\n下一步:')
  console.log('  git push && git push --tags')
}

main()