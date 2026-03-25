# Design Collab Canvas - 项目 TODO

## 基础架构
- [x] 数据库 Schema 设计（meetings, todos, ideas, ideaComments, interviews, knowledgeArticles, inspirationItems, designReviews, blindboxItems 等12张表）
- [x] 数据库迁移 pnpm db:push
- [x] 全局样式系统（OKLCH 色彩、Space Grotesk + Inter 字体、动画系统）
- [x] 主页布局与导航（AppLayout 侧边栏、路由配置）
- [x] tRPC 路由拆分（8个功能路由 + auth + system）
- [x] 文件上传接口（/api/upload/image, /api/upload/audio）

## 功能模块

### 1. 会议转待办 (/meetings)
- [x] 音频文件上传到 S3
- [x] Whisper API 语音转文字
- [x] LLM 提取核心思路与待办
- [x] 待办按优先级/责任人/截止时间管理
- [x] 会议记录列表展示

### 2. 想法落地页 (/ideas)
- [x] 发布想法（标题/内容/标签）
- [x] 实时评论互动
- [x] 多格式导出（PDF/Word/博客/Markdown）
- [x] 想法卡片网格展示

### 3. 用户访谈管理 (/interviews)
- [x] 访谈记录创建与管理
- [x] AI 分析人群标签
- [x] 用户痛点自动提炼
- [x] 设计解决方案建议生成

### 4. 设计知识库 (/knowledge)
- [x] 知识条目创建（标题/内容/分类/标签）
- [x] 标签检索功能
- [x] 版本管理（每次编辑生成新版本）
- [x] 版本历史查看

### 5. 灵感碰撞墙 (/inspiration)
- [x] 画布式拖拽卡片布局
- [x] 支持文字/链接/图片三类卡片
- [x] 卡片颜色自定义
- [x] AI 自动生成风格标签
- [x] 鼠标拖拽位置持久化

### 6. 方案智能评审 (/reviews)
- [x] 设计稿图片上传
- [x] AI 多维度评分（B端业务逻辑/交互一致性/Accessibility/视觉层级/信息密度）
- [x] 评审意见生成
- [x] 历史版本对比

### 7. 像素猫咪宠物 (全局)
- [x] 复古像素风 SVG 猫咪（5种情绪帧）
- [x] 活跃度追踪（全局点击事件）
- [x] 状态变化（idle/happy/curious/sleeping/excited）
- [x] 随机鼓励语录弹出
- [x] 设计冷知识弹出
- [x] 长时间无互动进入睡眠状态

### 8. 灵感盲盒彩蛋 (/blindbox)
- [x] 随机推送优秀案例/知识/趣味设计
- [x] 开盒动画效果
- [x] 结果卡片展示

## 测试
- [x] auth.logout 单元测试
- [x] 路由结构完整性测试（18个测试用例全部通过）
- [x] 受保护接口未授权拦截测试
