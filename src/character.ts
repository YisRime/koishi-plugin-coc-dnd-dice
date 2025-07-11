import { Template } from './template'

// 角色卡管理类
export class CharacterCard {
  name: string
  attributes: Map<string, number>
  userId: string
  gameSystem: string // 游戏系统：COC7, DND5E等

  constructor(name: string, userId: string, gameSystem: string = 'COC7') {
    this.name = name
    this.attributes = new Map()
    this.userId = userId
    this.gameSystem = gameSystem
  }

  // 设置属性值
  setAttribute(attr: string, value: number): void {
    this.attributes.set(attr.toLowerCase(), value)
  }

  // 获取属性值
  getAttribute(attr: string): number | undefined {
    return this.attributes.get(attr.toLowerCase())
  }

  // 获取技能值（如果没有设置，使用模板初始值）
  getSkillValue(skill: string): number {
    const current = this.getAttribute(skill)
    if (current !== undefined) return current

    // 从模板获取初始值
    const skillsTemplate = Template.getTemplate('coc7_skills')
    if (skillsTemplate && skillsTemplate[skill]) {
      return skillsTemplate[skill].initial || 0
    }

    return 0
  }

  // 获取所有属性
  getAllAttributes(): Map<string, number> {
    return this.attributes
  }

  // 删除属性
  deleteAttribute(attr: string): boolean {
    return this.attributes.delete(attr.toLowerCase())
  }

  // 设置游戏系统
  setGameSystem(system: string): void {
    this.gameSystem = system
  }

  // 获取游戏系统
  getGameSystem(): string {
    return this.gameSystem
  }

  // 从职业模板设置技能
  applyOccupation(occupationName: string): boolean {
    const occupations = Template.getTemplate('coc7_occupations')
    if (!occupations || !occupations[occupationName]) {
      return false
    }

    const occupation = occupations[occupationName]
    const skills = Template.getTemplate('coc7_skills')

    // 设置职业技能为初始值
    for (const skillName of occupation.skills) {
      if (skills && skills[skillName]) {
        this.setAttribute(skillName, skills[skillName].initial)
      }
    }

    return true
  }

  // 批量设置属性
  setAttributes(attributes: Record<string, number>): void {
    for (const [attr, value] of Object.entries(attributes)) {
      this.setAttribute(attr, value)
    }
  }
}

// 角色卡存储管理
export class CharacterManager {
  private cards: Map<string, CharacterCard[]> = new Map()
  private activeCards: Map<string, string> = new Map()

  // 注册角色卡相关命令
  registerCommands(ctx: any) {
    // 角色卡相关命令组
    const pc = ctx.command('pc', '角色卡管理')

    // 新建空白角色卡
    pc.subcommand('.new <name>', '新建空白角色卡')
      .example('pc.new 调查员  创建名为"调查员"的角色卡')
      .action(async ({ session }, name) => {
        if (!name) {
          return '请指定角色名称！'
        }

        const success = this.createCard(session.userId, name)
        if (!success) {
          return `角色卡"${name}"已存在！`
        }

        return `成功创建角色卡"${name}"并已自动绑定`
      })

    // 列出角色卡
    pc.subcommand('.list', '列出所有角色卡')
      .example('pc.list  列出当前用户的所有角色卡')
      .action(async ({ session }) => {
        const cards = this.getUserCards(session.userId)
        if (cards.length === 0) {
          return '您还没有角色卡，使用 pc.new <角色名> 创建新的角色卡'
        }

        const activeCardName = this.getActiveCardName(session.userId)
        const cardList = cards.map(card => {
          const isActive = card.name === activeCardName
          return `${isActive ? '★' : '　'}${card.name}${isActive ? ' (已绑定)' : ''}`
        }).join('\n')

        return `您的角色卡列表：\n${cardList}`
      })

    // 绑定角色卡
    pc.subcommand('.tag <name>', '绑定角色卡')
      .example('pc.tag 调查员  绑定名为"调查员"的角色卡')
      .action(async ({ session }, name) => {
        if (!name) {
          return '请指定要绑定的角色卡名称！'
        }

        const success = this.tagCard(session.userId, name)
        if (!success) {
          return `角色卡"${name}"不存在！`
        }

        return `已绑定角色卡"${name}"`
      })

    // 删除角色卡
    pc.subcommand('.del <name>', '删除角色卡')
      .example('pc.del 调查员  删除名为"调查员"的角色卡')
      .action(async ({ session }, name) => {
        if (!name) {
          return '请指定要删除的角色卡名称！'
        }

        const success = this.deleteCard(session.userId, name)
        if (!success) {
          return `角色卡"${name}"不存在！`
        }

        return `已删除角色卡"${name}"`
      })

    // 修改角色名
    ctx.command('nn <newName>', '修改当前绑定角色卡的名称')
      .example('nn 新名字  修改当前角色卡名称')
      .action(async ({ session }, newName) => {
        if (!newName) {
          return '请指定新的角色名称！'
        }

        const activeCardName = this.getActiveCardName(session.userId)
        if (!activeCardName) {
          const msg = Template.getTemplate('system_messages', 'no_character_card') || '您还没有绑定角色卡！请先使用 pc.new <角色名> 创建或 pc.tag <角色名> 绑定角色卡'
          return msg
        }

        const success = this.renameCard(session.userId, activeCardName, newName)
        if (!success) {
          return `角色名"${newName}"已存在！`
        }

        return `角色名已修改为"${newName}"`
      })

    // 录入数据
    const st = ctx.command('st <attribute> [value]', '录入或查看角色属性')
      .example('st 力量 60  设置力量属性为60')
      .example('st 力量     查看力量属性')
      .action(async ({ session }, attribute, value) => {
        if (!attribute) {
          return '请指定属性名称！'
        }

        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          const msg = Template.getTemplate('system_messages', 'no_character_card') || '您还没有绑定角色卡！请先使用 pc.new <角色名> 创建或 pc.tag <角色名> 绑定角色卡'
          return msg
        }

        // 如果没有提供值，则查看属性
        if (value === undefined) {
          const attrValue = activeCard.getAttribute(attribute)
          if (attrValue === undefined) {
            const msg = Template.getTemplate('system_messages', 'attribute_not_set') || '属性尚未设置'
            return `角色"${activeCard.name}"的属性"${attribute}"${msg}`
          }
          return `${activeCard.name}的${attribute}：${attrValue}`
        }

        // 设置属性值
        const numValue = parseInt(value)
        if (isNaN(numValue)) {
          const msg = Template.getTemplate('system_messages', 'attribute_must_be_number') || '属性值必须是数字！'
          return msg
        }

        if (numValue < 0 || numValue > 100) {
          const msg = Template.getTemplate('system_messages', 'attribute_range') || '属性值必须在0-100之间！'
          return msg
        }

        activeCard.setAttribute(attribute, numValue)
        return `已设置${activeCard.name}的${attribute}为${numValue}`
      })

    // 列出数据
    st.subcommand('.show [attribute]', '显示角色属性')
      .example('st.show       显示所有属性')
      .example('st.show 力量  显示力量属性')
      .action(async ({ session }, attribute) => {
        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          return '您还没有绑定角色卡！请先使用 pc.new <角色名> 创建或 pc.tag <角色名> 绑定角色卡'
        }

        // 如果指定了属性，只显示该属性
        if (attribute) {
          const attrValue = activeCard.getAttribute(attribute)
          if (attrValue === undefined) {
            return `角色"${activeCard.name}"的属性"${attribute}"尚未设置`
          }
          return `${activeCard.name}的${attribute}：${attrValue}`
        }

        // 显示所有属性
        const allAttributes = activeCard.getAllAttributes()
        if (allAttributes.size === 0) {
          return `角色"${activeCard.name}"还没有设置任何属性`
        }

        const attrList = Array.from(allAttributes.entries())
          .map(([attr, value]) => `${attr}：${value}`)
          .join('\n')

        return `角色"${activeCard.name}"的属性：\n${attrList}`
      })

    // 自动名片功能
    ctx.command('sn', '显示当前角色的名片信息')
      .example('sn  显示当前绑定角色的详细信息')
      .action(async ({ session }) => {
        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          const msg = Template.getTemplate('system_messages', 'no_character_card') || '您还没有绑定角色卡！请先使用 pc.new <角色名> 创建或 pc.tag <角色名> 绑定角色卡'
          return msg
        }

        const allAttributes = activeCard.getAllAttributes()
        if (allAttributes.size === 0) {
          return `角色：${activeCard.name}\n暂无属性数据`
        }

        // 常用属性排序
        const commonAttrs = ['力量', '敏捷', '意志', '体质', '外貌', '智力', '体型', '教育', '幸运']
        const attrEntries = Array.from(allAttributes.entries())

        // 先显示常用属性
        const commonAttrList = commonAttrs
          .filter(attr => allAttributes.has(attr.toLowerCase()))
          .map(attr => `${attr}：${allAttributes.get(attr.toLowerCase())}`)

        // 再显示其他属性
        const otherAttrList = attrEntries
          .filter(([attr]) => !commonAttrs.some(common => common.toLowerCase() === attr))
          .map(([attr, value]) => `${attr}：${value}`)

        const allAttrList = [...commonAttrList, ...otherAttrList].join('\n')

        return `━━━━━━━━━━━━━━━━━━━━
角色：${activeCard.name}
━━━━━━━━━━━━━━━━━━━━
${allAttrList}
━━━━━━━━━━━━━━━━━━━━`
      })

    // 角色检定命令
    ctx.command('ra <skill>', '使用角色卡进行技能检定')
      .example('ra 侦查  使用角色卡的侦查技能进行检定')
      .action(async ({ session }, skill) => {
        if (!skill) {
          const msg = Template.getTemplate('system_messages', 'skill_name_required') || '请指定技能名称！'
          return msg
        }

        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          const msg = Template.getTemplate('system_messages', 'no_character_card') || '您还没有绑定角色卡！请先使用 pc.new <角色名> 创建或 pc.tag <角色名> 绑定角色卡'
          return msg
        }

        const skillValue = activeCard.getSkillValue(skill)
        if (skillValue === 0) {
          return `角色"${activeCard.name}"还没有设置${skill}技能值！使用 st ${skill} <值> 设置技能值`
        }

        // 进行d100检定
        const roll = this.rollDice(1, 100)
        const rollValue = roll.total
        const successLevel = this.getSuccessLevel(rollValue, skillValue)

        const format = Template.getTemplate('check_results', 'format') || '{player} 进行{skill}检定：d100={roll}/{target} {result}'
        return format
          .replace('{player}', activeCard.name)
          .replace('{skill}', skill)
          .replace('{roll}', rollValue.toString())
          .replace('{target}', skillValue.toString())
          .replace('{result}', successLevel)
      })

    // 技能初始化命令
    ctx.command('st.init [occupation]', '初始化角色技能值')
      .example('st.init         根据COC7技能模板初始化所有技能')
      .example('st.init 调查员  根据调查员职业模板初始化技能')
      .action(async ({ session }, occupation) => {
        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          const msg = Template.getTemplate('system_messages', 'no_character_card') || '您还没有绑定角色卡！请先使用 pc.new <角色名> 创建或 pc.tag <角色名> 绑定角色卡'
          return msg
        }

        if (occupation) {
          // 应用职业模板
          const success = activeCard.applyOccupation(occupation)
          if (success) {
            return `已为角色"${activeCard.name}"应用职业"${occupation}"的技能模板`
          } else {
            const occupations = Template.getTemplate('coc7_occupations')
            const availableOccupations = occupations ? Object.keys(occupations).join('、') : '无'
            return `职业"${occupation}"不存在！可用职业：${availableOccupations}`
          }
        } else {
          // 初始化所有基础技能
          const skills = Template.getTemplate('coc7_skills')
          if (!skills) {
            return '技能模板不存在！'
          }

          let count = 0
          for (const [skillName, skillData] of Object.entries(skills)) {
            if (!activeCard.getAttribute(skillName)) {
              const initial = (skillData as any).initial || 0
              activeCard.setAttribute(skillName, initial)
              count++
            }
          }

          return `已为角色"${activeCard.name}"初始化了${count}个技能`
        }
      })

    // 技能列表命令
    ctx.command('st.skills [category]', '显示技能列表')
      .example('st.skills           显示所有技能')
      .example('st.skills 基础属性  显示基础属性技能')
      .action(async ({ session }, category) => {
        const skills = Template.getTemplate('coc7_skills')
        if (!skills) {
          return '技能模板不存在！'
        }

        let filteredSkills = Object.entries(skills)
        if (category) {
          filteredSkills = filteredSkills.filter(([_, skillData]) => (skillData as any).category === category)
        }

        if (filteredSkills.length === 0) {
          return category ? `类别"${category}"中没有技能` : '没有可用技能'
        }

        const skillList = filteredSkills.map(([skillName, skillData]) =>
          `${skillName}：${(skillData as any).initial} (${(skillData as any).category})`
        ).join('\n')

        const title = category ? `${category}技能列表` : '所有技能列表'
        return `${title}：\n${skillList}`
      })

    // 职业列表命令
    ctx.command('st.occupations', '显示COC7职业列表')
      .example('st.occupations  显示所有可用职业')
      .action(async ({ session }) => {
        const occupations = Template.getTemplate('coc7_occupations')
        if (!occupations) {
          return '职业模板不存在！'
        }

        const occupationList = Object.entries(occupations).map(([name, data]) =>
          `${name}：${(data as any).description}\n  职业技能：${(data as any).skills.join('、')}\n  信用评级：${(data as any).credit_rating[0]}-${(data as any).credit_rating[1]}`
        ).join('\n\n')

        return `COC7职业列表：\n${occupationList}`
      })

    // 装备查询命令
    ctx.command('st.equipment [category]', '显示装备列表')
      .example('st.equipment        显示所有装备')
      .example('st.equipment 武器   显示武器装备')
      .action(async ({ session }, category) => {
        const equipment = Template.getTemplate('coc7_equipment')
        if (!equipment) {
          return '装备模板不存在！'
        }

        if (category) {
          if (!equipment[category]) {
            const categories = Object.keys(equipment).join('、')
            return `装备类别"${category}"不存在！可用类别：${categories}`
          }

          const items = Object.entries(equipment[category]).map(([name, data]) => {
            if (typeof data === 'object' && data !== null) {
              const details = Object.entries(data).map(([key, value]) => `${key}:${value}`).join(' ')
              return `${name} - ${details}`
            }
            return name
          }).join('\n')

          return `${category}装备列表：\n${items}`
        } else {
          const allCategories = Object.keys(equipment).map(cat =>
            `${cat}：${Object.keys(equipment[cat]).length}种`
          ).join('\n')

          return `装备类别：\n${allCategories}\n\n使用 st.equipment <类别> 查看具体装备`
        }
      })

    // ...existing code...
  }

  // 创建新角色卡
  createCard(userId: string, name: string): boolean {
    if (!this.cards.has(userId)) {
      this.cards.set(userId, [])
    }

    const userCards = this.cards.get(userId)!

    // 检查是否已存在同名角色卡
    if (userCards.some(card => card.name === name)) {
      return false
    }

    const newCard = new CharacterCard(name, userId)
    userCards.push(newCard)

    // 如果是第一张卡，自动绑定
    if (userCards.length === 1) {
      this.activeCards.set(userId, name)
    }

    return true
  }

  // 删除角色卡
  deleteCard(userId: string, name: string): boolean {
    const userCards = this.cards.get(userId)
    if (!userCards) return false

    const index = userCards.findIndex(card => card.name === name)
    if (index === -1) return false

    userCards.splice(index, 1)

    // 如果删除的是当前绑定的卡，清除绑定
    if (this.activeCards.get(userId) === name) {
      this.activeCards.delete(userId)
      // 如果还有其他卡，自动绑定到第一张
      if (userCards.length > 0) {
        this.activeCards.set(userId, userCards[0].name)
      }
    }

    return true
  }

  // 获取用户的角色卡
  getCard(userId: string, name?: string): CharacterCard | undefined {
    const userCards = this.cards.get(userId)
    if (!userCards) return undefined

    if (name) {
      return userCards.find(card => card.name === name)
    }

    // 如果没有指定名字，返回当前绑定的卡
    const activeName = this.activeCards.get(userId)
    if (activeName) {
      return userCards.find(card => card.name === activeName)
    }

    return undefined
  }

  // 获取用户所有角色卡
  getUserCards(userId: string): CharacterCard[] {
    return this.cards.get(userId) || []
  }

  // 绑定角色卡
  tagCard(userId: string, name: string): boolean {
    const userCards = this.cards.get(userId)
    if (!userCards) return false

    const card = userCards.find(card => card.name === name)
    if (!card) return false

    this.activeCards.set(userId, name)
    return true
  }

  // 获取当前绑定的角色卡名
  getActiveCardName(userId: string): string | undefined {
    return this.activeCards.get(userId)
  }

  // 重命名角色卡
  renameCard(userId: string, oldName: string, newName: string): boolean {
    const userCards = this.cards.get(userId)
    if (!userCards) return false

    // 检查新名字是否已存在
    if (userCards.some(card => card.name === newName)) {
      return false
    }

    const card = userCards.find(card => card.name === oldName)
    if (!card) return false

    card.name = newName

    // 更新绑定信息
    if (this.activeCards.get(userId) === oldName) {
      this.activeCards.set(userId, newName)
    }

    return true
  }

  // 掷骰函数
  private rollDice(count: number, size: number): { results: number[], total: number } {
    const results: number[] = []
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * size) + 1)
    }
    return { results, total: results.reduce((sum, val) => sum + val, 0) }
  }

  // 检定成功度计算
  private getSuccessLevel(result: number, target: number): string {
    const levels = Template.getTemplate('success_levels')
    if (!levels) {
      // 后备默认值
      if (result <= target / 5) return '大成功'
      if (result <= target / 2) return '极难成功'
      if (result <= target) return '成功'
      if (result >= 96) return '大失败'
      return '失败'
    }

    if (result <= target / 5) return levels['大成功']
    if (result <= target / 2) return levels['极难成功']
    if (result <= target) return levels['成功']
    if (result >= 96) return levels['大失败']
    return levels['失败']
  }
}
