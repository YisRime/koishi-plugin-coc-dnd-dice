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
    ctx.subcommand('dnd [count]', '生成DND5E随机属性')
      .usage('生成D&D5E规则的角色属性（4d6舍去最低值）。可以指定生成数量。')
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
    ctx.subcommand('r').subcommand('d优势', '进行优势掷骰')
      .usage('进行一次优势掷骰，投掷两次d20并取较高结果。')
      .example('r d优势  掷两次d20取较高值')
      .action(async ({ session }) => {
        const roll1 = Random.int(1, 21)
        const roll2 = Random.int(1, 21)
        const result = Math.max(roll1, roll2)

        return `${session.username} 进行优势掷骰：d20=[${roll1}, ${roll2}]，取较高值 ${result}`
      })

    ctx.subcommand('r').subcommand('d劣势', '进行劣势掷骰')
      .usage('进行一次劣势掷骰，投掷两次d20并取较低结果。')
      .example('r d劣势  掷两次d20取较低值')
      .action(async ({ session }) => {
        const roll1 = Random.int(1, 21)
        const roll2 = Random.int(1, 21)
        const result = Math.min(roll1, roll2)

        return `${session.username} 进行劣势掷骰：d20=[${roll1}, ${roll2}]，取较低值 ${result}`
      })

    // 检定命令
    ctx.subcommand('rc [advantage] <skill> [modifier]', '进行DND5E检定')
      .usage('进行D&D5E的技能检定。可以指定优势、劣势，并附加调整值。\n参数advantage可以是"优势"或"劣势"。\n参数modifier可以是技能名称的一部分，如"运动+5"。')
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
    ctx.subcommand('ri [modifierArg] [target]', '掷先攻并加入列表')
      .usage('投掷先攻（d20+调整值），并将角色加入先攻列表。\n可以指定调整值（如 +4 或 -1）和角色名。')
      .example('ri        为当前角色掷先攻')
      .example('ri +5     为当前角色掷先攻，调整值为+5')
      .example('ri 哥布林  为哥布林掷先攻')
      .example('ri -1 哥布林 为哥布林掷先攻，调整值为-1')
      .action(async ({ session }, modifierArg, target) => {
        let characterName: string | undefined;
        let modValue = 0;

        const isModifierString = (s: any): s is string => typeof s === 'string' && (s.startsWith('+') || s.startsWith('-'));

        if (isModifierString(modifierArg)) {
          modValue = parseInt(modifierArg) || 0;
          characterName = target;
        } else if (isModifierString(target)) {
          modValue = parseInt(target) || 0;
          characterName = modifierArg;
        } else {
          characterName = modifierArg;
        }

        if (!characterName) {
          characterName = this.getCharacterName(session, characterManager);
        }

        if (!characterName) {
          return '请指定角色名称或先绑定角色卡！'
        }

        const { d20, total } = this.rollInitiative(modValue);
        this.addToInitiative(characterName, total, session.userId);

        const modText = modValue !== 0 ? ` ${modValue > 0 ? '+' : ''}${modValue}` : '';
        const resultText = `d20(${d20})${modText} = ${total}`;

        return `${characterName} 的先攻：${resultText}`;
      })

    // 先攻列表命令
    const init = ctx.subcommand('init', '显示先攻列表')
      .usage('管理战斗轮的先攻顺序。')
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
      .usage('清空当前的先攻列表，用于战斗结束。')
      .example('init.clear  清空当前先攻列表')
      .action(async ({ session }) => {
        this.initiativeList = []
        return '先攻列表已清空！'
      })

    // 随机D&D名字
    ctx.subcommand('namednd <race> [count]', '生成随机D&D名字')
      .usage('根据D&D5E的种族模板生成随机姓名。\n可用种族：人类、精灵、矮人、半身人、龙裔、提夫林。')
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
  rollInitiative(modifier: number = 0): { d20: number, total: number } {
    const d20 = Random.int(1, 21);
    const total = d20 + modifier;
    return { d20, total };
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
