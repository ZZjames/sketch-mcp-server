# Sketch MCP 服务器

[English](./README.md) | **中文**

一个基于模型上下文协议（MCP）的 Sketch 文件处理服务器，专为 AI 工具设计，支持智能分析 Sketch 设计文件并生成代码。

## ✨ 核心特性

- 🎨 **Sketch 文件分析**：全面解析 Sketch 文件，提取节点、样式、层级等完整信息
- 🚀 **Token 智能优化**：最高可减少 90% 的 Token 消耗，大幅降低 AI 调用成本
- 🔍 **智能查询系统**：16 个专业工具，高效发现和分析设计元素
- 🎯 **Symbol 组件支持**：完整的 Symbol Master 和 Instance 处理能力
- 🖼️ **可视化渲染**：将设计节点渲染为 SVG/PNG 图像供 AI 分析
- 📊 **详细统计分析**：提供文档和节点的全面统计信息
- 🔧 **CLI 工具支持**：支持 npx 直接调用，无需安装

## 📦 安装方式

### 全局安装（推荐）

```bash
npm install -g sketch-mcp-server
```

### 使用 npx（无需安装）

```bash
npx sketch-mcp-server
```

### 本地项目安装

```bash
npm install sketch-mcp-server
```

## 🚀 快速开始

### 命令行启动

```bash
# 启动 MCP 服务器（stdio 模式）
sketch-mcp-server

# 或使用 npx
npx sketch-mcp-server
```

### AI 工具集成

本服务器专为以下 AI 开发环境设计：

- **Trae AI**：作为 MCP 服务器进行 Sketch 文件分析
- **Cursor**：配置为 MCP 工具实现设计到代码的工作流
- **Claude Desktop**：用于 Sketch 文件处理和分析

### Trae AI 配置示例

在 Trae AI 中添加 MCP 服务器配置：

```json
{
  "mcpServers": {
    "sketch-mcp-server": {
      "command": "npx",
      "args": ["sketch-mcp-server"]
    }
  }
}
```

## 🛠️ 工具列表

### 📁 文件加载工具

| 工具名称 | 功能描述 |
|---------|----------|
| `loadSketchByPath` | 从文件系统加载 Sketch 文件 |
| `loadSketchByConfig` | 从配置对象加载 Sketch 数据 |

### 📊 文档结构工具

| 工具名称 | 功能描述 | 优化特性 |
|---------|----------|----------|
| `getDocumentStructure` | 获取完整文档层级结构 | 🚀 支持字段过滤和摘要模式 |
| `getPageStructure` | 获取单个页面结构 | - |
| `listPages` | 列出所有页面基本信息 | - |

### 🎯 节点查询工具

| 工具名称 | 功能描述 | Token 优化 |
|---------|----------|------------|
| `getNodesSummary` | **智能节点摘要** | 🔥 减少 80-90% Token |
| `listNodes` | 列出节点（支持过滤） | - |
| `listNodesByPage` | 按页面列出节点 | - |
| `findNodesByName` | 按名称搜索节点 | - |

### 🔍 详细信息工具

| 工具名称 | 功能描述 |
|---------|----------|
| `getNodeInfo` | 获取单个节点详细信息 |
| `getMultipleNodeInfo` | 批量获取节点信息（最多100个） |
| `getNodePosition` | 获取节点位置信息 |

### 🔄 Symbol 组件工具

| 工具名称 | 功能描述 |
|---------|----------|
| `getSymbolMasters` | 获取所有 Symbol Master |
| `getSymbolInstances` | 获取所有 Symbol Instance |
| `getSymbolMasterBySymbolID` | 根据 Symbol ID 查找 Master |
| `getSymbolInstanceStyles` | 获取实例样式（含覆盖样式） |

### 🎨 可视化工具

| 工具名称 | 功能描述 |
|---------|----------|
| `renderNodeAsBase64` | 将节点渲染为图像（SVG/PNG） |

## 💡 Token 优化策略

### 数据量对比

| 工具/模式 | Token 减少 | 适用场景 |
|-----------|------------|----------|
| `getNodesSummary` | 80-90% | 初步分析、了解整体结构 |
| `getDocumentStructure`（摘要模式） | 70-85% | 快速了解文档结构 |
| `getDocumentStructure`（字段过滤） | 30-50% | 结构分析 |
| 完整模式 | 0% | 详细设计需求 |

### 推荐工作流程

1. **🔍 快速分析**：使用 `getNodesSummary` 了解整体设计结构
2. **📋 结构分析**：使用字段过滤的 `getDocumentStructure` 获取层级关系
3. **🎯 详细信息**：按需获取特定节点的详细信息
4. **👁️ 可视化验证**：渲染关键组件确认效果

## 📝 使用示例

### 基础工作流程

```javascript
// 1. 加载 Sketch 文件
{
  "name": "loadSketchByPath",
  "arguments": {
    "path": "/path/to/design.sketch"
  }
}

// 2. 获取智能摘要（节省 80-90% Token）
{
  "name": "getNodesSummary",
  "arguments": {
    "groupBy": "type",
    "includeStats": true,
    "maxSamples": 5
  }
}

// 3. 获取特定节点详细信息
{
  "name": "getMultipleNodeInfo",
  "arguments": {
    "nodeIds": ["button-id", "text-id"]
  }
}

// 4. 渲染节点为图像
{
  "name": "renderNodeAsBase64",
  "arguments": {
    "nodeId": "button-id",
    "format": "svg"
  }
}
```

### 高级优化示例

```javascript
// 使用字段过滤减少数据量
{
  "name": "getDocumentStructure",
  "arguments": {
    "fields": ["id", "name", "type", "children"],
    "maxDepth": 3,
    "summaryMode": false
  }
}

// 按样式分组的智能摘要
{
  "name": "getNodesSummary",
  "arguments": {
    "groupBy": "style",
    "includeStats": true,
    "maxSamples": 3
  }
}
```

## 🎯 工具选择指南

| 使用需求 | 推荐工具 | Token 效率 | 说明 |
|----------|----------|------------|------|
| 了解整体结构 | `getNodesSummary` | ⭐⭐⭐⭐⭐ | 最高效的概览方式 |
| 分析页面层级 | `getDocumentStructure`（过滤） | ⭐⭐⭐⭐ | 结构化层级信息 |
| 查找特定节点 | `findNodesByName` | ⭐⭐⭐ | 精确搜索 |
| 获取详细信息 | `getMultipleNodeInfo` | ⭐⭐ | 批量获取 |
| 处理 Symbol 组件 | `getSymbolMasters` | ⭐⭐⭐ | 组件化设计 |
| 可视化确认 | `renderNodeAsBase64` | ⭐⭐ | 直观查看效果 |

## 🔧 开发指南

### 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 本地开发

```bash
# 克隆项目
git clone https://github.com/mater1996/sketch-mcp-server.git
cd sketch-mcp-server

# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test

# 启动开发服务器
npm run start:mcp
```

### 可用脚本

```bash
npm run build          # 构建 TypeScript 到 JavaScript
npm run test           # 运行测试套件
npm run test:coverage  # 运行测试并生成覆盖率报告
npm run start          # 启动 HTTP 服务器
npm run start:mcp      # 启动 MCP stdio 服务器
npm run release        # 发布新版本
npm run release:dry    # 模拟发布流程
```

## 📚 API 参考

详细的 API 文档请参考 [工具使用指南](./mcp-prompt.txt)。

### 开发规范

- 使用 TypeScript 编写代码
- 遵循现有的代码风格
- 为新功能添加测试
- 更新相关文档
