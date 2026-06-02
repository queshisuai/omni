import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const consoleDir = resolve(import.meta.dirname, '..', 'src', 'app', 'console')
if (!existsSync(consoleDir)) {
  console.error('console 目录不存在:', consoleDir)
  process.exit(1)
}

try {
  const output = execFileSync('rg', [
    '-n',
    'window\\.(prompt|confirm|alert)\\(',
    consoleDir
  ], { encoding: 'utf8' })
  if (output.trim()) {
    console.error('后台目录仍然存在原生弹窗调用，请改用 GlobalDialog。')
    console.error(output)
    process.exit(1)
  }
} catch (e) {
  if (e.status === 1 && e.stdout === '' && e.stderr === '') {
    // rg returns exit code 1 when no matches found - this is success
    process.exit(0)
  }
  if (e.message && e.message.includes('ENOENT')) {
    console.error('未找到 rg (ripgrep) 命令，请先安装。尝试使用 findstr 替代。')
    // fallback to powershell findstr
    try {
      const psOut = execFileSync('powershell', [
        '-NoProfile',
        '-Command',
        `Get-ChildItem -Recurse -Include "*.tsx","*.ts" -LiteralPath "${consoleDir}" | Select-String -Pattern 'window\\.(prompt|confirm|alert)\\('`
      ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      if (psOut.trim()) {
        console.error('后台目录仍然存在原生弹窗调用，请改用 GlobalDialog。')
        console.error(psOut)
        process.exit(1)
      }
      process.exit(0)
    } catch (psErr) {
      console.error('所有检查方式都失败:', psErr.message)
      process.exit(1)
    }
  }
  console.error('检查出错:', e.message)
  process.exit(1)
}
