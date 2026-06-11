import { SketchConfigAnalyzer } from '../../core/analyzer';
import { ToolManager } from '../../tools';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcError } from '../../core/types';
import { loadSketchConfigFromPath } from '../../core/file';

/**
 * MCP服务器实现
 */
export class McpServer {
  private analyzer: SketchConfigAnalyzer;
  private toolManager: ToolManager;

  constructor() {
    this.analyzer = new SketchConfigAnalyzer();
    this.toolManager = new ToolManager(this.analyzer);
  }

  /**
   * 设置分析器实例
   */
  setAnalyzer(analyzer: SketchConfigAnalyzer): void {
    this.analyzer = analyzer;
    this.toolManager = new ToolManager(this.analyzer);
  }

  /**
   * 处理JSON-RPC请求
   * 注意：对于 notification（如 notifications/initialized），processMethod 会返回 null，
   * 此函数同样返回 null，由调用方（mcp-stdio）决定是否写回。
   */
  async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    try {
      const result = await this.processMethod(request.method, request.params);
      if (result === null) {
        return null;
      }
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      const errorResponse: JsonRpcError = {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      };
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: errorResponse
      };
    }
  }

  /**
   * 处理具体的方法调用
   */
  private async processMethod(method: string, params: any): Promise<any> {
    switch (method) {
      case 'initialize': {
        // 协议版本协商：客户端请求的版本若被支持则原样返回，否则退回到 2025-03-26
        const requestedVersion = params?.protocolVersion || '2024-11-05';
        const supportedVersions = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'];
        const negotiatedVersion = supportedVersions.includes(requestedVersion)
          ? requestedVersion
          : '2025-03-26';
        return {
          protocolVersion: negotiatedVersion,
          capabilities: {
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: {
            name: 'sketch-mcp-server',
            version: '1.0.0'
          }
        };
      }

      case 'notifications/initialized':
        // notification 没有响应
        return null;

      case 'ping':
        return {};

      case 'prompts/list':
        return { prompts: [] };

      case 'resources/list':
        return { resources: [] };

      case 'sketch/analyze':
        if (!params?.config) {
          throw new Error('Missing config parameter');
        }
        return this.analyzer.analyzeConfig(params.config);

      case 'sketch/analyzePath':
        if (!params?.path) {
          throw new Error('Missing path parameter');
        }
        try {
          const config = await loadSketchConfigFromPath(params.path);
          return this.analyzer.analyzeConfig(config);
        } catch (error) {
          throw new Error(`Failed to analyze path: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

      case 'tools/list':
        return {
          tools: this.toolManager.getToolDefinitions()
        };

      case 'tools/call':
        if (!params?.name) {
          throw new Error('Missing tool name');
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await this.toolManager.callTool(params.name, params.arguments || {}), null, 2)
            }
          ]
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }
}
