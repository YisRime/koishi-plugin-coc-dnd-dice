// 角色卡管理类
export class CharacterCard {
  name: string
  attributes: Map<string, number>
  userId: string

  constructor(name: string, userId: string) {
    this.name = name
    this.attributes = new Map()
    this.userId = userId
  }

  // 设置属性值
  setAttribute(attr: string, value: number): void {
    this.attributes.set(attr.toLowerCase(), value)
  }

  // 获取属性值
  getAttribute(attr: string): number | undefined {
    return this.attributes.get(attr.toLowerCase())
  }

  // 获取所有属性
  getAllAttributes(): Map<string, number> {
    return this.attributes
  }

  // 删除属性
  deleteAttribute(attr: string): boolean {
    return this.attributes.delete(attr.toLowerCase())
  }
}

// 角色卡存储管理
export class CharacterManager {
  private cards: Map<string, CharacterCard[]> = new Map()
  private activeCards: Map<string, string> = new Map()

  // 注册角色卡相关命令
  registerCommands(ctx: any) {
    // 角色卡相关命令组
    ctx.command('pc', '角色卡管理')

    // 新建空白角色卡
    ctx.command('pc.new <name>', '新建空白角色卡')
      .example('.pc new 调查员  创建名为"调查员"的角色卡')
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
    ctx.command('pc.list', '列出所有角色卡')
      .example('.pc list  列出当前用户的所有角色卡')
      .action(async ({ session }) => {
        const cards = this.getUserCards(session.userId)
        if (cards.length === 0) {
          return '您还没有角色卡，使用 .pc new <角色名> 创建新的角色卡'
        }

        const activeCardName = this.getActiveCardName(session.userId)
        const cardList = cards.map(card => {
          const isActive = card.name === activeCardName
          return `${isActive ? '★' : '　'}${card.name}${isActive ? ' (已绑定)' : ''}`
        }).join('\n')

        return `您的角色卡列表：\n${cardList}`
      })

    // 绑定角色卡
    ctx.command('pc.tag <name>', '绑定角色卡')
      .example('.pc tag 调查员  绑定名为"调查员"的角色卡')
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
    ctx.command('pc.del <name>', '删除角色卡')
      .example('.pc del 调查员  删除名为"调查员"的角色卡')
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
      .example('.nn 新名字  修改当前角色卡名称')
      .action(async ({ session }, newName) => {
        if (!newName) {
          return '请指定新的角色名称！'
        }

        const activeCardName = this.getActiveCardName(session.userId)
        if (!activeCardName) {
          return '您还没有绑定角色卡！请先使用 .pc new <角色名> 创建或 .pc tag <角色名> 绑定角色卡'
        }

        const success = this.renameCard(session.userId, activeCardName, newName)
        if (!success) {
          return `角色名"${newName}"已存在！`
        }

        return `角色名已修改为"${newName}"`
      })

    // 录入数据
    ctx.command('st <attribute> [value]', '录入或查看角色属性')
      .example('.st 力量 60  设置力量属性为60')
      .example('.st 力量     查看力量属性')
      .action(async ({ session }, attribute, value) => {
        if (!attribute) {
          return '请指定属性名称！'
        }

        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          return '您还没有绑定角色卡！请先使用 .pc new <角色名> 创建或 .pc tag <角色名> 绑定角色卡'
        }

        // 如果没有提供值，则查看属性
        if (value === undefined) {
          const attrValue = activeCard.getAttribute(attribute)
          if (attrValue === undefined) {
            return `角色"${activeCard.name}"的属性"${attribute}"尚未设置`
          }
          return `${activeCard.name}的${attribute}：${attrValue}`
        }

        // 设置属性值
        const numValue = parseInt(value)
        if (isNaN(numValue)) {
          return '属性值必须是数字！'
        }

        if (numValue < 0 || numValue > 100) {
          return '属性值必须在0-100之间！'
        }

        activeCard.setAttribute(attribute, numValue)
        return `已设置${activeCard.name}的${attribute}为${numValue}`
      })

    // 列出数据
    ctx.command('st.show [attribute]', '显示角色属性')
      .example('.st show       显示所有属性')
      .example('.st show 力量  显示力量属性')
      .action(async ({ session }, attribute) => {
        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          return '您还没有绑定角色卡！请先使用 .pc new <角色名> 创建或 .pc tag <角色名> 绑定角色卡'
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
      .example('.sn  显示当前绑定角色的详细信息')
      .action(async ({ session }) => {
        const activeCard = this.getCard(session.userId)
        if (!activeCard) {
          return '您还没有绑定角色卡！请先使用 .pc new <角色名> 创建或 .pc tag <角色名> 绑定角色卡'
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
}
