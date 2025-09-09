# Sketch MCP Server

**English** | [中文](./README.cn.md)

A Sketch file processing server based on Model Context Protocol (MCP), designed for AI tools to intelligently analyze Sketch design files and generate code.

## ✨ Core Features

- 🎨 **Sketch File Analysis**: Comprehensive parsing of Sketch files, extracting nodes, styles, hierarchies, and complete information
- 🚀 **Smart Token Optimization**: Up to 90% token consumption reduction, significantly lowering AI call costs
- 🔍 **Intelligent Query System**: 16 professional tools for efficient discovery and analysis of design elements
- 🎯 **Symbol Component Support**: Complete Symbol Master and Instance processing capabilities
- 🖼️ **Visual Rendering**: Render design nodes as SVG/PNG images for AI analysis
- 📊 **Detailed Statistical Analysis**: Comprehensive statistics for documents and nodes
- 🔧 **CLI Tool Support**: Support for direct npx calls without installation

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g sketch-mcp-server
```

### Using npx (No Installation Required)

```bash
npx sketch-mcp-server
```

### Local Project Installation

```bash
npm install sketch-mcp-server
```

## 🚀 Quick Start

### Command Line Launch

```bash
# Start MCP server (stdio mode)
sketch-mcp-server

# Or use npx
npx sketch-mcp-server
```

### AI Tool Integration

This server is designed for the following AI development environments:

- **Trae AI**: As an MCP server for Sketch file analysis
- **Cursor**: Configure as MCP tool for design-to-code workflow
- **Claude Desktop**: For Sketch file processing and analysis

### Trae AI Configuration Example

Add MCP server configuration in Trae AI:

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

## 🛠️ Tool List

### 📁 File Loading Tools

| Tool Name | Description |
|-----------|-------------|
| `loadSketchByPath` | Load Sketch file from file system |
| `loadSketchByConfig` | Load Sketch data from configuration object |

### 📊 Document Structure Tools

| Tool Name | Description | Optimization Features |
|-----------|-------------|----------------------|
| `getDocumentStructure` | Get complete document hierarchy | 🚀 Supports field filtering and summary mode |
| `getPageStructure` | Get single page structure | - |
| `listPages` | List all page basic information | - |

### 🎯 Node Query Tools

| Tool Name | Description | Token Optimization |
|-----------|-------------|-------------------|
| `getNodesSummary` | **Smart Node Summary** | 🔥 80-90% Token Reduction |
| `listNodes` | List nodes (with filtering support) | - |
| `listNodesByPage` | List nodes by page | - |
| `findNodesByName` | Search nodes by name | - |

### 🔍 Detailed Information Tools

| Tool Name | Description |
|-----------|-------------|
| `getNodeInfo` | Get detailed information for single node |
| `getMultipleNodeInfo` | Batch get node information (up to 100) |
| `getNodePosition` | Get node position information |

### 🔄 Symbol Component Tools

| Tool Name | Description |
|-----------|-------------|
| `getSymbolMasters` | Get all Symbol Masters |
| `getSymbolInstances` | Get all Symbol Instances |
| `getSymbolMasterBySymbolID` | Find Master by Symbol ID |
| `getSymbolInstanceStyles` | Get instance styles (including override styles) |

### 🎨 Visualization Tools

| Tool Name | Description |
|-----------|-------------|
| `renderNodeAsBase64` | Render node as image (SVG/PNG) |

## 💡 Token Optimization Strategy

### Data Volume Comparison

| Tool/Mode | Token Reduction | Use Case |
|-----------|----------------|----------|
| `getNodesSummary` | 80-90% | Initial analysis, understanding overall structure |
| `getDocumentStructure` (summary mode) | 70-85% | Quick document structure overview |
| `getDocumentStructure` (field filtering) | 30-50% | Structural analysis |
| Full mode | 0% | Detailed design requirements |

### Recommended Workflow

1. **🔍 Quick Analysis**: Use `getNodesSummary` to understand overall design structure
2. **📋 Structure Analysis**: Use field-filtered `getDocumentStructure` to get hierarchical relationships
3. **🎯 Detailed Information**: Get detailed information for specific nodes as needed
4. **👁️ Visual Verification**: Render key components to confirm effects

## 📝 Usage Examples

### Basic Workflow

```javascript
// 1. Load Sketch file
{
  "name": "loadSketchByPath",
  "arguments": {
    "path": "/path/to/design.sketch"
  }
}

// 2. Get smart summary (save 80-90% tokens)
{
  "name": "getNodesSummary",
  "arguments": {
    "groupBy": "type",
    "includeStats": true,
    "maxSamples": 5
  }
}

// 3. Get detailed information for specific nodes
{
  "name": "getMultipleNodeInfo",
  "arguments": {
    "nodeIds": ["button-id", "text-id"]
  }
}

// 4. Render node as image
{
  "name": "renderNodeAsBase64",
  "arguments": {
    "nodeId": "button-id",
    "format": "svg"
  }
}
```

### Advanced Optimization Examples

```javascript
// Use field filtering to reduce data volume
{
  "name": "getDocumentStructure",
  "arguments": {
    "fields": ["id", "name", "type", "children"],
    "maxDepth": 3,
    "summaryMode": false
  }
}

// Smart summary grouped by style
{
  "name": "getNodesSummary",
  "arguments": {
    "groupBy": "style",
    "includeStats": true,
    "maxSamples": 3
  }
}
```

## 🎯 Tool Selection Guide

| Use Case | Recommended Tool | Token Efficiency | Description |
|----------|------------------|------------------|-------------|
| Understanding overall structure | `getNodesSummary` | ⭐⭐⭐⭐⭐ | Most efficient overview method |
| Analyzing page hierarchy | `getDocumentStructure` (filtered) | ⭐⭐⭐⭐ | Structured hierarchical information |
| Finding specific nodes | `findNodesByName` | ⭐⭐⭐ | Precise search |
| Getting detailed information | `getMultipleNodeInfo` | ⭐⭐ | Batch retrieval |
| Handling Symbol components | `getSymbolMasters` | ⭐⭐⭐ | Component-based design |
| Visual confirmation | `renderNodeAsBase64` | ⭐⭐ | Intuitive effect viewing |

## 🔧 Development Guide

### Environment Requirements

- Node.js >= 16.0.0
- npm or yarn

### Local Development

```bash
# Clone project
git clone https://github.com/mater1996/sketch-mcp-server.git
cd sketch-mcp-server

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Start development server
npm run start:mcp
```

### Available Scripts

```bash
npm run build          # Build TypeScript to JavaScript
npm run test           # Run test suite
npm run test:coverage  # Run tests and generate coverage report
npm run start          # Start HTTP server
npm run start:mcp      # Start MCP stdio server
npm run release        # Release new version
npm run release:dry    # Simulate release process
```

## 📚 API Reference

For detailed API documentation, please refer to [Tool Usage Guide](./mcp-prompt.en.txt).

### Development Standards

- Write code in TypeScript
- Follow existing code style
- Add tests for new features
- Update relevant documentation

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

If you encounter any issues or have questions, please:

1. Check the [documentation](./mcp-prompt.en.txt)
2. Search existing [issues](https://github.com/mater1996/sketch-mcp-server/issues)
3. Create a new issue if needed

---

**Made with ❤️ for the design-to-code community**
