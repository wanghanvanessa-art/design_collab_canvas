# 京东金融 B 端组件库 · 基础组件规范整理

> **来源文件**：`基础组件` 画板（node `0:1302`）  
> **原始链接**：[Figma · 京东金融B端组件库](https://www.figma.com/design/8fQIquokFWJQblXRBgc0yN/%E4%BA%AC%E4%B8%9C%E9%87%91%E8%9E%8DB%E7%AB%AF%E7%BB%84%E4%BB%B6%E5%BA%93?node-id=0-1302&t=q0YWQnNNHF4GfxQq-1)  
> **数据来源**：Figma REST API + 全图层 CSS 逐层提取（25,586 图层 / 42 组件）  
> **整理时间**：2026-04-02

---

## 1. 文档说明

本文档从 Figma `基础组件` 画板自动提取并结构化整理，覆盖：

- **Design Token 基线**：颜色、字号/字重、圆角、边框、阴影
- **42 个组件模块** 的 CSS 规范要点（含每组件主要 token 统计）
- **Props 维度建议** 与 **落地说明**

适用角色：前端研发、设计系统维护者、测试工程师。

---

## 2. Design Token 基线

### 2.1 颜色系统

#### 品牌主色

| Token 名建议 | 色值 | 说明 |
|---|---|---|
| `color-primary` | `#2C68FF` / `rgb(44, 104, 255)` | 品牌蓝，高频出现于按钮、选中态、焦点环、进度等 |
| `color-primary-hover` | `#4177FF` / `rgb(65, 119, 255)` | 主色 Hover |
| `color-primary-active` | `#275DE5` / `rgb(39, 93, 229)` | 主色 Active/按下 |
| `color-primary-light` | `#ECF2FE` / `rgb(236, 242, 254)` | 选中行背景、轻量高亮 |
| `color-primary-lighter` | `#D4E3FC` / `rgb(212, 227, 252)` | 焦点环颜色（`box-shadow: 0 0 0 2px`） |

#### 语义色

| Token 名建议 | 色值 | 说明 |
|---|---|---|
| `color-success` | `#00A870` / `rgb(0, 168, 112)` | 成功绿（审批通过、上传成功） |
| `color-success-alt` | `#4AB671` / `rgb(74, 182, 113)` | 备用绿（审批节点） |
| `color-warning` | `#F38E0B` / `rgb(243, 142, 11)` | 警告橙（表格状态、告警） |
| `color-warning-alt` | `#ED7B2F` / `rgb(237, 123, 47)` | 备用橙（弹窗 warning） |
| `color-error` | `#F15151` / `rgb(241, 81, 81)` | 错误红（表单校验、告警） |
| `color-error-alt` | `#E34D59` / `rgb(227, 77, 89)` | 备用红（步骤条错误） |
| `color-info` | `#2C68FF` | 信息蓝（同主色） |
| `color-badge` | `#FF3B30` / `rgb(255, 59, 48)` | 徽标/红点（Badge） |

#### 中性色（从高到低明度）

| Token 名建议 | 色值 | 说明 |
|---|---|---|
| `color-white` | `#FFFFFF` | 白色背景 |
| `color-bg-page` | `#F9FAFÇ` / `rgb(249, 250, 252)` | 页面底色 |
| `color-bg-secondary` | `#F7F8FA` / `rgb(247, 248, 250)` | 次级背景/禁用区 |
| `color-bg-tertiary` | `#F5F5F5` / `rgb(245, 245, 245)` | 三级背景 |
| `color-fill-light` | `#F3F3F3` / `rgb(243, 243, 243)` | 数字输入框侧边填充 |
| `color-border-light` | `#DCDCDC` / `rgb(220, 220, 220)` | 主边框色（inset shadow） |
| `color-border` | `#D8D8D8` / `rgb(216, 216, 216)` | 常规描边 |
| `color-border-secondary` | `#D3D3D3` / `rgb(211, 211, 211)` | 次级描边 |
| `color-divider` | `#ECF3` / `rgb(236, 237, 243)` | 表格分割线 |
| `color-disabled` | `#BBBBBB` / `rgb(187, 187, 187)` | 禁用态/水印文字 |
| `color-icon-secondary` | `#979797` / `rgb(151, 151, 151)` | 次级图标（Figma 描边层） |
| `color-text-secondary` | `#666666` / `rgb(102, 102, 102)` | 次级文字 |
| `color-text-tertiary` | `#333333` / `rgb(51, 51, 51)` | 三级文字 |
| `color-text-primary` | `#000000` / `rgb(0, 0, 0)` | 主文字（默认） |

#### 特效色

| Token 名建议 | 色值 | 说明 |
|---|---|---|
| `color-success-bg` | `#E8F8F2` / `rgb(232, 248, 242)` | 成功浅背景（文字提示） |
| `color-watermark` | `#BBBBBB @0.16` | 水印专用色 |

---

### 2.2 字体与排版

#### 字体族（按使用频率）

| Token 名建议 | 值 | 场景 |
|---|---|---|
| `font-family-base` | `"PingFangSC-Regular", PingFang SC, sans-serif` | 正文、标签（最高频） |
| `font-family-semibold` | `"PingFangSC-Semibold", PingFang SC, sans-serif` | 标题、强调文字 |
| `font-family-medium` | `"PingFangSC-Medium", PingFangSC, sans-serif` | 中等权重（表格头、对话卡片） |
| `font-family-brand` | `"jingdonglangzhengti2-Semilight", jingdonglangzhengti2` | 水印文字 |
| `font-family-display` | `"JDZhengHT-Regular", JDZhengHT` | 数字展示（图片查看器、数字输入框）|
| `font-family-number` | `"Gilroy-ExtraBold", Gilroy` | 数字强调（滑块刻度） |
| `font-family-logo` | `"JDLANGZHENGTI--GB1-0", JDLangZhengTi` | 品牌 Logo 字（菜单标题） |

#### 字号阶梯

| Token 名建议 | 值 | 说明 |
|---|---|---|
| `font-size-xs` | `12px` | 辅助信息、标签小号、时间 |
| `font-size-sm` | `14px` | **主正文**（最高频，覆盖绝大多数组件） |
| `font-size-base` | `16px` | 标题、主操作按钮、消息通知标题 |
| `font-size-lg` | `20px` | 头像字符大号 |
| `font-size-xl` | `24px` | 组件标题标注（Figma 标题层） |
| `font-size-display` | `36px` | 头像超大号 |

> 注：14px 在全画板出现频率最高（3,788 次），是核心正文字号。

---

### 2.3 圆角系统

| Token 名建议 | 值 | 典型使用组件 |
|---|---|---|
| `radius-sm` | `2px` | 标签 Tag（主）、筛选 chip、上传列表 |
| `radius-base` | `4px` | **最高频**：输入框、选择器、按钮、筛选、下拉、分页等 |
| `radius-md` | `6px` | 颜色选择器、文字提示 tooltip |
| `radius-lg` | `8px` | 卡片、弹窗内部块、树结构行、表格圆角 |
| `radius-xl` | `10px` | 徽标数字（Badge number）、进度条 |
| `radius-switch` | `12px` | 开关 Switch（胶囊型） |
| `radius-full` | `16px` | 大圆角卡片、分节框、弹窗外层 |

---

### 2.4 边框系统

| Token 名建议 | 值 | 说明 |
|---|---|---|
| `border-default` | `inset 0 0 0 1px rgb(220, 220, 220)` | 表单控件默认态（box-shadow 实现） |
| `border-focus` | `inset 0 0 0 1px rgb(44, 104, 255)` | 焦点/选中态边框 |
| `border-error` | `inset 0 0 0 1px rgb(241, 81, 81)` | 校验失败 |
| `border-divider` | `1px solid rgb(236, 237, 243)` | 表格行分割线 |
| `border-standard` | `1px solid rgb(211, 211, 211)` | 面板、容器描边 |

> 说明：Figma 画板中大量出现的 `1px solid rgb(151, 151, 151)` 为 Figma **标注辅助层**（非实际组件样式），研发侧可忽略。

---

### 2.5 阴影系统

| Token 名建议 | 值 | 说明 |
|---|---|---|
| `shadow-card` | `0px 2px 16px 0px rgba(0, 0, 0, 0.04)` | 卡片轻投影 |
| `shadow-dropdown` | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` | 下拉面板、弹出层 |
| `shadow-tooltip` | `0px 3px 14px 2px rgba(0,0,0,0.05), 0px 8px 10px 1px rgba(0,0,0,0.06)` | Tooltip、气泡 |
| `shadow-focus` | `0 0 0 2px rgb(212, 227, 252)` | 焦点外发光环 |
| `shadow-drawer` | `0px -1px 8px 0px rgba(0,0,0,0.04)` | 抽屉阴影 |

---

## 3. 组件总目录（42 个）

| # | 组件名 | 图层数 | 画板尺寸 (px) | 分类 |
|---|---|---|---|---|
| 1 | 审批 | 640 | 1200 × 3872 | 流程 |
| 2 | 对话区域卡片 | 1012 | 1200 × 4656 | 展示 |
| 3 | 水印 | 72 | 1200 × 1464 | 展示 |
| 4 | 选项卡 | 255 | 1200 × 2082 | 导航 |
| 5 | 菜单 | 786 | 1200 × 2540 | 导航 |
| 6 | 颜色选择器 | 530 | 1200 × 2408 | 录入 |
| 7 | 滑块 | 334 | 1200 × 3744 | 录入 |
| 8 | 筛选备份 | 474 | 1200 × 4103 | 录入 |
| 9 | 筛选 | 839 | 1200 × 4103 | 录入 |
| 10 | 步骤条 | 254 | 1200 × 2619 | 导航/流程 |
| 11 | 时间选择器 | 2465 | 1200 × 7504 | 录入 |
| 12 | 气泡确认框 | 504 | 1200 × 3875 | 反馈 |
| 13 | 全局提示 | 173 | 1200 × 2067 | 反馈 |
| 14 | 消息通知 | 312 | 1200 × 4025 | 反馈 |
| 15 | 弹窗 | 362 | 1200 × 5719 | 反馈 |
| 16 | 警告提醒 | 198 | 1200 × 2562 | 反馈 |
| 17 | 树结构 | 1185 | 1200 × 3225 | 展示/录入 |
| 18 | 文字提示 | 172 | 1200 × 2878 | 反馈 |
| 19 | 进度条 | 135 | 1200 × 3485 | 展示 |
| 20 | 加载中 | 39 | 1200 × 1854 | 反馈 |
| 21 | 徽标 | 184 | 1200 × 2217 | 展示 |
| 22 | 头像 | 485 | 1200 × 3922 | 展示 |
| 23 | 上传 | 899 | 1200 × 8509 | 录入 |
| 24 | 穿梭框 | 1409 | 1200 × 6277 | 录入 |
| 25 | 开关 | 102 | 1200 × 2027 | 录入 |
| 26 | 级联选择器 | 1513 | 1200 × 5870 | 录入 |
| 27 | 抽屉 | 193 | 1200 × 7488 | 容器 |
| 28 | 联系人选择器 | 409 | 1200 × 4578 | 录入 |
| 29 | 图片查看器 | 597 | 1200 × 6536 | 展示 |
| 30 | 表单 | 257 | 1200 × 3065 | 录入/容器 |
| 31 | 选择器 | 925 | 1200 × 4757 | 录入 |
| 32 | 搜索框 | 1118 | 1200 × 4294 | 录入 |
| 33 | 数字输入框 | 545 | 1200 × 2689 | 录入 |
| 34 | 输入框 | 392 | 1200 × 3982 | 录入 |
| 35 | 多选框&单选框 | 379 | 1200 × 2640 | 录入 |
| 36 | 链接 | 433 | 1200 × 2429 | 导航 |
| 37 | 下拉菜单 | 799 | 1200 × 3304 | 导航 |
| 38 | 面包屑 | 228 | 1200 × 2445 | 导航 |
| 39 | 分页 | 554 | 1200 × 2735 | 导航 |
| 40 | 标签 | 435 | 1200 × 3147 | 展示 |
| 41 | 表格 | 2687 | 1200 × 7318 | 展示 |
| 42 | 按钮 | 301 | 1200 × 3753 | 基础 |

---

## 4. 各组件规范要点

### 4.1 按钮（Button）

**图层数**：301 | **画板高度**：3753px

| CSS 属性 | 值 |
|---|---|
| 主色背景 | `#2C68FF` |
| Hover 背景 | `#4177FF` |
| Active 背景 | `#275DE5` |
| 主色边框（阴影） | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 圆角 | `4px`（主）、`8px`（圆角型）、`16px`（胶囊） |
| 主字号 | `16px`（默认）、`14px`（小号）、`12px`（迷你） |
| 禁用背景 | `#F9FAFÇ`（`rgb(249, 250, 252)`） |

**Props 维度**：`type`（primary/secondary/text/link）、`size`（large/middle/small）、`shape`（default/round）、`disabled`、`loading`、`danger`

---

### 4.2 输入框（Input）

**图层数**：392 | **画板高度**：3982px

| 状态 | 边框（box-shadow） |
|---|---|
| 默认 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 聚焦 | `inset 0 0 0 1px rgb(44, 104, 255)` + `0 0 0 2px rgb(212, 227, 252)` |
| 错误 | `inset 0 0 0 1px rgb(241, 81, 81)` |
| 只读/禁用 | 背景 `rgb(249, 250, 252)` 或 `rgb(243, 243, 243)` |

| CSS 属性 | 值 |
|---|---|
| 圆角 | `4px`（主）、`10px`（圆角搜索型） |
| 主字号 | `14px` |
| 占位色 | `#BBBBBB` |
| 清空/图标色 | `rgb(187, 187, 187)` |

**Props 维度**：`size`（large/middle/small）、`status`（default/focus/error/success/disabled/readOnly）、`type`（text/password/textarea）、`prefix`/`suffix`、`addonBefore`/`addonAfter`

---

### 4.3 数字输入框（InputNumber）

**图层数**：545 | **画板高度**：2689px

| CSS 属性 | 值 |
|---|---|
| 默认边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 聚焦边框 | `inset 0 0 0 1px rgb(44, 104, 255)` + `0 0 0 2px rgb(212, 227, 252)` |
| 圆角 | `4px`（主）；步进按钮顶部 `0px 4px 0px 0px` |
| 步进按钮背景 | `rgb(243, 243, 243)`（侧栏）/`rgb(238, 238, 238)` |
| 主字号 | `14px` |
| 数字显示字体 | `JDZhengHT-Light`（特殊展示场景） |

**Props 维度**：`size`、`status`、`controls`（左右居中/居左）、`min`/`max`/`step`

---

### 4.4 搜索框（Search）

**图层数**：1118 | **画板高度**：4294px

| CSS 属性 | 值 |
|---|---|
| 聚焦外发光 | `0 0 0 2px rgb(212, 227, 252)`（高频 35 次） |
| 默认边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 按钮 active 边框 | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 圆角 | `4px`（主）、`3px`（联想项）、`2px`（标签） |
| 主字号 | `14px` |

**Props 维度**：`size`、`mode`（basic/batch/suggest/expand/history）、`leftAddon`/`rightAddon`、`loading`

---

### 4.5 选择器（Select）

**图层数**：925 | **画板高度**：4757px

| CSS 属性 | 值 |
|---|---|
| 默认边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 聚焦边框 | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 焦点外发光 | `0 0 0 2px rgb(212, 227, 252)` |
| 下拉面板 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 选中项背景 | `rgb(236, 242, 254)` |
| 圆角 | `4px`（控件）、`2px`（多选 tag）、`3px`（选项 hover） |
| 主字号 | `14px` |

**Props 维度**：`size`、`mode`（single/multiple/group）、`status`（normal/hover/active/disabled/readOnly/filled）、`showSearch`、`allowClear`

---

### 4.6 级联选择器（Cascader）

**图层数**：1513 | **画板高度**：5870px

| CSS 属性 | 值 |
|---|---|
| 圆角（主） | `3px`（选项行，180 次）、`8px`（面板）、`4px`（tag） |
| 选中背景 | `rgb(236, 242, 254)` |
| 下拉阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 焦点环 | `0 0 0 2px rgb(212, 227, 252)` |
| 主字号 | `14px`（选项）、`16px`（触发器） |

**Props 维度**：`mode`（single/multiple）、`level`（2/3/4 级）、`size`、`status`（Normal/Hover/Active/Disabled/ReadOnly/Filled）

---

### 4.7 时间选择器（DateTimePicker）

**图层数**：2465 | **画板高度**：7504px（最复杂组件之一）

| CSS 属性 | 值 |
|---|---|
| 圆角（主） | `4px`（日期格、输入区）、`2px`（日期序号）、`8px`（面板容器） |
| 选中日期背景 | `rgb(236, 242, 254)` / `rgb(44, 104, 255)` |
| 今日高亮 | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 面板阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 主字号 | `14px`（日期）、`12px`（周标题） |

**Props 维度**：`type`（date/time/dateRange/dateTimeRange/dateFilter/cycle）、`size`、`format`、`disabledDate`

---

### 4.8 筛选（Filter）

**图层数**：839 | **画板高度**：4103px

| CSS 属性 | 值 |
|---|---|
| 圆角（主） | `4px`（筛选项 chip，160 次）、`2px`（复选标记）、`8px`（面板） |
| 主背景 | `rgb(247, 248, 250)`（筛选区域底色） |
| 主色选中 | `rgb(44, 104, 255)` |
| 默认边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 选中边框 | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 主字号 | `14px` |

**Props 维度**：`mode`（常规/可展开收起）、`layout`（行内/折叠）

---

### 4.9 多选框 & 单选框（Checkbox / Radio）

**图层数**：379 | **画板高度**：2640px

| 状态 | 样式 |
|---|---|
| 未选中 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 选中 | 背景 `rgb(44, 104, 255)` + 白色勾 |
| 半选中（多选） | `inset 0 0 0 1px rgb(187, 211, 251)` + 蓝色填充 |
| Hover | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 禁用 | 背景 `rgb(245, 245, 245)` + 边框 `rgb(187, 187, 187)` |

| CSS 属性 | 值 |
|---|---|
| 圆角（多选） | `2px` |
| 圆角（单选） | `50%`（圆形） |
| 尺寸 | `16px`（默认）、`12px`（小） |
| 字号 | `12px`（小号标签）、`14px`（中号标签）、`16px`（大号标签） |

**Props 维度**：`size`（small/middle/large）、`style`（默认/描边/品牌/图标/中性）、`disabled`、`checked`/`indeterminate`

---

### 4.10 开关（Switch）

**图层数**：102 | **画板高度**：2027px

| CSS 属性 | 值 |
|---|---|
| 开启背景 | `rgb(44, 104, 255)` |
| 关闭背景 | `rgb(197, 197, 197)` |
| 滑块（thumb）背景 | `rgb(255, 255, 255)` |
| 圆角（轨道） | `12px`（大号）、`10px`（小号） |
| 禁用背景 | `rgb(238, 238, 238)` |

**Props 维度**：`size`（large/small）、`checked`、`disabled`、`checkedChildren`/`unCheckedChildren`（带文字描述型）

---

### 4.11 上传（Upload）

**图层数**：899 | **画板高度**：8509px

| CSS 属性 | 值 |
|---|---|
| 圆角（文件项） | `4px`（主）、`2px`（进度条）、`3px`（图标） |
| 默认边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 拖拽区边框 | `inset 0px -1px 0px 0px rgb(245, 245, 245)` |
| 上传中（蓝） | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 上传失败色 | `rgb(241, 81, 81)` |
| 上传成功色 | `rgb(44, 104, 255)` |
| 主字号 | `14px`（文件名）、`12px`（大小/状态） |

**Props 维度**：`type`（basic/drag/batch/batchProgressing/input）、`status`（default/hover/active/uploading/success/error）、`multiple`、`accept`

---

### 4.12 表单（Form）

**图层数**：257 | **画板高度**：3065px

| CSS 属性 | 值 |
|---|---|
| 圆角 | `4px`（主控件）、`3px`（辅助图标） |
| 错误色 | `rgb(241, 81, 81)` |
| 成功色 | `rgb(0, 168, 112)` |
| 主字号 | `14px` |
| 必填星号色 | `rgb(241, 81, 81)` |

**Props 维度**：`layout`（vertical/inline）、`labelAlign`（top/right/left）、`validateStatus`（validating/success/warning/error）

---

### 4.13 选项卡（Tabs）

**图层数**：255 | **画板高度**：2082px

| CSS 属性 | 值 |
|---|---|
| 激活色 | `rgb(44, 104, 255)` |
| 未激活色 | `rgb(102, 102, 102)` |
| 禁用色 | `rgb(188, 188, 188)` |
| 激活下划线/底色 | `rgb(44, 104, 255)` |
| 卡片背景 | `rgb(245, 245, 245)` |
| 圆角（卡片型） | `4px`（顶部）；`8px 0px 0px 0px`（左上） |
| 主字号 | `14px`（主）、`12px`（小号） |
| 弹出层阴影 | `0px 3px 14px 2px rgba(0,0,0,0.05), 0px 8px 10px 1px rgba(0,0,0,0.06)` |

**Props 维度**：`type`（简易/基础/卡片/卡片百分比/标签页/线框/分割线/带标签）、`size`、`tabPosition`

---

### 4.14 菜单（Menu / Sidebar）

**图层数**：786 | **画板高度**：2540px

| CSS 属性 | 值 |
|---|---|
| 激活背景 | `rgb(44, 104, 255)` |
| 激活文字 | `rgb(255, 255, 255)` |
| 背景色 | `rgb(25, 25, 25)` / `rgb(255, 255, 255)` |
| 分割线色 | `rgb(216, 216, 216)` |
| 圆角（菜单项） | `4px`（主）、`6px`（图标容器）、`1px`（分割线） |
| 左侧激活条 | `0px 0px 0px 16px`（左侧圆角特殊值） |
| 主字号 | `14px`（菜单项）、`18px`（品牌名） |
| 品牌字体 | `JDLANGZHENGTI--GB1-0` |

**Props 维度**：`mode`（平铺/折叠）、`theme`（light/dark）、`collapsed`、`defaultSelectedKeys`

---

### 4.15 面包屑（Breadcrumb）

**图层数**：228 | **画板高度**：2445px

| CSS 属性 | 值 |
|---|---|
| 当前页色 | `rgb(44, 104, 255)` |
| 父级颜色 | `rgb(142, 145, 151)` |
| 分隔符颜色 | `rgb(216, 216, 216)` |
| 悬浮/下拉背景 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 圆角 | `4px` |
| 主字号 | `14px` |

---

### 4.16 分页（Pagination）

**图层数**：554 | **画板高度**：2735px

| CSS 属性 | 值 |
|---|---|
| 激活页码背景 | `rgb(44, 104, 255)` + 白色文字 |
| 默认页码边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 禁用背景 | `rgb(238, 238, 238)` |
| 圆角 | `4px` |
| 主字号 | `14px`（页码）、`12px`（总数文字） |

---

### 4.17 树结构（Tree）

**图层数**：1185 | **画板高度**：3225px

| CSS 属性 | 值 |
|---|---|
| 选中行背景 | `rgb(255, 255, 255)` + `inset 0 0 0 1px rgb(220, 220, 220)` |
| Hover 背景 | `rgb(245, 245, 245)` |
| 选中节点色 | `rgb(44, 104, 255)` |
| 圆角（行） | `4px`（主）、`2px`（展开图标） |
| 主字号 | `14px` |

**Props 维度**：`type`（基础/可选择/可功能操作/连接线）、`status`（Normal/Hover/Disabled/Select）

---

### 4.18 表格（Table）

**图层数**：2687 | **画板高度**：7318px（最大组件）

| CSS 属性 | 值 |
|---|---|
| 表头背景 | `rgb(238, 238, 238)` |
| 行分割线 | `1px solid rgb(236, 237, 243)` |
| Hover 行背景 | `rgb(236, 242, 254)` |
| 选中行背景 | `rgb(212, 227, 252)` |
| 激活/主色 | `rgb(44, 104, 255)` |
| 状态橙 | `rgb(243, 142, 11)` |
| 状态绿 | `rgb(14, 211, 150)` |
| 圆角（容器） | `8px`；头部 `7px 7px 0 0` |
| 主字号 | `14px`（单元格）、`12px`（辅助信息） |
| 字体 | `PingFangSC-Medium`（表头）/ `PingFangSC-Regular`（正文） |

**Props 维度**：`selection`（none/single/multiple）、`bordered`、`fixed`、`resizable`、`expand`、`empty`、`showColumnSettings`

---

### 4.19 标签（Tag）

**图层数**：435 | **画板高度**：3147px

| CSS 属性 | 值 |
|---|---|
| 圆角 | `2px`（主，55 次）、`3px`（次） |
| 主色 Tag 背景 | `rgb(44, 104, 255)` + 白色文字 |
| 默认 Tag 背景 | `rgb(245, 245, 245)` / `rgb(238, 238, 238)` |
| 边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 主字号 | `12px`（小标签）、`14px` |

---

### 4.20 下拉菜单（Dropdown）

**图层数**：799 | **画板高度**：3304px

| CSS 属性 | 值 |
|---|---|
| 面板阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 分割线（top） | `inset 0px 1px 0px 0px rgb(245, 245, 245)` |
| Hover 行背景 | `rgb(236, 242, 254)` |
| 危险项颜色 | `rgb(227, 77, 89)` |
| 圆角 | `4px`（主，114 次） |
| 主字号 | `14px` |

---

### 4.21 链接（Link）

**图层数**：433 | **画板高度**：2429px

| 主题 | 颜色 |
|---|---|
| 默认蓝 | `rgb(44, 104, 255)` |
| 成功绿 | `rgb(0, 168, 112)` |
| 警告橙 | `rgb(237, 123, 47)` |
| 错误红（1） | `rgb(227, 77, 89)` |
| 错误红（2） | `rgb(241, 81, 81)` |
| Visited 深蓝 | `rgb(0, 52, 181)` |

**Props 维度**：`type`（default/success/warning/danger）、`size`（small/middle/large）、`underline`、`disabled`

---

### 4.22 气泡确认框（Popconfirm）

**图层数**：504 | **画板高度**：3875px

| CSS 属性 | 值 |
|---|---|
| 面板阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 主色 | `rgb(44, 104, 255)` |
| 警告色 | `rgb(237, 123, 47)` / `rgb(241, 81, 81)` |
| 圆角 | `4px`（主）、`16px`（外层容器） |
| 小阴影 | `3px 3px 8px 0px rgba(0,0,0,0.05)` |
| 主字号 | `12px`（描述）、`14px`（操作区） |

---

### 4.23 全局提示（Message / Toast）

**图层数**：173 | **画板高度**：2067px

| CSS 属性 | 值 |
|---|---|
| 面板阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 圆角 | `4px`（主）、`3px`（图标） |
| 语义色 | 蓝 `#2C68FF` / 绿 `#00A870` / 橙 `#ED7B2F` / 红 `#F15151` |
| 主字号 | `14px` |

---

### 4.24 消息通知（Notification）

**图层数**：312 | **画板高度**：4025px

| CSS 属性 | 值 |
|---|---|
| 卡片阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 圆角 | `4px`（主）、`3px`（状态图标）、`16px`（外容器） |
| 标题字号 | `16px`（Semibold） |
| 描述字号 | `14px` |

---

### 4.25 弹窗（Modal / Dialog）

**图层数**：362 | **画板高度**：5719px

| CSS 属性 | 值 |
|---|---|
| 容器圆角 | `8px`（内容块）、`12px`（模式弹窗外层） |
| 标题字号 | `16px`（Semibold） |
| 内容字号 | `14px` |
| 语义色 | info `#2C68FF` / warning `#ED7B2F` / error `#F15151` / success `#00A870` |
| 遮罩背景 | `rgba(0, 0, 0, 0.4)` |
| 圆角（按钮） | `4px`（主）、`3px`（图标按钮） |

---

### 4.26 警告提醒（Alert）

**图层数**：198 | **画板高度**：2562px

| CSS 属性 | 值 |
|---|---|
| info 颜色 | `rgb(44, 104, 255)` |
| success 颜色 | `rgb(74, 182, 113)` |
| warning 颜色 | `rgb(255, 156, 0)` |
| error 颜色 | `rgb(227, 77, 89)` |
| 圆角 | `4px`（主）、`3px`（图标） |
| 内容字号 | `14px`（描述）、`16px`（标题） |
| 最大宽度 | `960px` |

---

### 4.27 文字提示（Tooltip）

**图层数**：172 | **画板高度**：2878px

| CSS 属性 | 值 |
|---|---|
| 面板阴影 | `0px 3px 14px 2px rgba(0,0,0,0.05), 0px 8px 10px 1px rgba(0,0,0,0.06)` |
| 背景色 | `rgb(249, 250, 252)` / `rgb(255, 255, 255)` |
| 主题色背景 | `rgb(232, 248, 242)`（success）、`rgb(236, 242, 254)`（info） |
| 圆角 | `4px`（主）、`6px`（次） |
| 字号 | `14px`（主）、`16px`（标题） |

**Props 维度**：`placement`（12 向）、`trigger`（hover/click/focus/contextMenu）、`arrow`（带/不带箭头/跟随鼠标）、`theme`

---

### 4.28 进度条（Progress）

**图层数**：135 | **画板高度**：3485px

| CSS 属性 | 值 |
|---|---|
| 进度色（主） | `rgb(44, 104, 255)` |
| 成功色 | `rgb(74, 182, 113)` |
| 失败色 | `rgb(241, 81, 81)` |
| 轨道背景 | `rgb(249, 250, 252)` |
| 圆角 | `10px`（线形轨道）、`6px`（圆形）、`4px`（按钮） |
| 字号 | `16px`（外显百分比）、`12px`（内显）、`20px`（环形大字） |

**Props 维度**：`type`（line/circle）、`status`（normal/success/error）、`showInfo`、`strokeWidth`

---

### 4.29 加载中（Spin / Loading）

**图层数**：39 | **画板高度**：1854px

| CSS 属性 | 值 |
|---|---|
| 图标色 | `rgb(44, 104, 255)` |
| 背景遮罩 | `rgb(249, 250, 252) @0.85` |
| 圆角（容器） | `16px` |
| 字号 | `16px`（文字）、`14px`（小号文字） |

**Props 维度**：`type`（icon-only/text-only/icon+text）、`size`（small/default/large）、`delay`

---

### 4.30 徽标（Badge）

**图层数**：184 | **画板高度**：2217px

| CSS 属性 | 值 |
|---|---|
| 红点色 | `rgb(255, 59, 48)` |
| 数字徽标色 | `rgb(241, 81, 81)` |
| 白色描边 | `inset 0 0 0 2px rgb(255, 255, 255)` |
| 圆角（数字） | `10px`（椭圆胶囊）、`8px`（方形）、`2px`（矩形标签） |
| 字号 | `12px`（数字） |

**Props 维度**：`type`（dot/number/custom）、`size`（small/default）、`overflowCount`、`showZero`

---

### 4.31 头像（Avatar）

**图层数**：485 | **画板高度**：3922px

| CSS 属性 | 值 |
|---|---|
| 默认背景 | `rgb(212, 227, 252)` |
| 默认字/图标色 | `rgb(44, 104, 255)` |
| 白色描边 | `inset 0 0 0 2px rgb(255, 255, 255)` |
| 圆角（方形） | `3px`（默认）、`6px`（中圆角） |
| 圆形 | `50%` |
| 字号 | `16px`（默认）、`20px`（大号）、`36px`（超大号） |

**Props 维度**：`type`（image/character/icon）、`shape`（circle/square）、`size`（small/default/large/xlarge）、`status`（online/offline/busy）

---

### 4.32 穿梭框（Transfer）

**图层数**：1409 | **画板高度**：6277px

| CSS 属性 | 值 |
|---|---|
| 面板背景 | `rgb(255, 255, 255)` |
| 选中行背景 | `rgb(236, 242, 254)` |
| 分割线（行） | `inset 0px 1px 0px 0px rgb(245, 245, 245)` |
| 默认边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 圆角 | `4px`（主）、`2px`（搜索框内标签） |
| 主字号 | `14px` |

**Props 维度**：`mode`（default/withSearch/withTree）、`size`

---

### 4.33 步骤条（Steps）

**图层数**：254 | **画板高度**：2619px

| CSS 属性 | 值 |
|---|---|
| 当前步骤色 | `rgb(44, 104, 255)` |
| 完成步骤色 | `rgb(44, 104, 255)` |
| 错误步骤色 | `rgb(227, 77, 89)` / `rgb(241, 81, 81)` |
| 等待步骤色 | `rgb(220, 220, 220)` |
| 圆角 | `16px`（步骤节点圆圈） |
| 字号 | `16px`（标题）、`14px`（描述） |

**Props 维度**：`direction`（horizontal/vertical）、`status`（wait/process/finish/error）、`type`（default/dot）

---

### 4.34 颜色选择器（ColorPicker）

**图层数**：530 | **画板高度**：2408px

| CSS 属性 | 值 |
|---|---|
| 圆角 | `2px`（颜色格）、`4px`（输入框）、`6px`（面板） |
| 面板边框 | `inset 0 0 0 0.5px rgb(220,220,220)` |
| 面板阴影 | `0 1px 10px 0px rgba(0,0,0,0.05)` |
| 激活边框 | `inset 0 0 0 1px rgb(44, 104, 255)` |
| 字号 | `12px`（颜色值输入）、`14px`（标签） |

**Props 维度**：`mode`（solid/gradient）、`format`（hex/rgb）、`showAlpha`、`presets`

---

### 4.35 滑块（Slider）

**图层数**：334 | **画板高度**：3744px

| CSS 属性 | 值 |
|---|---|
| 进度轨道色 | `rgb(44, 104, 255)` |
| 未选中轨道 | `rgb(231, 231, 231)` |
| 禁用轨道 | `rgb(221, 221, 221)` |
| 滑块背景 | `rgb(255, 255, 255)` |
| 圆角（轨道） | `4px` |
| 刻度字号 | `12px`（Gilroy-ExtraBold for 数字刻度） |

**Props 维度**：`direction`（horizontal/vertical）、`mode`（single/range）、`marks`（带刻度）、`withInput`（带数字输入框）

---

### 4.36 对话区域卡片（ConversationCard）

**图层数**：1012 | **画板高度**：4656px

| CSS 属性 | 值 |
|---|---|
| 面板背景 | `rgb(255, 255, 255)` |
| 主色 | `rgb(44, 104, 255)` |
| 分割线边框 | `1px solid rgb(220, 220, 220)` |
| 卡片阴影 | `0px 2px 16px 0px rgba(0,0,0,0.04)` |
| 圆角 | `8px`（卡片）、`16px`（大圆角容器）、`3px`（消息气泡） |
| 字号 | `14px`（主体）、`12px`（时间戳）、`16px`（标题） |
| 字体 | `PingFangSC-Medium`（消息标题）、`PingFangSC-Regular`（正文） |

---

### 4.37 水印（Watermark）

**图层数**：72 | **画板高度**：1464px

| 参数 | 值 |
|---|---|
| 字体 | `jingdonglangzhengti2-Semilight` |
| 字号 | `12px` |
| 颜色 | `rgb(187, 187, 187)` |
| 透明度 | `0.16`（约 16%） |
| 倾斜角度 | `-24deg` |
| 水平间距 | `192px` |
| 垂直间距 | `192px` |
| 容器圆角 | `16px` |

---

### 4.38 联系人选择器（ContactPicker）

**图层数**：409 | **画板高度**：4578px

| CSS 属性 | 值 |
|---|---|
| 头像背景 | `rgb(216, 216, 216)` |
| 主色 | `rgb(44, 104, 255)` |
| 选中圈 | `0 0 0 1px rgb(255, 255, 255)`（白色外描边） |
| 面板阴影 | `inset 0 0 0 0.5px rgb(220,220,220), 0px 8px 30px 0px rgba(0,0,0,0.10)` |
| 圆角 | `4px`（列表项）、`8px`（面板）、`16px`（容器） |
| 字号 | `12px`（辅助）、`14px`（主）、`16px`（标题） |

**Props 维度**：`scene`（form/filter）、`size`、`multiple`

---

### 4.39 图片查看器（ImageViewer）

**图层数**：597 | **画板高度**：6536px

| CSS 属性 | 值 |
|---|---|
| 背景遮罩 | `rgba(0,0,0,0.7~0.9)` |
| 工具栏背景 | `rgb(245, 245, 245)` / `rgb(243, 243, 243)` |
| 缩略图边框 | `inset 0 0 0 1px rgb(220, 220, 220)` |
| 激活缩略图 | `1px solid rgb(0, 82, 217)` |
| 圆角 | `3px`（工具按钮）、`4px`（缩略图）、`5px`（特殊框） |
| 字号 | `12px`（页码）、`14px`（信息）、`16px`（操作文字） |
| 展示数字字体 | `JDZhengHT-Regular` |

**Props 维度**：`mode`（thumbnail/expanded/horizontal/inBox）、`status`（loading/error）、`listPreview`

---

### 4.40 抽屉（Drawer）

**图层数**：193 | **画板高度**：7488px

| CSS 属性 | 值 |
|---|---|
| 内容背景 | `rgb(255, 255, 255)` |
| 头部分割线 | `inset 0px 1px 0px 0px rgb(231, 231, 231)` |
| 阴影 | `0px -1px 8px 0px rgba(0,0,0,0.04)` |
| 关闭按钮背景 | `rgb(229, 231, 236)` |
| macOS 控制点 | 红 `rgb(255, 97, 89)` / 黄 `rgb(255, 193, 48)` / 绿 `rgb(40, 202, 65)` |
| 圆角 | `3px`（内容区标签）、`14px`（面板圆角） |
| 标题字号 | `16px`（Semibold）、`14px`（子内容） |

**Props 维度**：`placement`（left/right/top/bottom）、`width`/`height`、`mask`、`closable`

---

### 4.41 审批（Approval）

**图层数**：640 | **画板高度**：3872px

| CSS 属性 | 值 |
|---|---|
| 通过色 | `rgb(74, 182, 113)` / `rgb(0, 168, 112)` |
| 待处理色 | `rgb(44, 104, 255)` |
| 节点背景 | `rgb(250, 251, 252)` |
| 节点阴影 | `inset 0 0 0 1px rgb(245,245,245), 0px 2px 16px 0px rgba(0,0,0,0.04)` |
| 节点圆角 | `8px` |
| 字号 | `14px`（主）、`12px`（辅）、`16px`（标题）、`24px`（步骤标号） |

**Props 维度**：`direction`（horizontal/vertical）、`showAvatar`、`status`（pending/approved/rejected/transfer）

---

## 5. 交互状态通用定义

以下状态机适用于全部表单域组件（输入框、选择器、级联选择器、数字输入框、搜索框、穿梭框等）：

| 状态 | 边框/阴影 | 背景 |
|---|---|---|
| `default` | `inset 0 0 0 1px rgb(220, 220, 220)` | `#FFFFFF` |
| `hover` | `inset 0 0 0 1px rgb(44, 104, 255)` | `#FFFFFF` |
| `focus` | `inset 0 0 0 1px rgb(44, 104, 255)` + `0 0 0 2px rgb(212, 227, 252)` | `#FFFFFF` |
| `filled` | `inset 0 0 0 1px rgb(220, 220, 220)` | `#FFFFFF` |
| `readOnly` | `inset 0 0 0 1px rgb(220, 220, 220)` | `rgb(249, 250, 252)` |
| `disabled` | `inset 0 0 0 1px rgb(220, 220, 220)` | `rgb(249, 250, 252)` |
| `error` | `inset 0 0 0 1px rgb(241, 81, 81)` | `#FFFFFF` |
| `success` | `inset 0 0 0 1px rgb(0, 168, 112)` | `#FFFFFF` |

---

## 6. 建议落地方式

### 6.1 Design Token 分层建议

```
global
  └─ color: primary, success, warning, error, neutral-*
  └─ font: size-*, family-*, weight-*
  └─ radius: sm, base, md, lg, xl, switch, full
  └─ shadow: card, dropdown, tooltip, focus, drawer

semantic
  └─ form-border-default  → global.shadow.form-default
  └─ form-border-focus    → global.shadow.form-focus
  └─ form-bg-disabled     → global.color.neutral-100
  └─ status-*-color       → global.color.*
```

### 6.2 组件 Props 统一维度

所有组件建议统一以下 Props 维度，便于文档和代码对齐：

| 维度 | 建议值 |
|---|---|
| `size` | `small / middle / large` |
| `status` | `default / hover / focus / filled / disabled / readOnly / error / success` |
| `type` / `variant` | 组件特定（primary/secondary/text/danger…） |
| `theme` | `light / dark`（有深色背景变体时） |
| `shape` | `default / round / circle` |

### 6.3 优先级建议

1. **先建 Token**：颜色、字号、圆角（已有完整数据，可直接导出）
2. **次建通用状态机**：基于 box-shadow 实现边框，统一焦点环逻辑
3. **再对齐组件 API**：输入类组件优先（输入框、选择器、搜索框、数字输入框）
4. **最后完善展示类**：表格、树结构、图片查看器等复杂展示组件

---

## 7. 备注

- `筛选备份` 是 `筛选` 的早期存档版本，研发侧以 `筛选` 为准。
- 全画板颜色最高频（7,003 次）的 `rgb(0,0,0)` 为文字默认黑色，已在上方颜色系统中以 `color-text-primary` 收录，不计入特殊 token。
- 所有 `1px solid rgb(151, 151, 151)` 为 Figma **设计稿专用描边标注层**，非组件实际边框。
- 图层总数：`25,586`；含 CSS 图层数：`25,432`（覆盖率 99.4%）。
