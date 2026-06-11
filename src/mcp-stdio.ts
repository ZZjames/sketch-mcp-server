#!/usr/bin/env node

import { McpServer } from './server/mcp/mcpServer';
import { SketchConfigAnalyzer } from './core/analyzer';
import { JsonRpcRequest, JsonRpcResponse } from './core/types';

/**
 * MCP stdio服务器入口
 * 用于Cursor和Trae等IDE的MCP集成
 *
 * v1.2.1 关键改动：
 *  - 使用 buffer 暂存跨 chunk 的不完整行，避免 JSON 解析失败
 *  - response === null 时不发送（支持 notifications/initialized 等通知）
 *  - 解析错误时尽量保留原请求 id
 */
class StdioMcpServer {
  private mcpServer: McpServer;
  private analyzer: SketchConfigAnalyzer;

  constructor() {
    this.analyzer = new SketchConfigAnalyzer();
    this.mcpServer = new McpServer();
    this.mcpServer.setAnalyzer(this.analyzer);
  }

  /**
   * 启动stdio服务器
   */
  start() {
    console.error('[MCP] Sketch MCP Server starting in stdio mode...');

    let buffer = '';

    const sendResponse = (response: JsonRpcResponse) => {
      const body = JSON.stringify(response);
      process.stdout.write(body + '\n');
    };

    const processMessage = async (jsonStr: string): Promise<void> => {
      try {
        const request: JsonRpcRequest = JSON.parse(jsonStr);
        const response = await this.mcpServer.handleRequest(request);

        // notification 等无响应场景，handleRequest 返回 null，跳过写回
        if (response !== null) {
          sendResponse(response);
        }
      } catch (error) {
        console.error('[MCP] Error processing request:', error);

        // 尝试保留原 id，否则返回 null
        let id: any = null;
        try {
          id = JSON.parse(jsonStr).id;
        } catch (_) {
          /* ignore */
        }

        sendResponse({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    };

    // 监听stdin输入
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      // 最后一段保留为下一轮 buffer（可能是不完整行）
      buffer = lines.pop() as string;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          await processMessage(trimmed);
        }
      }
    });

    // 处理进程退出
    process.on('SIGINT', () => {
      console.error('[MCP] Server shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('[MCP] Server shutting down...');
      process.exit(0);
    });

    // 保持进程运行
    process.stdin.resume();

    console.error('[MCP] Server ready and listening on stdio');
  }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  const server = new StdioMcpServer();
  server.start();
}

export { StdioMcpServer };
