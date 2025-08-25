import { Random } from 'koishi'
import { Template } from './template'

export class COC7GameLogic {
  private houseRule: number = 0

  // 获取技能列表
  private getSkills() {
    return Template.getTemplate('coc7_skills') || {}
  }

  // 获取房规列表
  private getHouseRules() {
    return Template.getTemplate('coc7_house_rules') || []
  }

  // 获取即时疯狂症状
  private getImmediateMadnessList() {
    return Template.getTemplate('coc7_immediate_madness') || []
  }

  // 获取总结性疯狂症状
  private getSummaryMadnessList() {
    return Template.getTemplate('coc7_summary_madness') || []
  }

  // 注册 COC7 相关命令
  registerCommands(ctx: any, characterManager: any) {
    // COC7 生成随机属性
    ctx.subcommand('coc [count]', '生成COC7随机属性')
      .usage('生成CoC7规则的调查员属性。可以一次生成多组供选择。')
      .example('coc     生成一组属性')
      .example('coc 3   生成三组属性')
      .action(async ({ session }, count) => {
        const num = count ? parseInt(count) : 1
        if (isNaN(num) || num < 1 || num > 10) {
          return '生成数量必须在1-10之间！'
        }

        const results = this.generateAttributes(num)

        if (num === 1) {
          const attr = results[0]
          return `${session.username} 的属性：
力量：${attr.str}  敏捷：${attr.dex}  意志：${attr.pow}
体质：${attr.con}  外貌：${attr.app}  智力：${attr.int}
体型：${attr.siz}  教育：${attr.edu}
总计：${attr.str + attr.dex + attr.pow + attr.con + attr.app + attr.int + attr.siz + attr.edu}`
        } else {
          const attrList = results.map((attr, index) =>
            `第${index + 1}组 - 力量:${attr.str} 敏捷:${attr.dex} 意志:${attr.pow} 体质:${attr.con} 外貌:${attr.app} 智力:${attr.int} 体型:${attr.siz} 教育:${attr.edu} (总计:${attr.str + attr.dex + attr.pow + attr.con + attr.app + attr.int + attr.siz + attr.edu})`
          ).join('\n')
          return `${session.username} 的属性组：\n${attrList}`
        }
      })

    // 理智检定
    ctx.subcommand('sc <success>/<failure>', '进行理智检定')
      .usage('进行一次理智检定(Sanity Check)。\n格式为 <成功损失>/<失败损失>，例如 1/1d6。目前仅支持纯数字损失。')
      .example('sc 1/3   成功失去1点理智，失败失去3点')
      .action(async ({ session }, expression) => {
        const match = expression.match(/^(\d+)\/(\d+)$/)
        if (!match) {
          return '格式错误！请使用 .sc <成功损失>/<失败损失> 格式，如 .sc 1/3'
        }

        const successLoss = parseInt(match[1])
        const failureLoss = parseInt(match[2])

        if (successLoss < 0 || failureLoss < 0 || successLoss > 20 || failureLoss > 20) {
          return '理智损失值必须在0-20之间！'
        }

        const result = this.sanityCheck(successLoss, failureLoss)
        return `${session.username} 进行理智检定：d100=${result.roll} ${result.result}
理智损失：${result.sanityLoss}点`
      })

    // 对抗检定
    ctx.subcommand('rav <skill1> <skill2> [opponent]', '进行对抗检定')
      .usage('进行一次对抗检定。双方各自掷骰，比较成功等级来决定胜负。\n若不指定对手，则默认为与"AI"对抗。')
      .example('rav 侦查 潜行      自己侦查对抗AI潜行')
      .example('rav 侦查 潜行 @张三  自己侦查对抗张三潜行')
      .action(async ({ session }, skill1, skill2, opponent) => {
        if (!skill1 || !skill2) {
          return '请指定双方技能！'
        }

        // 获取技能值（这里简化处理，实际应从角色卡获取）
        const skill1Value = 50 // 默认值，实际应从角色卡获取
        const skill2Value = 50 // 默认值，实际应从角色卡获取

        const result = this.opposedCheck(skill1Value, skill2Value)
        const opponentName = opponent ? opponent.replace(/^@/, '') : 'AI'

        return `${session.username}(${skill1}) VS ${opponentName}(${skill2})
${session.username}：d100=${result.roll1} ${result.result1}
${opponentName}：d100=${result.roll2} ${result.result2}
结果：${result.winner}`
      })

    // 奖励骰检定
    ctx.subcommand('rab [count] <skill> [target]', '进行奖励骰检定')
      .usage('进行一次奖励骰检定。投掷一个主骰和若干个奖励骰（十位），取最小的十位数组合个位数作为最终结果。')
      .example('rab 侦查 70     进行1个奖励骰的侦查检定')
      .example('rab 2 侦查 70  进行2个奖励骰的侦查检定')
      .action(async ({ session }, count, skill, target) => {
        // 如果第一个参数是技能名，调整参数
        if (isNaN(parseInt(count))) {
          target = skill
          skill = count
          count = '1'
        }

        if (!skill) {
          return '请指定技能名称！'
        }

        const bonusCount = parseInt(count) || 1
        if (bonusCount > 5) {
          return '奖励骰数量不能超过5个！'
        }

        const targetValue = target ? parseInt(target) : 70
        if (isNaN(targetValue) || targetValue < 1 || targetValue > 100) {
          return '目标值必须在1-100之间！'
        }

        const result = this.bonusRoll(targetValue, bonusCount)
        return `${session.username} 进行${skill}检定(${bonusCount}个奖励骰)：
主骰：${result.roll} 奖励骰：[${result.bonusDice.join(',')}]
最终结果：d100=${result.finalRoll}/${targetValue} ${result.result}`
      })

    // 惩罚骰检定
    ctx.subcommand('rap [count] <skill> [target]', '进行惩罚骰检定')
      .usage('进行一次惩罚骰检定。投掷一个主骰和若干个惩罚骰（十位），取最大的十位数组合个位数作为最终结果。')
      .example('rap 侦查 70     进行1个惩罚骰的侦查检定')
      .example('rap 2 侦查 70  进行2个惩罚骰的侦查检定')
      .action(async ({ session }, count, skill, target) => {
        // 如果第一个参数是技能名，调整参数
        if (isNaN(parseInt(count))) {
          target = skill
          skill = count
          count = '1'
        }

        if (!skill) {
          return '请指定技能名称！'
        }

        const penaltyCount = parseInt(count) || 1
        if (penaltyCount > 5) {
          return '惩罚骰数量不能超过5个！'
        }

        const targetValue = target ? parseInt(target) : 70
        if (isNaN(targetValue) || targetValue < 1 || targetValue > 100) {
          return '目标值必须在1-100之间！'
        }

        const result = this.penaltyRoll(targetValue, penaltyCount)
        return `${session.username} 进行${skill}检定(${penaltyCount}个惩罚骰)：
主骰：${result.roll} 惩罚骰：[${result.penaltyDice.join(',')}]
最终结果：d100=${result.finalRoll}/${targetValue} ${result.result}`
      })

    // 即时疯狂症状
    ctx.subcommand('ti', '获取即时疯狂症状')
      .usage('从内置的疯狂症状表中随机抽取一条即时疯狂症状。')
      .example('ti  获取一个即时疯狂症状')
      .action(async ({ session }) => {
        const symptom = this.getImmediateMadness()
        return `${session.username} 的即时疯狂症状：\n${symptom}`
      })

    // 总结性疯狂症状
    ctx.subcommand('li', '获取总结性疯狂症状')
      .usage('从内置的疯狂症状表中随机抽取一条总结性疯狂症状。')
      .example('li  获取一个总结性疯狂症状')
      .action(async ({ session }) => {
        const symptom = this.getSummaryMadness()
        return `${session.username} 的总结性疯狂症状：\n${symptom}`
      })

    // 技能成长
    ctx.subcommand('en <skill>', '进行技能成长检定')
      .usage('为当前角色卡的指定技能进行成长检定。检定成功（d100>技能值）则增加1d10技能点。')
      .example('en 侦查  对侦查技能进行成长检定')
      .action(async ({ session }, skill) => {
        if (!skill) {
          return '请指定技能名称！'
        }

        const activeCard = characterManager.getCard(session.userId)
        if (!activeCard) {
          return '您还没有绑定角色卡！请先使用 .pc new <角色名> 创建或 .pc tag <角色名> 绑定角色卡'
        }

        const currentSkill = activeCard.getAttribute(skill) || 0
        if (currentSkill === 0) {
          return `角色"${activeCard.name}"还没有设置${skill}技能值！`
        }

        const result = this.skillGrowth(currentSkill)

        if (result.success) {
          activeCard.setAttribute(skill, result.newSkill)
          return `${activeCard.name} 的${skill}技能成长检定：
d100=${result.roll} > ${currentSkill} 成功！
${skill} ${currentSkill} → ${result.newSkill} (+${result.growth})`
        } else {
          return `${activeCard.name} 的${skill}技能成长检定：
d100=${result.roll} ≤ ${currentSkill} 失败，技能未成长`
        }
      })

    // 设置房规
    ctx.subcommand('setcoc [ruleId]', '设置COC7房规')
      .usage('设置或查看当前会话的COC7房规。房规可能会影响检定规则。')
      .example('setcoc details  列出所有房规')
      .example('setcoc 1        设置房规1')
      .action(async ({ session }, ruleId) => {
        if (ruleId === 'details') {
          const rules = this.getAllHouseRules()
          const ruleList = rules.map(rule =>
            `${rule.id}. ${rule.name} - ${rule.description}`
          ).join('\n')
          return `COC7 房规列表：\n${ruleList}\n\n当前使用：${this.getCurrentHouseRule().name}`
        }

        if (ruleId === undefined) {
          const current = this.getCurrentHouseRule()
          return `当前房规：${current.name} - ${current.description}\n使用 .setcoc details 查看所有房规`
        }

        const id = parseInt(ruleId)
        if (isNaN(id)) {
          return '房规编号必须是数字！使用 .setcoc details 查看可用房规'
        }

        const success = this.setHouseRule(id)
        if (!success) {
          return '无效的房规编号！使用 .setcoc details 查看可用房规'
        }

        const newRule = this.getCurrentHouseRule()
        return `已设置房规：${newRule.name} - ${newRule.description}`
      })
  }

  // 生成随机属性
  generateAttributes(count: number = 1): Array<{str: number, dex: number, pow: number, con: number, app: number, int: number, siz: number, edu: number}> {
    const results = []

    for (let i = 0; i < count; i++) {
      const attributes = {
        str: this.roll3d6() * 5,  // 力量
        dex: this.roll3d6() * 5,  // 敏捷
        pow: this.roll3d6() * 5,  // 意志
        con: this.roll3d6() * 5,  // 体质
        app: this.roll3d6() * 5,  // 外貌
        int: (this.roll2d6() + 6) * 5,  // 智力
        siz: (this.roll2d6() + 6) * 5,  // 体型
        edu: (this.roll2d6() + 6) * 5   // 教育
      }
      results.push(attributes)
    }

    return results
  }

  // 3d6骰点
  private roll3d6(): number {
    return Random.int(1, 7) + Random.int(1, 7) + Random.int(1, 7)
  }

  // 2d6骰点
  private roll2d6(): number {
    return Random.int(1, 7) + Random.int(1, 7)
  }

  // 理智检定
  sanityCheck(successLoss: number, failureLoss: number): { roll: number, result: string, sanityLoss: number } {
    const roll = Random.int(1, 101)
    const isSuccess = roll <= 50 // 假设理智值为50，实际应该从角色卡获取

    const sanityLoss = isSuccess ? successLoss : failureLoss
    const result = isSuccess ? '成功' : '失败'

    return { roll, result, sanityLoss }
  }

  // 奖励骰检定
  bonusRoll(skill: number, bonusCount: number): { roll: number, bonusDice: number[], finalRoll: number, result: string } {
    const mainRoll = Random.int(1, 101)
    const tensDigit = Math.floor((mainRoll - 1) / 10) * 10
    const unitsDigit = mainRoll % 10 || 10

    const bonusDice = []
    for (let i = 0; i < bonusCount; i++) {
      bonusDice.push(Random.int(1, 11) - 1) // 0-9
    }

    const bestTens = Math.min(tensDigit, ...bonusDice.map(d => d * 10))
    const finalRoll = bestTens + unitsDigit

    let result = '失败'
    if (finalRoll <= skill / 5) result = '大成功'
    else if (finalRoll <= skill / 2) result = '极难成功'
    else if (finalRoll <= skill) result = '成功'
    else if (finalRoll >= 96) result = '大失败'

    return { roll: mainRoll, bonusDice, finalRoll, result }
  }

  // 惩罚骰检定
  penaltyRoll(skill: number, penaltyCount: number): { roll: number, penaltyDice: number[], finalRoll: number, result: string } {
    const mainRoll = Random.int(1, 101)
    const tensDigit = Math.floor((mainRoll - 1) / 10) * 10
    const unitsDigit = mainRoll % 10 || 10

    const penaltyDice = []
    for (let i = 0; i < penaltyCount; i++) {
      penaltyDice.push(Random.int(1, 11) - 1) // 0-9
    }

    const worstTens = Math.max(tensDigit, ...penaltyDice.map(d => d * 10))
    const finalRoll = worstTens + unitsDigit

    let result = '失败'
    if (finalRoll <= skill / 5) result = '大成功'
    else if (finalRoll <= skill / 2) result = '极难成功'
    else if (finalRoll <= skill) result = '成功'
    else if (finalRoll >= 96) result = '大失败'

    return { roll: mainRoll, penaltyDice, finalRoll, result }
  }

  // 对抗检定
  opposedCheck(skill1: number, skill2: number): { roll1: number, roll2: number, result1: string, result2: string, winner: string } {
    const roll1 = Random.int(1, 101)
    const roll2 = Random.int(1, 101)

    const result1 = this.getSuccessLevel(roll1, skill1)
    const result2 = this.getSuccessLevel(roll2, skill2)

    let winner = '平局'

    // 判断胜负
    const levels = { '大失败': 0, '失败': 1, '成功': 2, '极难成功': 3, '大成功': 4 }
    const level1 = levels[result1]
    const level2 = levels[result2]

    if (level1 > level2) winner = '甲方胜利'
    else if (level2 > level1) winner = '乙方胜利'
    else if (level1 === level2 && level1 > 1) {
      // 同等级成功，比较骰值
      if (roll1 < roll2) winner = '甲方胜利'
      else if (roll2 < roll1) winner = '乙方胜利'
    }

    return { roll1, roll2, result1, result2, winner }
  }

  // 获取成功等级
  private getSuccessLevel(roll: number, skill: number): string {
    if (roll <= skill / 5) return '大成功'
    if (roll <= skill / 2) return '极难成功'
    if (roll <= skill) return '成功'
    if (roll >= 96) return '大失败'
    return '失败'
  }

  // 技能成长检定
  skillGrowth(currentSkill: number): { roll: number, growth: number, newSkill: number, success: boolean } {
    const roll = Random.int(1, 101)
    const success = roll > currentSkill

    let growth = 0
    let newSkill = currentSkill

    if (success) {
      growth = Random.int(1, 11) // 1d10成长
      newSkill = Math.min(currentSkill + growth, 99) // 最大99
    }

    return { roll, growth, newSkill, success }
  }

  // 即时疯狂症状
  getImmediateMadness(): string {
    const symptoms = this.getImmediateMadnessList()
    if (symptoms.length === 0) return '暂无症状数据'
    const index = Random.int(0, symptoms.length)
    return symptoms[index]
  }

  // 总结性疯狂症状
  getSummaryMadness(): string {
    const symptoms = this.getSummaryMadnessList()
    if (symptoms.length === 0) return '暂无症状数据'
    const index = Random.int(0, symptoms.length)
    return symptoms[index]
  }

  // 设置房规
  setHouseRule(ruleId: number): boolean {
    const rules = this.getHouseRules()
    if (ruleId >= 0 && ruleId < rules.length) {
      this.houseRule = ruleId
      return true
    }
    return false
  }

  // 获取当前房规
  getCurrentHouseRule(): any {
    const rules = this.getHouseRules()
    if (this.houseRule >= 0 && this.houseRule < rules.length) {
      return rules[this.houseRule]
    }
    return { id: 0, name: '标准规则', description: '使用标准 COC7 规则' }
  }

  // 获取所有房规
  getAllHouseRules(): any[] {
    return this.getHouseRules()
  }
}
