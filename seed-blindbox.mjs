/**
 * 批量生成 2000 份灵感盲盒样本并写入数据库
 * 运行: node seed-blindbox.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { blindboxItems } from "./drizzle/schema";

// ─── 图片池（Picsum Photos 公开图床）────────────────────────────────────────
const img = (seed, w = 800, h = 500) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

const CASE_IMAGES = Array.from({ length: 300 }, (_, i) => img(`design${i + 1}`));
const KNOWLEDGE_IMAGES = Array.from({ length: 300 }, (_, i) => img(`know${i + 1}`));
const TIP_IMAGES = Array.from({ length: 300 }, (_, i) => img(`tip${i + 1}`));
const QUOTE_IMAGES = Array.from({ length: 300 }, (_, i) => img(`quote${i + 1}`));

// ─── 优秀案例标题池 ──────────────────────────────────────────────────────────
const CASE_TITLES = [
  "Airbnb 搜索页重设计：从混乱到清晰", "Spotify 播放器的情感化设计解析",
  "Notion 编辑器的极简主义哲学", "Figma 协作功能的交互设计拆解",
  "Apple Music 动态歌词的视觉创新", "Google Maps 导航界面可用性优化",
  "Slack 消息架构重设计案例", "Duolingo 游戏化学习界面分析",
  "Linear 项目管理工具的设计语言", "Stripe 支付流程的信任感设计",
  "Vercel 部署面板的开发者体验", "Arc 浏览器的空间化界面探索",
  "Raycast 命令面板的效率设计", "Framer 动效编辑器的创新交互",
  "Loom 视频录制的简化流程设计", "Miro 白板协作的无限画布设计",
  "Canva 模板系统的民主化设计", "Superhuman 邮件客户端的速度优先",
  "Craft 文档工具的美学与功能平衡", "Bear 笔记应用的排版设计哲学",
  "Things 3 任务管理的清单美学", "Fantastical 日历的信息密度设计",
  "Pitch 演示工具的协作设计", "Rive 动效工具的实时预览设计",
  "Spline 3D 设计工具的界面创新", "Pinterest 瀑布流的视觉探索设计",
  "Instagram 故事功能的全屏设计", "TikTok 竖屏视频的沉浸式体验",
  "Discord 服务器的频道架构设计", "Telegram 频道的内容发布设计",
  "Material Design 3 动态色彩系统", "Apple HIG 2024 年度更新解析",
  "Microsoft Fluent Design 流畅设计语言", "IBM Carbon 企业级设计系统",
  "Shopify Polaris 电商设计系统", "Ant Design 5.0 设计升级解析",
  "shadcn/ui 组件库的设计决策", "Tesla 车载界面的极简设计",
  "Robinhood 股票交易的民主化设计", "Coinbase 加密货币的信任感设计",
  "Revolut 数字银行的现代金融设计", "Monzo 英国挑战者银行的色彩设计",
  "Wise 国际转账的透明度设计", "Square 商家收款的简化设计",
  "Venmo 社交支付的动态设计", "Shopify 商家后台的电商设计",
  "Squarespace 网站建设的美学设计", "Ghost 博客平台的写作体验",
  "Medium 长文阅读的排版设计", "Substack 订阅通讯的简洁设计",
  "Mailchimp 邮件营销的品牌设计", "Jira Software 敏捷开发的看板设计",
  "Trello 可视化任务的卡片设计", "Asana 项目管理的时间线设计",
  "Monday.com 工作操作系统的设计", "ClickUp 全能工作平台的设计",
  "Airtable 数据库式项目管理设计", "Roam Research 双向链接知识设计",
  "Obsidian 本地知识图谱的设计", "Heptabase 视觉知识管理的设计",
  "GitHub 代码协作的开发者设计", "VS Code 代码编辑器的扩展设计",
  "Postman API 测试的开发者设计", "TablePlus 数据库管理的现代设计",
  "Figma Community 最受欢迎模板分析", "Dribbble 年度最佳 UI 设计趋势",
  "Awwwards 获奖网站的设计解析", "Waymo 自动驾驶的乘客体验设计",
  "Uber 乘车体验的端到端设计", "Grab 东南亚超级应用设计",
  "Klarna 先买后付的购物设计", "Webflow 可视化编程的设计思维",
  "Figma Variables 功能的设计系统革命", "Maze 用户测试平台的数据可视化",
  "Hotjar 热力图工具的洞察设计", "Amplitude 产品分析的仪表盘设计",
  "Intercom 客服系统的对话界面", "HubSpot CRM 的销售漏斗可视化",
  "iOS 17 的交互式小组件设计", "macOS Sonoma 的桌面小组件设计",
  "Windows 11 的圆角设计语言", "Samsung One UI 的单手操作设计",
  "微信超级应用的生态设计", "支付宝的场景化设计",
  "飞书企业协作的设计语言", "网易云音乐的情感化设计",
  "小红书种草社区的设计", "B站弹幕视频的社区设计",
  "抖音竖屏沉浸式体验设计", "美团外卖的效率优先设计",
  "滴滴出行的安全感设计", "高德地图的导航体验设计",
  "京东购物的决策辅助设计", "淘宝个性化推荐的设计",
  "拼多多社交电商的设计", "闲鱼二手交易的信任设计",
  "得到知识付费的学习设计", "喜马拉雅音频内容的设计",
];

const CASE_CONTENTS = [
  "该案例展示了如何通过减少视觉噪音、强化信息层级来提升用户决策效率。核心改进：将主操作按钮从 3 个减少到 1 个，转化率提升 23%。设计师通过用户访谈发现，用户在面对多个同等权重的按钮时会产生决策疲劳，因此重新梳理了操作优先级。",
  "情感化设计的三个层次：本能层（视觉美感）、行为层（操作流畅）、反思层（品牌认同）。该产品在三个层次上均有出色表现，NPS 高达 72。特别是在反思层，产品通过个性化的年度回顾和情感化的空状态文案，建立了深厚的用户情感连接。",
  "极简主义不是删除功能，而是让每个功能都找到最自然的表达方式。该编辑器通过上下文感知工具栏，在需要时才显示格式选项，减少了 60% 的界面元素，同时保留了 100% 的功能。这种「隐藏而非删除」的设计哲学值得借鉴。",
  "协作功能的核心挑战是在多人同时操作时保持界面的清晰度。该产品通过颜色编码的用户光标和实时冲突提示，让协作过程透明可控。每个用户都有独特的颜色标识，即使在复杂的协作场景中也能清晰区分各人的操作。",
  "动态歌词的视觉设计需要在信息传递和情感表达之间取得平衡。该功能通过字体大小变化和颜色渐变，让用户感受到音乐的节奏和情感。当歌词与音乐节拍精确同步时，用户会产生强烈的沉浸感，这正是产品团队追求的核心体验。",
  "导航界面的可用性优化关键在于减少认知负荷。通过将复杂路线信息分层展示，该产品让用户在驾驶时只需关注最关键的下一步操作。研究发现，驾驶员在驾驶时的注意力资源极为有限，因此界面设计必须极度克制。",
  "消息架构的重设计解决了信息过载问题。通过引入频道分类和优先级标记，用户平均每天节省 45 分钟的信息处理时间。新的架构将工作相关消息和社交消息明确分离，让用户可以根据当前状态选择性地关注不同类型的信息。",
  "游戏化设计的核心是将学习行为转化为有意义的进度感。连续打卡、经验值、排行榜三个机制相互配合，用户留存率提升 40%。但设计师需要注意避免游戏化机制喧宾夺主，让用户为了徽章而学习，而不是为了学习而学习。",
  "设计语言的一致性体现在每一个细节：8px 的基础网格、统一的圆角半径、精心设计的空状态。这种一致性让产品显得专业且可信赖。设计团队建立了详细的设计原则文档，确保每个设计决策都有据可查。",
  "支付流程的信任感设计需要在每个步骤都传递安全信号。通过进度指示器、安全徽章和清晰的错误提示，支付成功率提升 18%。研究发现，用户在支付过程中最担心的是「我的钱去哪了」，因此每一步都需要明确的状态反馈。",
];

// ─── 设计知识标题池 ──────────────────────────────────────────────────────────
const KNOWLEDGE_TITLES = [
  "格式塔原理在 UI 设计中的实战应用", "色彩心理学：颜色对用户行为的影响",
  "排版的黄金比例：字号、行高与间距", "响应式设计的断点策略与内容优先",
  "原子设计方法论：从组件到页面的层级", "用户心智模型：设计与认知的匹配",
  "视觉层级的 7 个工具：引导用户注意力", "WCAG 2.1 无障碍设计的四个核心原则",
  "微交互设计：触发器、规则、反馈与循环", "卡片分类法：揭示用户信息架构心智",
  "用户旅程地图：从发现到推荐的全流程", "认知负荷理论：减少界面的外在负担",
  "Fitts 定律：目标大小与操作距离", "Hick 定律：减少选项数量提升决策效率",
  "Miller 定律：工作记忆的 7±2 信息块", "设计系统的色彩 Token 命名规范",
  "组件驱动开发：设计到代码的一致性", "用户研究的定性与定量方法指南",
  "A/B 测试的设计原则：如何控制变量", "可用性测试的 5 个核心指标",
  "情感化设计的三个层次：本能行为反思", "设计批评的给予框架：I like I wish",
  "设计冲刺的 5 天流程：问题到原型", "精益 UX 的假设验证循环",
  "Jobs-to-be-Done 框架：理解真实需求", "服务设计蓝图：前台与后台协同",
  "信息架构的 4 个组织原则", "导航设计的 7 个最佳实践",
  "表单设计的 10 个可用性原则", "错误信息的人性化写作指南",
  "空状态设计：将空页面变为引导机会", "引导流程设计：降低新用户门槛",
  "暗模式设计的色彩与对比度规范", "设计系统的版本管理与迁移策略",
  "图标设计的视觉一致性原则", "插图风格的选择与品牌一致性",
  "动效设计的 12 个原则", "声音设计在 UI 中的应用",
  "触觉反馈设计：振动模式的语义", "无障碍设计的键盘导航规范",
  "色彩无障碍：对比度与色盲友好", "字体无障碍：可读性与可访问性",
  "国际化设计：文本扩展与 RTL 适配", "跨文化设计：色彩与图标的文化差异",
  "移动优先设计：从小屏到大屏渐进增强", "手势交互设计：滑动捏合长按规范",
  "深色主题的设计原则与实现方案", "设计 Token 的实战：从 Figma 到代码",
  "组件文档的写作规范与最佳实践", "设计系统的 ROI 评估方法",
  "用户激活率的提升：引导流程优化", "功能发现率：渐进式披露的设计策略",
  "转化率优化：CTA 按钮的设计原则", "留存率提升：习惯养成的设计机制",
  "NPS 调查设计与用户满意度分析", "热力图分析：读懂用户的视觉焦点",
  "漏斗分析：找到产品转化的瓶颈", "用户分群：基于行为的个性化设计",
  "设计 OKR 的设定与追踪方法", "设计价值的量化：向业务证明设计 ROI",
  "设计师的职业发展路径：IC 与管理", "设计团队的协作模式：嵌入式与中心化",
  "设计与产品的协作框架", "设计与工程的协作模式：交付规范",
  "设计评审的高效组织方法", "设计提案的 STAR 结构化表达",
  "如何用数据说服利益相关者", "设计风险的识别与管理",
  "设计决策的文档化方法", "设计原则的制定与应用",
  "设计文化的建立与维护", "设计思维工作坊的组织方法",
  "用户访谈的提问技巧：开放式问题", "民族志研究：在真实场景中观察用户",
  "日记研究：追踪用户的长期行为变化", "眼动追踪研究：揭示用户视觉路径",
  "树形测试：验证信息架构的有效性", "首次点击测试：验证导航的直觉性",
  "认知走查：从专家视角评估可用性", "启发式评估：10 条可用性原则应用",
  "竞品分析的框架与方法", "设计趋势的识别与应用",
  "设计历史：包豪斯到数字设计的演变", "瑞士风格在数字设计中的应用",
  "日本设计美学：间、物哀、侘寂", "北欧设计的功能主义哲学",
  "极简主义设计的核心原则", "生成艺术与算法设计",
  "数据可视化的设计原则", "信息图表的叙事设计",
  "品牌设计系统的构建方法", "Logo 设计的视觉语言",
  "字体设计的历史与分类", "排版规则的打破与创新",
  "色彩搭配的科学与艺术", "网格系统的历史与应用",
  "留白的力量：负空间的设计哲学", "对称与不对称的视觉张力",
];

const KNOWLEDGE_CONTENTS = [
  "格式塔原理包括接近性、相似性、连续性、封闭性和图底关系。在 UI 设计中，利用接近性将相关元素分组，利用相似性建立视觉节奏，可以让界面在不添加边框的情况下实现清晰的信息组织。研究表明，遵循格式塔原理的界面，用户完成任务的时间平均减少 30%。",
  "色彩心理学研究表明：红色激发紧迫感（适合促销按钮），蓝色建立信任（适合金融产品），绿色传递安全（适合确认操作），橙色激发行动（适合 CTA 按钮）。但文化差异会显著影响色彩含义，需要本地化验证。例如白色在西方代表纯洁，在东亚文化中则与哀悼相关。",
  "排版的黄金比例：正文字号 × 1.618 = 标题字号。行高通常为字号的 1.4-1.6 倍。段落间距为行高的 1.5 倍。这些比例关系创造了视觉和谐感，让阅读体验更舒适。研究发现，合理的行高可以将阅读速度提升 20%，同时降低眼疲劳。",
  "响应式断点策略建议：移动端 320-768px，平板 768-1024px，桌面 1024-1440px，宽屏 1440px+。但更重要的是内容断点：当内容开始变形时才添加断点，而不是基于设备尺寸。这种「内容优先」的策略让设计更具适应性。",
  "原子设计方法论将 UI 分为原子（基础样式）、分子（组合组件）、有机体（功能模块）、模板（页面布局）、页面（实际内容）五个层级。这种层级结构让设计系统具有可扩展性和一致性。Airbnb、IBM 等大型公司都采用了这种方法论来管理其设计系统。",
  "用户心智模型是用户对系统工作方式的理解。当界面设计与用户心智模型匹配时，学习成本降低；不匹配时产生认知摩擦。研究用户心智模型的方法包括卡片分类、用户访谈和可用性测试。Jakob Nielsen 的研究表明，与用户心智模型匹配的界面可以将错误率降低 50%。",
  "视觉层级的 7 个工具：大小（最直接）、颜色（情感影响）、对比度（注意力引导）、间距（分组关系）、字重（重要程度）、位置（阅读顺序）、纹理（背景区分）。综合运用这些工具创造清晰的信息层级，让用户在 3 秒内找到页面最重要的信息。",
  "WCAG 2.1 的四个核心原则：可感知（信息可被用户感知）、可操作（界面可被操作）、可理解（信息和操作可被理解）、健壮性（内容可被辅助技术解析）。AA 级别要求正文对比度至少 4.5:1。全球约 15% 的人口有某种形式的残障，无障碍设计是设计的道德底线。",
  "微交互的四个维度：触发器（用户操作或系统状态）、规则（发生什么）、反馈（用户看到什么）、循环与模式（随时间的变化）。好的微交互让功能变得直觉化，让界面有生命感。研究表明，精心设计的微交互可以将用户满意度提升 25%。",
  "卡片分类法是信息架构研究的核心方法：让用户将内容卡片分组并命名，揭示用户的心智模型。开放式分类用于探索，封闭式分类用于验证。通常需要 15-20 名参与者才能获得可靠数据。Optimal Workshop 的研究表明，卡片分类可以将导航错误率降低 40%。",
];

// ─── 实用技巧标题池 ──────────────────────────────────────────────────────────
const TIP_TITLES = [
  "Figma 自动布局的 10 个高效技巧", "设计稿标注的最佳实践",
  "颜色命名规范：让设计系统更易维护", "组件变体的命名约定",
  "Figma 变量的实战应用：主题切换", "设计稿的文件组织结构最佳实践",
  "快速原型的 5 种工具选择策略", "用户测试脚本的编写模板",
  "设计评审会议的高效组织方法", "设计提案的 STAR 结构化表达",
  "如何用数据说服利益相关者", "设计 KPI 的设定与追踪方法",
  "设计师的时间管理：深度工作技巧", "设计灵感枯竭时的 7 种恢复方法",
  "设计作品集的 5 个常见错误", "设计面试的 STAR 法则应用",
  "如何在设计评审中处理批评", "设计师与 PM 的高效协作技巧",
  "设计师与工程师的沟通框架", "远程设计协作的工具与流程",
  "设计系统文档的写作技巧", "Figma 插件推荐：提升工作效率",
  "色彩工具推荐：从选色到无障碍检查", "字体配对工具：快速找到完美组合",
  "图标库的选择与使用规范", "插图风格的选择与品牌一致性",
  "设计稿的性能优化：减少导出文件大小", "Figma 组件的最佳实践",
  "设计 Token 的实战：从 Figma 到代码", "设计系统的版本管理策略",
  "用户访谈的提问技巧：开放式问题", "可用性测试的 5 秒测试法",
  "A/B 测试的设计：如何控制变量", "热力图分析：读懂用户行为数据",
  "漏斗分析：找到转化率瓶颈", "用户留存分析：理解用户生命周期",
  "NPS 调查的设计与分析方法", "CSAT 客户满意度的测量方法",
  "SUS 系统可用性量表的使用", "任务完成率的测量与分析",
  "错误率的追踪与改进方法", "首次使用成功率的优化策略",
  "用户激活率的提升技巧", "功能发现率的设计优化",
  "设计决策文档的写作模板", "设计原则的制定与应用案例",
  "设计批评的给予框架", "设计思维工作坊的组织方法",
  "设计冲刺的 5 天流程详解", "精益 UX 的假设验证循环",
  "如何快速制作高保真原型", "低保真原型的价值与使用时机",
  "纸质原型的制作与测试方法", "点击原型的交互设计技巧",
  "动效原型的工具与实现方法", "设计稿转代码的工具比较",
  "CSS 变量的设计系统应用", "Tailwind CSS 的设计系统集成",
  "Storybook 的组件文档最佳实践", "设计系统的 Figma 组织结构",
  "设计系统的发布与版本管理", "设计系统的采用率提升策略",
  "设计系统的贡献者指南写作", "设计系统的治理模型建立",
  "设计系统的 ROI 计算方法", "设计系统的可访问性审计流程",
  "色彩对比度检查工具的使用", "字体可读性测试的方法",
  "图片压缩与格式选择指南", "SVG 图标的优化与使用",
  "动效性能优化：避免布局抖动", "CSS Grid 布局的设计应用",
  "Flexbox 的常见布局模式", "响应式图片的最佳实践",
  "Web 字体加载的性能优化", "CSS 自定义属性的设计系统应用",
  "暗模式的 CSS 实现方案", "打印样式的设计与实现",
  "邮件模板的 HTML 设计规范", "设计稿的切图规范与命名",
  "设计交付物的清单与检查", "设计评审的准备与主持",
  "设计方案的多版本展示技巧", "设计故事的叙事结构",
  "设计演示的视觉呈现技巧", "设计汇报的数据可视化",
  "设计工作的优先级管理", "设计项目的时间估算方法",
  "设计风险的识别与管理", "设计复盘的方法与模板",
  "设计师的个人品牌建设", "设计作品集的结构与内容",
  "设计面试的准备与技巧", "设计谈薪的策略与方法",
  "设计师的持续学习方法", "设计社区的参与与贡献",
  "设计师的心理健康与工作平衡", "设计师的沟通表达能力提升",
];

const TIP_CONTENTS = [
  "Figma 自动布局技巧：1) 使用 Hug 模式让容器自适应内容；2) 用 Fill 模式让子元素填充父容器；3) 设置 Min/Max 宽度限制响应式行为；4) 用负间距实现重叠效果；5) 嵌套自动布局实现复杂布局。掌握这些技巧可以将设计稿的维护效率提升 3 倍。",
  "设计稿标注最佳实践：使用设计 Token 而非具体数值（如 spacing-4 而非 16px），标注交互状态（hover/active/disabled），提供组件的边界情况（最长文字/最短文字/空状态），减少开发猜测。良好的标注可以将设计-开发沟通成本降低 60%。",
  "颜色命名规范建议采用语义化命名：primary/secondary/tertiary 表示品牌色层级，success/warning/error/info 表示状态色，surface/background/border 表示结构色。避免使用 blue-500 这样的描述性命名，语义化命名让主题切换变得简单。",
  "组件变体命名约定：布尔值属性用 isDisabled/hasIcon 格式，枚举属性用 size: sm/md/lg 格式，状态属性用 state: default/hover/active/disabled 格式。一致的命名让组件库更易使用，也让开发者更容易理解设计意图。",
  "Figma 变量实战：创建 Color/Spacing/Typography 三类变量集合，为每个变量创建 Light/Dark 两个模式，在组件中使用变量而非硬编码值。切换主题时只需更改变量模式，整个设计稿自动更新，大幅提升主题化设计的效率。",
  "设计稿文件组织结构：按功能模块分页（如 Auth/Dashboard/Settings），每页内按流程排列（如 Empty State → Loading → Filled → Error），将组件库单独放在 _Components 页面，用 Cover 页面展示文件概览。清晰的文件结构让团队协作更高效。",
  "原型工具选择策略：概念验证用纸质原型（0 成本，快速迭代）；交互验证用 Figma 原型（无需编码，设计师自主）；动效验证用 Principle/Framer（高保真动效）；功能验证用代码原型（最真实，成本最高）。根据验证目标选择合适的工具，避免过度投入。",
  "用户测试脚本模板：开场白（介绍目的，消除紧张）→ 背景问题（了解用户背景）→ 任务场景（自然的任务描述，避免提示答案）→ 追问问题（为什么这么做？你期望什么发生？）→ 总结反馈（整体印象，改进建议）。好的脚本让测试数据更有价值。",
  "设计评审会议高效组织：提前 24 小时分享设计稿，明确评审目标（决策/反馈/告知），控制时间（60 分钟内），指定记录员，评审结束时明确下一步行动和负责人，会后 24 小时内发送会议纪要。高效的评审会议是设计推进的关键。",
  "设计提案 STAR 结构：Situation（当前问题和背景数据）→ Task（设计目标和成功指标）→ Action（设计方案和决策依据）→ Result（预期效果和验证计划）。这种结构让利益相关者快速理解设计价值，提高方案通过率。",
];

// ─── 设计语录池 ──────────────────────────────────────────────────────────────
const QUOTES = [
  { title: "乔布斯论设计的本质", author: "Steve Jobs", content: "设计不仅仅是外表和感觉，设计是它如何运作的。真正的设计师不会把功能和美学分开，两者是同一枚硬币的两面。" },
  { title: "Dieter Rams 的好设计十原则", author: "Dieter Rams", content: "好的设计是尽可能少的设计。少，但要更好。专注于本质，不要被非本质的东西所累。" },
  { title: "Paul Rand 论设计的力量", author: "Paul Rand", content: "设计是一种计划，用来实现特定目标的计划。没有目标，就没有设计，只有装饰。" },
  { title: "Charles Eames 论设计的约束", author: "Charles Eames", content: "约束是设计师最好的朋友。没有约束，设计就会失去方向；有了约束，创意才能找到出口。" },
  { title: "Massimo Vignelli 论秩序与美", author: "Massimo Vignelli", content: "秩序是设计的基础，但秩序不是目的，而是手段。真正的设计在秩序中寻找自由。" },
  { title: "Don Norman 论以人为中心的设计", author: "Don Norman", content: "设计的本质是解决问题，但最好的设计解决的是用户还没有意识到的问题。" },
  { title: "Jony Ive 论简约的力量", author: "Jony Ive", content: "简约不是缺少，而是恰到好处。每一个多余的元素都是对用户注意力的一次盗窃。" },
  { title: "Tim Brown 论设计思维", author: "Tim Brown", content: "设计思维不是设计师的专利，而是每个人都可以学习的解决问题的方式。" },
  { title: "Paula Scher 论字体的力量", author: "Paula Scher", content: "字体是设计的声音。不同的字体传递不同的情感，选择字体就是选择你想对用户说话的方式。" },
  { title: "Josef Müller-Brockmann 论网格系统", author: "Josef Müller-Brockmann", content: "网格不是束缚，而是自由的基础。当你理解了网格，你才能有意义地打破它。" },
  { title: "Victor Papanek 论为真实世界设计", author: "Victor Papanek", content: "设计为所有人服务，而不只是为那些能够负担得起的人。包容性设计是设计的道德底线。" },
  { title: "Christopher Alexander 论模式语言", author: "Christopher Alexander", content: "模式语言是人类智慧的结晶。每一个好的设计模式都来自于无数次的实践和反思。" },
  { title: "Mies van der Rohe 论少即是多", author: "Mies van der Rohe", content: "少即是多。这不是一种风格，而是一种哲学：去除所有不必要的，让本质显现。" },
  { title: "Louis Kahn 论建筑的光与影", author: "Louis Kahn", content: "光是建筑的第四维度。没有光，建筑就没有生命；没有影，建筑就没有深度。" },
  { title: "Le Corbusier 论形式与功能", author: "Le Corbusier", content: "形式追随功能，但功能本身也是一种美。当功能被完美实现时，美自然而然地出现。" },
  { title: "Milton Glaser 论设计与艺术", author: "Milton Glaser", content: "设计是连接人与人的桥梁。最好的设计让陌生人感到亲近，让复杂的事情变得简单。" },
  { title: "Erik Spiekermann 论字体的个性", author: "Erik Spiekermann", content: "字体是有个性的。每一种字体都有自己的声音、情感和历史。选择字体就是选择你的设计想说什么、怎么说。" },
  { title: "Jessica Hische 论字体设计的热情", author: "Jessica Hische", content: "你做的工作是你最好的简历。不要等待完美的项目，用你现有的工具和技能创造出你想看到的东西。" },
  { title: "Neri Oxman 论材料生态学", author: "Neri Oxman", content: "设计不应该只是关于形式和功能，而应该关注材料、环境和生命本身。未来的设计是与自然共生，而不是对抗自然。" },
  { title: "Hartmut Esslinger 论设计的文化", author: "Hartmut Esslinger", content: "设计是文化的表达。好的设计不只是解决问题，而是传递价值观、讲述故事、建立情感连接。" },
  { title: "Alan Fletcher 论设计的乐趣", author: "Alan Fletcher", content: "设计应该是有趣的。如果你在设计过程中没有感到乐趣，你的用户也不会在使用时感到乐趣。" },
  { title: "Ivan Chermayeff 论视觉传达", author: "Ivan Chermayeff", content: "视觉传达的力量在于它能够跨越语言和文化的障碍。一个好的图标、一个好的标志，可以在全世界被理解。" },
  { title: "Buckminster Fuller 论设计科学", author: "Buckminster Fuller", content: "你永远无法通过与现有现实的斗争来改变事物。要改变某些东西，就需要建立一个新的模型，使现有的模型变得过时。" },
  { title: "Tadao Ando 论建筑的诗意", author: "Tadao Ando", content: "建筑不只是遮风挡雨的庇护所，而是一种诗意的存在。它应该唤起人们对空间、光线和时间的感知。" },
  { title: "Kengo Kuma 论建筑的消隐", author: "Kengo Kuma", content: "我想让建筑消失。不是消失在虚无中，而是消失在自然和环境中，让人感受到场所的精神，而不是建筑师的自我。" },
  { title: "Zaha Hadid 论参数化设计", author: "Zaha Hadid", content: "建筑不应该是静止的。它应该是流动的、动态的，反映我们这个时代的复杂性和多样性。" },
  { title: "Rem Koolhaas 论城市与建筑", author: "Rem Koolhaas", content: "城市是人类最伟大的发明。它不是一个问题，而是一个解决方案——一个不断进化的、充满矛盾的、令人着迷的解决方案。" },
  { title: "Frank Gehry 论建筑的自由", author: "Frank Gehry", content: "我一直在寻找那种未完成的感觉，那种还在进行中的感觉。生活是运动的，建筑也应该是运动的。" },
];

// ─── 主函数 ──────────────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(conn);

  console.log("Clearing existing blindbox items...");
  await conn.execute("DELETE FROM blindbox_items");

  const items = [];
  const nowDate = new Date();
  const sources = {
    case: ["Dribbble", "Behance", "Awwwards", "CSS Design Awards", "Mobbin", "UX Archive", "Collect UI"],
    knowledge: ["Nielsen Norman Group", "Smashing Magazine", "A List Apart", "UX Collective", "Design Better", "Figma Blog", "Google Design"],
    tip: ["Figma Community", "YouTube Tutorial", "Medium", "Dev.to", "CSS-Tricks", "Codrops", "Frontend Masters"],
  };

  // 优秀案例 500 条
  for (let i = 0; i < 500; i++) {
    const titleBase = CASE_TITLES[i % CASE_TITLES.length];
    const suffixes = ["深度解析", "设计拆解", "案例研究", "设计复盘", "视觉解读", "交互分析", "体验评测", "设计分析", "品牌解析", "创新实践"];
    const title = i < CASE_TITLES.length ? titleBase : `${titleBase} — ${suffixes[i % suffixes.length]} Vol.${Math.floor(i / CASE_TITLES.length) + 1}`;
    items.push({
      type: "case",
      title,
      content: CASE_CONTENTS[i % CASE_CONTENTS.length],
      imageUrl: CASE_IMAGES[i % CASE_IMAGES.length],
      source: sources.case[i % sources.case.length],
    });
  }

  // 设计知识 500 条
  for (let i = 0; i < 500; i++) {
    const titleBase = KNOWLEDGE_TITLES[i % KNOWLEDGE_TITLES.length];
    const title = i < KNOWLEDGE_TITLES.length ? titleBase : `${titleBase}（进阶篇 ${Math.floor(i / KNOWLEDGE_TITLES.length) + 1}）`;
    items.push({
      type: "knowledge",
      title,
      content: KNOWLEDGE_CONTENTS[i % KNOWLEDGE_CONTENTS.length],
      imageUrl: KNOWLEDGE_IMAGES[i % KNOWLEDGE_IMAGES.length],
      source: sources.knowledge[i % sources.knowledge.length],
    });
  }

  // 实用技巧 500 条
  for (let i = 0; i < 500; i++) {
    const titleBase = TIP_TITLES[i % TIP_TITLES.length];
    const title = i < TIP_TITLES.length ? titleBase : `${titleBase}（实战篇 ${Math.floor(i / TIP_TITLES.length) + 1}）`;
    items.push({
      type: "tip",
      title,
      content: TIP_CONTENTS[i % TIP_CONTENTS.length],
      imageUrl: TIP_IMAGES[i % TIP_IMAGES.length],
      source: sources.tip[i % sources.tip.length],
    });
  }

  // 设计语录 500 条
  for (let i = 0; i < 500; i++) {
    const q = QUOTES[i % QUOTES.length];
    const title = i < QUOTES.length ? q.title : `${q.title}（语录集 Vol.${Math.floor(i / QUOTES.length) + 1}）`;
    items.push({
      type: "quote",
      title,
      content: `「${q.content}」\n\n—— ${q.author}`,
      imageUrl: QUOTE_IMAGES[i % QUOTE_IMAGES.length],
      source: q.author,
    });
  }

  // 打乱顺序
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  // 批量插入，每批 100 条
  const batchSize = 100;
  let total = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await db.insert(blindboxItems).values(batch);
    total += batch.length;
    process.stdout.write(`\rInserted ${total}/${items.length} items...`);
  }

  console.log(`\nDone! Total ${total} blindbox items inserted.`);
  await conn.end();
}

main().catch(console.error);
