---
name: jd-finance-b-design-spec
description: Extracts and structures JD Finance B-end design specifications from Figma into implementation-ready markdown. Use when the user asks for 京东金融B端设计规范, Figma规范整理, 组件规范清单, design token extraction, or per-layer CSS property exports.
---

# JD Finance B-End Design Spec

## Purpose

Convert JD Finance B-end Figma files into consistent, engineering-ready specification documents.

## When To Use

Use this skill when the user requests:

- 京东金融 B 端设计规范整理
- Figma 组件规范文档
- Design Token 提取（颜色、字号、圆角、边框等）
- 全图层 CSS 属性导出
- 可下载 Markdown 规范文件

## Required Inputs

- Figma URL (preferably with `node-id`)
- Desired output type:
  - `overview-spec` (组件规范总览)
  - `full-layer-css` (逐层 CSS 属性清单)
  - `both`
- Output language (default: Chinese)

## Output Files

Create markdown files in project root:

- `figma-<project>-规范整理.md` for overview spec
- `figma-<project>-全图层CSS属性逐层清单.md` for full layer css

## Workflow

1. Parse the Figma URL and locate selected node.
2. Extract design data from Figma MCP with framework `html`.
3. Build component inventory from top-level children.
4. For overview:
   - list all modules
   - collect visible variant/type/state labels from text layers
   - aggregate base style frequencies from tokens/css
5. For full-layer CSS:
   - traverse all nodes recursively
   - output one section per layer path
   - include `id`, `type`, `css`, and `bounds`
6. Save markdown files and report exact file paths.

## Formatting Rules

- Do not omit requested sections.
- If user says "不要概括", include every layer; no summarization.
- Use backticks for all property names and literal values.
- Keep heading numbering stable and deterministic.

## Overview Spec Template

```markdown
# <项目名> 设计规范整理

## 1. 文档说明
- 来源链接
- 适用范围

## 2. 基础样式基线
- 高频颜色
- 高频字号/行高
- 圆角与边框

## 3. 组件总目录
1. ...

## 4. 各组件规范要点
### 4.1 ...
- ...
```

## Full-Layer CSS Template

```markdown
# <项目名> 全图层 CSS 属性逐层清单

- 总图层数：`N`
- 含 CSS 的图层数：`M`

## 1. `<path>`
- `id`: `...`
- `type`: `...`
- `css`:
  - `width`: `...`
  - `height`: `...`
- `bounds`:
  - `x`: `...`
  - `y`: `...`
  - `width`: `...`
  - `height`: `...`
```

## Quality Checklist

- URL and node-id are recorded.
- File contains requested scope (`overview-spec` / `full-layer-css` / `both`).
- If full-layer mode: every traversed node has an entry.
- No fabricated style values.
- Final response includes downloadable local file paths.
