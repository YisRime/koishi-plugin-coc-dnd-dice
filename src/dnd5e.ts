import { Random } from 'koishi'
import { Template } from './template'

// 先攻列表管理
interface InitiativeEntry {
  name: string
  initiative: number
  userId?: string
}

export class DND5EGameLogic {
  private initiativeList: InitiativeEntry[] = []

  // 获取种族名字数据
  private getNameData() {
    return Template.getTemplate('dnd5e_names') || {}
  }

  // 注册 DND5E 相关命令
  registerCommands(ctx: any, characterManager: any) {
    // DND5E 生成随机属性
    ctx.command('dnd [count]', '生成DND5E随机属性')
      .example('dnd     生成一组属性')
      .example('dnd 3   生成三组属性')
      .action(async ({ session }, count) => {
        const num = count ? parseInt(count) : 1
        if (isNaN(num) || num < 1 || num > 10) {
          return '生成数量必须在1-10之间！'
        }

        const results = this.generateAttributes(num)

        if (num === 1) {
          const attr = results[0]
          const total = attr.str + attr.dex + attr.con + attr.int + attr.wis + attr.cha
          const bonus = this.getAbilityModifiers(attr)
          return `${session.username} 的属性：
力量：${attr.str} (${bonus.str >= 0 ? '+' : ''}${bonus.str})
敏捷：${attr.dex} (${bonus.dex >= 0 ? '+' : ''}${bonus.dex})
体质：${attr.con} (${bonus.con >= 0 ? '+' : ''}${bonus.con})
智力：${attr.int} (${bonus.int >= 0 ? '+' : ''}${bonus.int})
感知：${attr.wis} (${bonus.wis >= 0 ? '+' : ''}${bonus.wis})
魅力：${attr.cha} (${bonus.cha >= 0 ? '+' : ''}${bonus.cha})
总计：${total}`
        } else {
          const attrList = results.map((attr, index) => {
            const total = attr.str + attr.dex + attr.con + attr.int + attr.wis + attr.cha
            return `第${index + 1}组 - 力量:${attr.str} 敏捷:${attr.dex} 体质:${attr.con} 智力:${attr.int} 感知:${attr.wis} 魅力:${attr.cha} (总计:${total})`
          }).join('\n')
          return `${session.username} 的属性组：\n${attrList}`
        }
      })

    // 优势/劣势掷骰命令，扩展原有的 r 命令
    ctx.command('r').subcommand('d优势', '进行优势掷骰')
      .example('r d优势  掷两次d20取较高值')
      .action(async ({ session }) => {
        const roll1 = Random.int(1, 21)
        const roll2 = Random.int(1, 21)
        const result = Math.max(roll1, roll2)

        return `${session.username} 进行优势掷骰：d20=[${roll1}, ${roll2}]，取较高值 ${result}`
      })

    ctx.command('r').subcommand('d劣势', '进行劣势掷骰')
      .example('r d劣势  掷两次d20取较低值')
      .action(async ({ session }) => {
        const roll1 = Random.int(1, 21)
        const roll2 = Random.int(1, 21)
        const result = Math.min(roll1, roll2)

        return `${session.username} 进行劣势掷骰：d20=[${roll1}, ${roll2}]，取较低值 ${result}`
      })

    // 检定命令
    ctx.command('rc [advantage] <skill> [modifier]', '进行DND5E检定')
      .example('rc 运动      进行运动检定')
      .example('rc 优势 运动  进行优势运动检定')
      .example('rc 劣势 运动  进行劣势运动检定')
      .example('rc 运动+5    进行运动检定，调整值+5')
      .action(async ({ session }, advantage, skill, modifier) => {
        // 参数处理
        let hasAdvantage = false
        let hasDisadvantage = false
        let skillName = skill
        let modValue = 0

        if (advantage === '优势' || advantage === '劣势') {
          hasAdvantage = advantage === '优势'
          hasDisadvantage = advantage === '劣势'
        } else if (advantage) {
          skillName = advantage
          skill = modifier
        }

        // 处理调整值
        if (skillName && skillName.includes('+')) {
          const parts = skillName.split('+')
          skillName = parts[0]
          modValue = parseInt(parts[1]) || 0
        } else if (skillName && skillName.includes('-')) {
          const parts = skillName.split('-')
          skillName = parts[0]
          modValue = -(parseInt(parts[1]) || 0)
        }

        if (!skillName) {
          return '请指定技能名称！'
        }

        const result = this.skillCheck(skillName, hasAdvantage, hasDisadvantage, modValue)
        const advantageText = hasAdvantage ? '(优势)' : hasDisadvantage ? '(劣势)' : ''
        const modText = modValue !== 0 ? ` ${modValue >= 0 ? '+' : ''}${modValue}` : ''

        return `${session.username} 进行${skillName}检定${advantageText}：${result.rollText} = ${result.total}${modText}`
      })

    // 先攻命令
    ctx.command('ri [name]', '掷先攻并加入列表')
      .example('ri        为当前角色掷先攻')
      .example('ri 哥布林  为哥布林掷先攻')
      .action(async ({ session }, name) => {
        const characterName = name || this.getCharacterName(session, characterManager)

        if (!characterName) {
          return '请指定角色名称或先绑定角色卡！'
        }

        const initiative = this.rollInitiative()
        this.addToInitiative(characterName, initiative, session.userId)

        return `${characterName} 的先攻：d20+敏捷调整值 = ${initiative}`
      })

    // 先攻列表命令
    const init = ctx.command('init', '显示先攻列表')
      .example('init  显示当前先攻列表')
      .action(async ({ session }) => {
        if (this.initiativeList.length === 0) {
          return '先攻列表为空！使用 .ri <角色名> 添加角色到先攻列表'
        }

        const sortedList = this.getSortedInitiativeList()
        const listText = sortedList.map((entry, index) =>
          `${index + 1}. ${entry.name} (先攻: ${entry.initiative})`
        ).join('\n')

        return `先攻列表：\n${listText}`
      })

    // 清空先攻列表
    init.subcommand('.clear', '清空先攻列表')
      .example('init.clear  清空当前先攻列表')
      .action(async ({ session }) => {
        this.initiativeList = []
        return '先攻列表已清空！'
      })

    // 随机D&D名字
    ctx.command('namednd <race> [count]', '生成随机D&D名字')
      .example('namednd 人类    生成一个人类名字')
      .example('namednd 精灵 3  生成三个精灵名字')
      .action(async ({ session }, race, count) => {
        if (!race) {
          const nameData = this.getNameData()
          const races = Object.keys(nameData).join('、')
          return `请指定种族！可用种族：${races}`
        }

        const nameData = this.getNameData()
        if (!nameData[race]) {
          const races = Object.keys(nameData).join('、')
          return `未知种族"${race}"！可用种族：${races}`
        }

        const num = count ? parseInt(count) : 1
        if (isNaN(num) || num < 1 || num > 10) {
          return '生成数量必须在1-10之间！'
        }

        const names = this.generateNames(race, num)

        if (num === 1) {
          return `${session.username} 生成的${race}名字：${names[0]}`
        } else {
          const nameList = names.map((name, index) => `${index + 1}. ${name}`).join('\n')
          return `${session.username} 生成的${race}名字：\n${nameList}`
        }
      })
  }

  // 生成随机属性（4d6去掉最小值）
  generateAttributes(count: number = 1): Array<{str: number, dex: number, con: number, int: number, wis: number, cha: number}> {
    const results = []

    for (let i = 0; i < count; i++) {
      const attributes = {
        str: this.roll4d6DropLowest(),
        dex: this.roll4d6DropLowest(),
        con: this.roll4d6DropLowest(),
        int: this.roll4d6DropLowest(),
        wis: this.roll4d6DropLowest(),
        cha: this.roll4d6DropLowest()
      }
      results.push(attributes)
    }

    return results
  }

  // 4d6去掉最小值
  private roll4d6DropLowest(): number {
    const rolls = [
      Random.int(1, 7),
      Random.int(1, 7),
      Random.int(1, 7),
      Random.int(1, 7)
    ]
    rolls.sort((a, b) => b - a) // 降序排列
    return rolls[0] + rolls[1] + rolls[2] // 取前三个最大值
  }

  // 计算属性调整值
  private getAbilityModifiers(attributes: {str: number, dex: number, con: number, int: number, wis: number, cha: number}) {
    return {
      str: Math.floor((attributes.str - 10) / 2),
      dex: Math.floor((attributes.dex - 10) / 2),
      con: Math.floor((attributes.con - 10) / 2),
      int: Math.floor((attributes.int - 10) / 2),
      wis: Math.floor((attributes.wis - 10) / 2),
      cha: Math.floor((attributes.cha - 10) / 2)
    }
  }

  // 技能检定
  skillCheck(skill: string, hasAdvantage: boolean = false, hasDisadvantage: boolean = false, modifier: number = 0): { rollText: string, total: number } {
    if (hasAdvantage && hasDisadvantage) {
      // 优势和劣势抵消，正常掷骰
      hasAdvantage = false
      hasDisadvantage = false
    }

    let roll1 = Random.int(1, 21)
    let rollText = `d20=${roll1}`
    let finalRoll = roll1

    if (hasAdvantage || hasDisadvantage) {
      const roll2 = Random.int(1, 21)
      finalRoll = hasAdvantage ? Math.max(roll1, roll2) : Math.min(roll1, roll2)
      rollText = `d20=[${roll1}, ${roll2}]，取${hasAdvantage ? '较高' : '较低'}值${finalRoll}`
    }

    const total = finalRoll + modifier

    return { rollText, total }
  }

  // 掷先攻
  rollInitiative(): number {
    const d20 = Random.int(1, 21)
    const dexMod = Random.int(0, 6) // 简化处理，随机敏捷调整值0-5
    return d20 + dexMod
  }

  // 添加到先攻列表
  addToInitiative(name: string, initiative: number, userId?: string): void {
    // 检查是否已存在同名角色
    const existingIndex = this.initiativeList.findIndex(entry => entry.name === name)

    if (existingIndex !== -1) {
      // 更新现有角色的先攻
      this.initiativeList[existingIndex].initiative = initiative
      this.initiativeList[existingIndex].userId = userId
    } else {
      // 添加新角色
      this.initiativeList.push({ name, initiative, userId })
    }
  }

  // 获取排序后的先攻列表
  getSortedInitiativeList(): InitiativeEntry[] {
    return [...this.initiativeList].sort((a, b) => b.initiative - a.initiative)
  }

  // 获取角色名
  private getCharacterName(session: any, characterManager: any): string {
    const activeCard = characterManager.getCard(session.userId)
    return activeCard ? activeCard.name : session.username
  }

  // 生成随机名字
  generateNames(race: string, count: number): string[] {
    const nameData = this.getNameData()
    const raceData = nameData[race]
    if (!raceData) return []

    const names = []
    for (let i = 0; i < count; i++) {
      const ismale = Random.int(0, 2) === 0 // 随机选择性别
      const firstName = Random.pick(ismale ? raceData.male : raceData.female)
      const lastName = Random.pick(raceData.surname)
      names.push(`${firstName} ${lastName}`)
    }

    return names
  }
}
