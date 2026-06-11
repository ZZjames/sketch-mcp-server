/**
 * 独立 stdio MCP 服务器（v1.4.0 引入，目前为孤儿入口，未被 package.json bin/main 使用）
 *
 * 使用旧的 method 命名（sketch/analyze、sketch/analyzePath、tools/list 返回 input_schema）。
 * 为对齐 backup dist 行为保留 src 文件。
 */
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import extract from 'extract-zip';
import { SketchConfigAnalyzer } from '../core/analyzer';
import { createNodePositionTool } from '../tools';

const analyzer = new SketchConfigAnalyzer();
const tools = createNodePositionTool(analyzer);

function writeResponse(res: any) {
    const payload = JSON.stringify(res);
    process.stdout.write(payload + '\n');
}

function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

async function maybeUnzipSketchArchive(inputPath: string): Promise<string | null> {
    const lower = inputPath.toLowerCase();
    if (lower.endsWith('.sketch') || lower.endsWith('.sketon') || lower.endsWith('.zip')) {
        const abs = path.resolve(inputPath);
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-mcp-'));
        await extract(abs, { dir: tempDir });
        return tempDir;
    }
    return null;
}

function loadSketchConfigFromDir(directoryPath: string): any {
    const documentPath = path.join(directoryPath, 'document.json');
    const pagesDir = path.join(directoryPath, 'pages');
    if (!isFile(documentPath)) {
        throw new Error(`document.json not found in ${directoryPath}`);
    }
    const document = JSON.parse(fs.readFileSync(documentPath, 'utf-8'));
    let pages: any[] = [];
    if (isDirectory(pagesDir)) {
        const files = fs.readdirSync(pagesDir).filter((f: string) => f.endsWith('.json'));
        pages = files.map((f: string) => JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf-8')));
    }
    return { document: { id: document?.do_objectID || document?.id || 'doc', name: document?.name || 'Sketch', pages } };
}

async function loadSketchConfigFromPath(inputPath: string): Promise<any> {
    const abs = path.resolve(inputPath);
    const maybeDir = await maybeUnzipSketchArchive(abs);
    if (maybeDir) {
        return loadSketchConfigFromDir(maybeDir);
    }
    if (isFile(abs)) {
        const content = fs.readFileSync(abs, 'utf-8');
        return JSON.parse(content);
    }
    if (isDirectory(abs)) {
        return loadSketchConfigFromDir(abs);
    }
    throw new Error(`Path not found: ${inputPath}`);
}

function handleRequest(req: any) {
    const respond = (result: any) => writeResponse({ jsonrpc: '2.0', id: req.id, result });
    const respondError = (code: number, message: string, data?: any) =>
        writeResponse({ jsonrpc: '2.0', id: req.id, error: { code, message, data } });
    try {
        switch (req.method) {
            case 'initialize': {
                return respond({
                    serverInfo: { name: 'sketch-mcp-server', version: '1.0.0' }
                });
            }
            case 'shutdown': {
                return respond({ ok: true });
            }
            case 'sketch/analyze': {
                const config = req.params?.config;
                const summary = analyzer.analyzeConfig(config);
                return respond({ summary });
            }
            case 'sketch/analyzePath': {
                const inputPath = req.params?.path;
                if (!inputPath) return respondError(-32602, 'Missing path');
                (async () => {
                    const config = await loadSketchConfigFromPath(inputPath);
                    const summary = analyzer.analyzeConfig(config);
                    respond({ summary });
                })().catch((e: any) => respondError(-32000, e?.message || 'Failed to analyze path'));
                return;
            }
            case 'tools/list': {
                return respond({
                    tools: [
                        {
                            name: 'getNodePosition',
                            description: 'Get the absolute position of a node by id',
                            input_schema: {
                                type: 'object',
                                required: ['nodeId'],
                                properties: { nodeId: { type: 'string' } }
                            }
                        },
                        {
                            name: 'getNodeInfo',
                            description: 'Get basic info of a node by id',
                            input_schema: {
                                type: 'object',
                                required: ['nodeId'],
                                properties: { nodeId: { type: 'string' } }
                            }
                        },
                        {
                            name: 'findNodesByName',
                            description: 'Find nodes by exact name',
                            input_schema: {
                                type: 'object',
                                required: ['name'],
                                properties: { name: { type: 'string' } }
                            }
                        }
                    ]
                });
            }
            case 'tools/call': {
                const name = req.params?.name;
                const args = req.params?.arguments || {};
                if (name === 'getNodePosition') {
                    return respond({ result: tools.getNodePosition(String(args.nodeId || '')) });
                }
                if (name === 'getNodeInfo') {
                    return respond({ result: tools.getNodeInfo(String(args.nodeId || '')) });
                }
                if (name === 'findNodesByName') {
                    return respond({ result: tools.findNodesByName(String(args.name || '')) });
                }
                return respondError(-32601, `Unknown tool: ${name}`);
            }
            default:
                return respondError(-32601, `Unknown method: ${req.method}`);
        }
    } catch (e: any) {
        return respondError(-32000, e?.message || 'Server error');
    }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line: string) => {
    if (!line.trim()) return;
    let msg: any = null;
    try {
        msg = JSON.parse(line);
    } catch (e) {
        writeResponse({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } });
        return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') {
        writeResponse({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' } });
        return;
    }
    handleRequest(msg);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
