import * as fs from 'fs'
import * as path from 'path'

let TEMPLATE_DIR: string

// 默认模板数据
const DEFAULT_TEMPLATES = {
  // COC7 技能列表
  coc7_skills: {
    // 基础属性
    '力量': { initial: 0, category: '基础属性' },
    '敏捷': { initial: 0, category: '基础属性' },
    '意志': { initial: 0, category: '基础属性' },
    '体质': { initial: 0, category: '基础属性' },
    '外貌': { initial: 0, category: '基础属性' },
    '智力': { initial: 0, category: '基础属性' },
    '体型': { initial: 0, category: '基础属性' },
    '教育': { initial: 0, category: '基础属性' },
    '幸运': { initial: 0, category: '基础属性' },

    // 技能
    '会计': { initial: 5, category: '技能' },
    '人类学': { initial: 1, category: '技能' },
    '估价': { initial: 5, category: '技能' },
    '考古学': { initial: 1, category: '技能' },
    '魅惑': { initial: 15, category: '技能' },
    '攀爬': { initial: 20, category: '技能' },
    '计算机使用': { initial: 5, category: '技能' },
    '信用评级': { initial: 0, category: '技能' },
    '克苏鲁神话': { initial: 0, category: '技能' },
    '乔装': { initial: 5, category: '技能' },
    '闪避': { initial: 0, category: '技能' },
    '驾驶': { initial: 20, category: '技能' },
    '电气维修': { initial: 10, category: '技能' },
    '电子学': { initial: 1, category: '技能' },
    '话术': { initial: 5, category: '技能' },
    '格斗': { initial: 25, category: '技能' },
    '射击': { initial: 20, category: '技能' },
    '急救': { initial: 30, category: '技能' },
    '历史': { initial: 5, category: '技能' },
    '恐吓': { initial: 15, category: '技能' },
    '跳跃': { initial: 20, category: '技能' },
    '母语': { initial: 0, category: '技能' },
    '法律': { initial: 5, category: '技能' },
    '图书馆使用': { initial: 20, category: '技能' },
    '聆听': { initial: 20, category: '技能' },
    '开锁': { initial: 1, category: '技能' },
    '机械维修': { initial: 10, category: '技能' },
    '医学': { initial: 1, category: '技能' },
    '博物学': { initial: 10, category: '技能' },
    '导航': { initial: 10, category: '技能' },
    '神秘学': { initial: 5, category: '技能' },
    '操作重型机械': { initial: 1, category: '技能' },
    '说服': { initial: 10, category: '技能' },
    '精神分析': { initial: 1, category: '技能' },
    '心理学': { initial: 10, category: '技能' },
    '骑术': { initial: 5, category: '技能' },
    '科学': { initial: 1, category: '技能' },
    '侦查': { initial: 25, category: '技能' },
    '妙手': { initial: 10, category: '技能' },
    '潜行': { initial: 20, category: '技能' },
    '生存': { initial: 10, category: '技能' },
    '游泳': { initial: 20, category: '技能' },
    '投掷': { initial: 20, category: '技能' },
    '追踪': { initial: 10, category: '技能' }
  },

  // COC7 房规
  coc7_house_rules: [
    { id: 0, name: '标准规则', description: '使用标准 COC7 规则' },
    { id: 1, name: '幸运增强', description: '幸运骰可以在任何检定中使用' },
    { id: 2, name: '严格规则', description: '大失败范围扩大到 95-100' },
    { id: 3, name: '快速成长', description: '技能成长更容易' }
  ],

  // COC7 即时疯狂症状
  coc7_immediate_madness: [
    '昏厥或者崩溃 1d10 轮',
    '歇斯底里地大笑或者哭泣 1d10 轮',
    '逃跑，尖叫着远离恐怖源 1d10 轮',
    '身体僵硬，无法行动 1d10 轮',
    '喃喃自语，无法理解的话语 1d10 轮',
    '重复某个动作 1d10 轮',
    '攻击最近的人或物体 1d10 轮',
    '暂时失忆，遗忘最近的事件',
    '进入恍惚状态 1d10 轮',
    '产生幻觉 1d10 轮'
  ],

  // COC7 总结性疯狂症状
  coc7_summary_madness: [
    '健忘症：遗忘与创伤事件相关的记忆',
    '强迫症：必须执行某些重复性行为',
    '偏执狂：认为有人在监视或追踪自己',
    '恐惧症：对特定事物产生极度恐惧',
    '躁郁症：情绪在极度兴奋和沮丧间摆动',
    '分离性身份障碍：发展出多重人格',
    '妄想症：坚信某些不真实的事情',
    '焦虑症：持续的紧张和不安感',
    '抑郁症：持续的悲伤和绝望感',
    '失语症：失去说话或理解语言的能力'
  ],

  // DND5E 种族名字
  dnd5e_names: {
    '人类': {
      male: ['阿登', '布兰登', '卡西乌斯', '达米安', '埃德蒙', '费利克斯', '加雷斯', '亨利', '伊万', '杰克'],
      female: ['阿德拉', '贝蒂娜', '卡罗琳', '戴安娜', '埃莉诺', '菲奥娜', '格蕾丝', '海伦', '伊莎贝拉', '茱莉亚'],
      surname: ['艾德森', '布莱克', '卡特', '戴维斯', '埃文斯', '福特', '格林', '哈里斯', '琼斯', '金']
    },
    '精灵': {
      male: ['阿拉斯托', '贝雷里斯', '卡伦', '德拉玛', '埃尔维', '费拉斯', '加拉埃尔', '海达雷克', '伊夫洛伊', '拉米尔'],
      female: ['阿达拉', '比安卡', '卡兰德拉', '德希拉', '埃菲', '法拉斯塔', '吉尔拉恩', '海拉尼', '伊莉娅', '莉亚尔'],
      surname: ['安玛基尔', '布克曼特尔', '埃伦尼昂', '花冠', '海拉达德', '霍恩布雷德', '雷伯瑟林', '月语者', '玫瑰花', '星风']
    },
    '矮人': {
      male: ['阿达尔', '巴林', '达因', '埃伯克', '法林', '甘道尔', '哈林', '基利', '纳利', '奥里'],
      female: ['阿伯', '巴德拉', '迪莎', '格甘娜', '古恩洛达', '赫尔达', '伊拉', '克里斯特拉', '莉芙德', '里斯沃恩'],
      surname: ['战锤', '铁铸', '石拳', '金须', '钢心', '火炉', '斧刃', '盾墙', '岩石', '钢铁']
    },
    '半身人': {
      male: ['阿尔顿', '比尔博', '克洛多', '德拉戈', '埃尔多', '费雷格', '加哥', '霍比', '伊索', '杰洛'],
      female: ['安德拉', '布洛桑', '卡兰德拉', '德拉', '埃斯梅', '福拉', '莉莉', '梅里', '纳拉', '萝丝'],
      surname: ['巴金斯', '布兰迪巴克', '图克', '萨克维尔', '绿山', '善木', '底洞', '茶壶', '蒲公英', '樱草']
    },
    '龙裔': {
      male: ['阿克汗', '巴拉萨尔', '达克斯', '埃拉德汗', '法纳克斯', '加拉格尔', '海斯坦', '克朗', '梅德拉什', '纳达拉'],
      female: ['阿卡迪', '比莉', '达拉', '芬妮', '哈维拉', '杰汉娜', '卡瓦', '科拉', '米希安', '娜拉'],
      surname: ['赤焰', '金心', '铁鳞', '蓝爪', '绿翼', '银须', '白牙', '暗影', '雷鸣', '冰霜']
    },
    '提夫林': {
      male: ['阿雷纳', '布伦登', '卡里克', '达米奥斯', '埃卡蒙', '弗拉维乌斯', '高修斯', '海里什', '伊阿古', '卡尔塔斯'],
      female: ['阿基拉', '布利斯', '卡利亚', '达玛拉', '埃瑞雅', '菲亚', '古拉', '海萨', '伊娅', '莉莉丝'],
      surname: ['绯红', '暗焰', '苦痛', '烈火', '地狱', '黑暗', '恶魔', '深渊', '恐惧', '诅咒']
    }
  },

  // 成功等级文本
  success_levels: {
    '大成功': '大成功',
    '极难成功': '极难成功',
    '成功': '成功',
    '失败': '失败',
    '大失败': '大失败'
  },

  // 系统文本
  system_messages: {
    dice_format_error: '骰子表达式格式错误！请使用如 d20、3d6 等格式',
    dice_count_limit: '骰子数量超过限制（最大100个）',
    dice_size_limit: '骰子面数超过限制（最大1000面）',
    skill_name_required: '请指定技能名称！',
    target_value_range: '目标值必须在1-100之间！',
    no_character_card: '您还没有绑定角色卡！请先使用 .pc new <角色名> 创建或 .pc tag <角色名> 绑定角色卡',
    attribute_not_set: '属性尚未设置',
    attribute_must_be_number: '属性值必须是数字！',
    attribute_range: '属性值必须在0-100之间！'
  },

  // 常用检定结果文本
  check_results: {
    format: '{player} 进行{skill}检定：d100={roll}/{target} {result}',
    format_proxy: '{player} 代替 {target} 进行{skill}检定：d100={roll}/{targetValue} {result}'
  },

  // COC7 职业模板
  coc7_occupations: {
    '会计师': {
      skills: ['会计', '法律', '图书馆使用', '说服', '心理学'],
      credit_rating: [30, 70],
      description: '处理财务和会计工作的专业人士'
    },
    '古董商': {
      skills: ['估价', '历史', '图书馆使用', '神秘学', '侦查'],
      credit_rating: [30, 70],
      description: '收集和销售古董的商人'
    },
    '艺术家': {
      skills: ['艺术技能', '历史', '母语', '神秘学', '侦查'],
      credit_rating: [9, 50],
      description: '从事艺术创作的人'
    },
    '作家': {
      skills: ['艺术(文学)', '历史', '图书馆使用', '母语', '心理学'],
      credit_rating: [9, 30],
      description: '从事文学创作的人'
    },
    '调查员': {
      skills: ['艺术(摄影)', '法律', '图书馆使用', '心理学', '侦查'],
      credit_rating: [20, 45],
      description: '专业的私人或警务调查人员'
    },
    '医生': {
      skills: ['急救', '外语', '拉丁语', '医学', '心理学', '科学(生物学)', '科学(药学)'],
      credit_rating: [30, 80],
      description: '医疗专业人员'
    },
    '律师': {
      skills: ['会计', '法律', '图书馆使用', '聆听', '说服', '心理学'],
      credit_rating: [30, 80],
      description: '法律专业人员'
    },
    '警察': {
      skills: ['射击', '法律', '聆听', '心理学', '侦查', '妙手'],
      credit_rating: [20, 50],
      description: '执法人员'
    },
    '记者': {
      skills: ['艺术(摄影)', '历史', '图书馆使用', '母语', '心理学', '说服'],
      credit_rating: [9, 30],
      description: '新闻工作者'
    },
    '学者': {
      skills: ['图书馆使用', '母语', '外语', '心理学', '科学'],
      credit_rating: [20, 60],
      description: '学术研究人员'
    }
  },

  // 装备模板
  coc7_equipment: {
    '武器': {
      '左轮手枪': { damage: '1d10', range: 15, attack: 20, malfunction: 100 },
      '自动手枪': { damage: '1d10', range: 15, attack: 20, malfunction: 100 },
      '霰弹枪': { damage: '4d6/2d6/1d6', range: 50, attack: 30, malfunction: 100 },
      '步枪': { damage: '2d6+4', range: 110, attack: 25, malfunction: 100 },
      '小刀': { damage: '1d4+2', range: 'touch', attack: 25, malfunction: 0 },
      '棒球棍': { damage: '1d8+1', range: 'touch', attack: 25, malfunction: 0 },
      '斧头': { damage: '1d8+2', range: 'touch', attack: 15, malfunction: 0 },
      '链锯': { damage: '2d8', range: 'touch', attack: 10, malfunction: 95 }
    },
    '防具': {
      '重型外套': { armor: 1, penalty: 0 },
      '皮夹克': { armor: 1, penalty: 0 },
      '防弹背心': { armor: 5, penalty: -2 },
      '厚衣服': { armor: 1, penalty: 0 },
      '摩托车装备': { armor: 3, penalty: -1 }
    },
    '装备': {
      '手电筒': { description: '提供照明', weight: 1 },
      '绳索(50英尺)': { description: '攀爬工具', weight: 5 },
      '背包': { description: '携带物品', weight: 2 },
      '急救包': { description: '进行急救', weight: 2 },
      '相机': { description: '拍摄照片', weight: 3 },
      '录音设备': { description: '录制声音', weight: 1 }
    }
  },

  // DND5E 职业模板
  dnd5e_classes: {
    '战士': {
      hit_die: 'd10',
      primary_ability: ['力量', '敏捷'],
      save_proficiencies: ['力量', '体质'],
      skill_choices: 2,
      skill_list: ['运动', '威吓', '历史', '洞察', '感知', '生存'],
      equipment: ['链甲', '盾牌', '武器'],
      description: '精通武器和护甲的战斗专家'
    },
    '法师': {
      hit_die: 'd6',
      primary_ability: ['智力'],
      save_proficiencies: ['智力', '感知'],
      skill_choices: 2,
      skill_list: ['奥秘', '历史', '洞察', '调查', '医学', '宗教'],
      equipment: ['法杖', '法术书', '学者背包'],
      description: '通过学习和准备来施展法术的法术使用者'
    },
    '盗贼': {
      hit_die: 'd8',
      primary_ability: ['敏捷'],
      save_proficiencies: ['敏捷', '智力'],
      skill_choices: 4,
      skill_list: ['运动', '欺骗', '洞察', '威吓', '调查', '感知', '表演', '说服', '巧手', '隐匿'],
      equipment: ['皮甲', '短剑', '盗贼工具'],
      description: '精通潜行和技巧的专家'
    },
    '牧师': {
      hit_die: 'd8',
      primary_ability: ['感知'],
      save_proficiencies: ['感知', '魅力'],
      skill_choices: 2,
      skill_list: ['历史', '洞察', '医学', '说服', '宗教'],
      equipment: ['链甲', '盾牌', '圣徽'],
      description: '为神明服务并施展神术的虔诚信徒'
    }
  }
}

export class Template {
  private static loadedTemplates: Map<string, any> = new Map()

  // 初始化模板目录
  static init(dataDir: string) {
    TEMPLATE_DIR = path.join(dataDir, 'templates')
    this.ensureTemplateDir()
    this.exportDefaultTemplates()
  }

  static ensureTemplateDir() {
    if (!fs.existsSync(TEMPLATE_DIR)) {
      fs.mkdirSync(TEMPLATE_DIR, { recursive: true })
    }
  }

  // 导出默认模板为单个文件
  static exportDefaultTemplates() {
    for (const [name, content] of Object.entries(DEFAULT_TEMPLATES)) {
      const filePath = path.join(TEMPLATE_DIR, `${name}.json`)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8')
      }
    }
  }

  // 保存模板到文件
  static saveTemplate(name: string, content: any) {
    this.ensureTemplateDir()
    const filePath = path.join(TEMPLATE_DIR, `${name}.json`)
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8')
  }

  // 加载模板文件
  static loadTemplate(name: string): any | null {
    // 先尝试从缓存读取
    if (this.loadedTemplates.has(name)) {
      return this.loadedTemplates.get(name)
    }

    // 尝试从文件读取
    const filePath = path.join(TEMPLATE_DIR, `${name}.json`)
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf-8')
        const content = JSON.parse(data)
        this.loadedTemplates.set(name, content)
        return content
      } catch (error) {
        console.error(`读取模板文件 ${name} 失败:`, error)
        return null
      }
    }

    // 尝试从默认模板读取
    if (DEFAULT_TEMPLATES[name]) {
      const content = DEFAULT_TEMPLATES[name]
      this.loadedTemplates.set(name, content)
      return content
    }

    return null
  }

  // 获取模板内容，支持路径访问
  static getTemplate(name: string, path?: string): any {
    const template = this.loadTemplate(name)
    if (!template) return null

    if (!path) return template

    // 支持点号路径访问，如 "coc7_skills.力量"
    const keys = path.split('.')
    let current = template
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return null
      }
    }
    return current
  }

  // 列出所有模板
  static listTemplates(): string[] {
    this.ensureTemplateDir()
    const fileTemplates = fs.readdirSync(TEMPLATE_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))

    const defaultTemplateNames = Object.keys(DEFAULT_TEMPLATES)

    // 合并去重
    return [...new Set([...fileTemplates, ...defaultTemplateNames])]
  }

  // 检查模板是否存在
  static hasTemplate(name: string): boolean {
    if (DEFAULT_TEMPLATES[name]) return true

    const filePath = path.join(TEMPLATE_DIR, `${name}.json`)
    return fs.existsSync(filePath)
  }

  // 清除所有缓存
  static clearCache() {
    this.loadedTemplates.clear()
  }

  // 获取模板信息
  static getTemplateInfo(name: string): { name: string, source: 'default' | 'file' | 'none', size?: number } {
    if (DEFAULT_TEMPLATES[name]) {
      return { name, source: 'default' }
    }

    const filePath = path.join(TEMPLATE_DIR, `${name}.json`)
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      return { name, source: 'file', size: stats.size }
    }

    return { name, source: 'none' }
  }

  // 注册简化的模板管理命令
  static registerCommands(ctx: any) {
    // 模板管理命令组
    const template = ctx.command('template', '模板管理')

    // 列出所有模板
    template.subcommand('.list', '列出所有模板')
      .example('template.list  列出所有可用模板')
      .action(async ({ session }) => {
        const templates = this.listTemplates()
        if (templates.length === 0) {
          return '没有可用的模板'
        }

        const templateInfo = templates.map(name => {
          const info = this.getTemplateInfo(name)
          const sourceText = info.source === 'default' ? '默认' : '文件'
          const sizeText = info.size ? ` (${Math.round(info.size / 1024)}KB)` : ''
          return `${name} [${sourceText}]${sizeText}`
        }).join('\n')

        return `可用模板：\n${templateInfo}`
      })

    // 查看模板内容
    template.subcommand('.show <name> [path]', '查看模板内容')
      .example('template.show coc7_skills          查看COC7技能模板')
      .example('template.show coc7_skills.力量     查看力量技能详情')
      .action(async ({ session }, name, path) => {
        if (!name) {
          return '请指定模板名称！'
        }

        const content = this.getTemplate(name, path)
        if (content === null) {
          return `模板"${name}"不存在或路径"${path}"无效！`
        }

        if (typeof content === 'object') {
          return `模板"${name}"${path ? `/${path}` : ''}内容：\n${JSON.stringify(content, null, 2)}`
        } else {
          return `模板"${name}"${path ? `/${path}` : ''}内容：${content}`
        }
      })

    // 加载模板文件
    template.subcommand('.load <fileName>', '加载指定的模板文件')
      .example('template.load my_coc7_skills.json  加载自定义技能模板')
      .action(async ({ session }, fileName) => {
        if (!fileName) {
          return '请指定要加载的文件名！'
        }

        const filePath = path.join(TEMPLATE_DIR, fileName.endsWith('.json') ? fileName : `${fileName}.json`)

        if (!fs.existsSync(filePath)) {
          return `文件"${fileName}"不存在！`
        }

        try {
          const data = fs.readFileSync(filePath, 'utf-8')
          const content = JSON.parse(data)
          const templateName = fileName.replace(/\.json$/, '')
          this.loadedTemplates.set(templateName, content)
          return `成功加载模板文件"${fileName}"`
        } catch (error) {
          return `加载模板文件失败：${error.message}`
        }
      })

    // 导出默认模板
    template.subcommand('.export', '导出所有默认模板到文件')
      .example('template.export  导出默认模板')
      .action(async ({ session }) => {
        try {
          this.exportDefaultTemplates()
          return '成功导出所有默认模板到文件'
        } catch (error) {
          return '导出模板失败！'
        }
      })

    // 重载模板缓存
    template.subcommand('.reload', '重载模板缓存')
      .example('template.reload  清除缓存并重新加载模板')
      .action(async ({ session }) => {
        this.clearCache()
        return '模板缓存已清除，将重新加载模板'
      })
  }
}

// 初始化时自动导出默认模板（如果不存在）
Template.ensureTemplateDir = Template.ensureTemplateDir.bind(Template)
Template.exportDefaultTemplates = Template.exportDefaultTemplates.bind(Template)
