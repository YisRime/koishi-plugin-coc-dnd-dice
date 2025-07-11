import { Context, Schema, Random } from 'koishi'
import { CharacterManager } from './character'
import { COC7GameLogic } from './coc7th'
import { DND5EGameLogic } from './dnd5e'

export const name = 'coc-dnd-dice'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

// 掷骰函数
function rollDice(count: number, size: number): { results: number[], total: number } {
  const results: number[] = []
  for (let i = 0; i < count; i++) {
    results.push(Random.int(1, size + 1))
  }
  return { results, total: results.reduce((sum, val) => sum + val, 0) }
}

// 解析骰子表达式
function parseDiceExpression(expr: string, defaultSize: number = 100): { count: number, size: number } | null {
  // 支持格式: d20, 3d6, d, 20等
  const match = expr.match(/^(\d*)d(\d*)$/i)
  if (match) {
    const count = match[1] ? parseInt(match[1]) : 1
    const size = match[2] ? parseInt(match[2]) : defaultSize
    return { count, size }
  }

  // 单纯数字表示面数
  const numMatch = expr.match(/^\d+$/)
  if (numMatch) {
    return { count: 1, size: parseInt(expr) }
  }

  return null
}

// 检定成功度计算
function getSuccessLevel(result: number, target: number): string {
  if (result <= target / 5) return '大成功'
  if (result <= target / 2) return '极难成功'
  if (result <= target) return '成功'
  if (result >= 96) return '大失败'
  return '失败'
}

// 全局角色卡管理器
const characterManager = new CharacterManager()
// 全局 COC7 游戏逻辑
const coc7Logic = new COC7GameLogic()
// 全局 DND5E 游戏逻辑
const dnd5eLogic = new DND5EGameLogic()

export function apply(ctx: Context, config: Config) {
  // 基础掷骰命令 .r
  ctx.command('r [expression]', '掷骰子')
    .example('.r d20  掷一个20面骰')
    .example('.r 3d6  掷三个6面骰')
    .example('.r 20   掷一个20面骰')
    .action(async ({ session }, expression = 'd') => {
      const parsed = parseDiceExpression(expression, 100)
      if (!parsed) {
        return '骰子表达式格式错误！请使用如 d20、3d6 等格式'
      }

      const { count, size } = parsed

      if (count > 100) {
        return `骰子数量超过限制（最大100个）`
      }
      if (size > 1000) {
        return `骰子面数超过限制（最大1000面）`
      }

      const result = rollDice(count, size)

      if (count === 1) {
        return `${session.username} 掷出了 d${size}=${result.total}`
      } else {
        return `${session.username} 掷出了 ${count}d${size}=[${result.results.join('+')}]=${result.total}`
      }
    })

  // 检定命令 .ra
  ctx.command('ra <skill> [target]', '进行技能检定')
    .example('.ra 侦查 70  进行侦查检定，目标值70')
    .example('.ra 侦查     进行侦查检定，使用默认d100')
    .action(async ({ session }, skill, target) => {
      if (!skill) {
        return '请指定技能名称！'
      }

      const targetValue = target ? parseInt(target) : 70 // 默认目标值
      if (isNaN(targetValue) || targetValue < 1 || targetValue > 100) {
        return '目标值必须在1-100之间！'
      }

      const result = rollDice(1, 100)
      const rollValue = result.total
      const successLevel = getSuccessLevel(rollValue, targetValue)

      return `${session.username} 进行${skill}检定：d100=${rollValue}/${targetValue} ${successLevel}`
    })

  // 代替检定命令
  ctx.command('ra <skill> <target> <substitute>', '代替他人进行检定')
    .example('.ra 侦查 70 @张三  代替张三进行侦查检定')
    .action(async ({ session }, skill, target, substitute) => {
      if (!skill || !target || !substitute) {
        return '请指定技能名称、目标值和代替目标！'
      }

      const targetValue = parseInt(target)
      if (isNaN(targetValue) || targetValue < 1 || targetValue > 100) {
        return '目标值必须在1-100之间！'
      }

      const result = rollDice(1, 100)
      const rollValue = result.total
      const successLevel = getSuccessLevel(rollValue, targetValue)

      // 清理@符号
      const cleanSubstitute = substitute.replace(/^@/, '')

      return `${session.username} 代替 ${cleanSubstitute} 进行${skill}检定：d100=${rollValue}/${targetValue} ${successLevel}`
    })

  // 设置默认骰子面数
  ctx.command('set <size>', '设置默认骰子面数')
    .example('.set 20  设置默认骰子为20面')
    .action(async ({ session }, size) => {
      const diceSize = parseInt(size)
      if (isNaN(diceSize) || diceSize < 2 || diceSize > 1000) {
        return `骰子面数必须在2-1000之间！`
      }

      return `已设置默认骰子面数为 ${diceSize}`
    })

  // 注册角色卡相关命令
  characterManager.registerCommands(ctx)

  // 注册 COC7 相关命令
  coc7Logic.registerCommands(ctx, characterManager)

  // 注册 DND5E 相关命令
  dnd5eLogic.registerCommands(ctx, characterManager)
}
