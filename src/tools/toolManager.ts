import { SketchConfigAnalyzer } from '../core/analyzer';
import { Tool } from '../core/types';
import { NodesSummaryTool } from './nodesSummaryTool';
import { IconMatcherTool } from './iconMatcherTool';

/**
 * 工具管理器，统一管理所有MCP工具
 *
 * v1.3.x 整合：
 *  - listNodes/listNodesByPage/findNodesByName 合并为 queryNodes（mode=nameSearch|pageQuery|globalQuery 自动判断）
 *  - getNodeIdList + getNodesSummary 合并为 getPageStructure（mode=tree|ids|summary）
 *  - getSymbolMasters + getSymbolInstances 合并为 getSymbols（type=master|instance）
 *  - getMultipleNodeInfo 自动分批，去除 100 条上限
 *  - 新增：extractBitmaps、matchIconFromName、getShapePathData
 */
export class ToolManager {
    private analyzer: SketchConfigAnalyzer;
    private nodesSummaryTool: NodesSummaryTool;
    private iconMatcherTool: IconMatcherTool;

    constructor(analyzer: SketchConfigAnalyzer) {
        this.analyzer = analyzer;
        this.nodesSummaryTool = new NodesSummaryTool(analyzer);
        this.iconMatcherTool = new IconMatcherTool();
    }

    /**
     * 获取所有可用工具的定义
     */
    getToolDefinitions(): Tool[] {
        return [
            {
                name: 'loadSketchByPath',
                description: 'Load a Sketch file from a file path',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'The file path to the Sketch file' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'loadSketchByConfig',
                description: 'Load a Sketch configuration object',
                inputSchema: {
                    type: 'object',
                    properties: {
                        cfg: { type: 'object', description: 'The Sketch configuration object' }
                    },
                    required: ['cfg']
                }
            },
            {
                name: 'listPages',
                description: 'List all pages in the Sketch document',
                inputSchema: { type: 'object', properties: {} }
            },
            {
                name: 'queryNodes',
                description: 'Query nodes with filtering. Combines listNodes + listNodesByPage + findNodesByName into one tool. The `type` field accepts a string OR an array of strings (e.g., ["text","rectangle","group"]) to fetch multiple node types in one call.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: { type: 'string', description: 'Optional page ID to scope search. Omit for global search.' },
                        type: {
                            oneOf: [
                                { type: 'string' },
                                { type: 'array', items: { type: 'string' } }
                            ],
                            description: 'Filter by node type (e.g., "text", "rectangle", "artboard"). Pass an array to match multiple types: ["text","rectangle","group"].'
                        },
                        name: { type: 'string', description: 'Fuzzy name match (replaces findNodesByName)' },
                        nameContains: { type: 'string', description: 'Name contains this substring' },
                        limit: { type: 'number', description: 'Max results to return', default: 50 },
                        offset: { type: 'number', description: 'Number of results to skip', default: 0 }
                    }
                }
            },
            {
                name: 'getNodeInfo',
                description: 'Get detailed information about a node by its ID. Returns id, name, type, position, size, style (fills/borders/shadows/innerShadows for ALL node types including rectangle/group), parent ({id,name,type} for ancestry lookup - use this for element grouping, NOT x/y coordinates), and type-specific fields (text/shape/image/symbol/children).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        nodeId: { type: 'string', description: 'The ID of the node' }
                    },
                    required: ['nodeId']
                }
            },
            {
                name: 'getMultipleNodeInfo',
                description: 'Get detailed information for multiple nodes in a single call. Auto-batches in groups of 100. Each returned node includes parent ({id,name,type}) for ancestry-based grouping.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        nodeIds: { type: 'array', items: { type: 'string' }, description: 'Array of node IDs (auto-batched, no limit)' }
                    },
                    required: ['nodeIds']
                }
            },
            {
                name: 'getPageStructure',
                description: 'Get page data in 3 modes: "tree" (hierarchy), "ids" (flat ID list by type), "summary" (statistics). Replaces getNodeIdList + getNodesSummary.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pageId: { type: 'string', description: 'The ID of the page' },
                        mode: { type: 'string', enum: ['tree', 'ids', 'summary'], default: 'tree', description: '"tree": hierarchical structure, "ids": all IDs grouped by type, "summary": statistical grouping' },
                        fields: { type: 'array', items: { type: 'string' }, description: 'Fields to include per node in tree mode (e.g., ["id","name","type"])' },
                        groupBy: { type: 'string', enum: ['type', 'style', 'position', 'size'], default: 'type', description: 'Grouping for summary mode' },
                        maxDepth: { type: 'number', description: 'Max hierarchy depth in tree mode', default: 10 },
                        includeDetails: { type: 'boolean', description: 'Include detailed node info in tree mode', default: true },
                        maxSamples: { type: 'number', description: 'Max sample nodes per group in summary mode', default: 5 }
                    },
                    required: ['pageId']
                }
            },
            {
                name: 'getDocumentStructure',
                description: 'Get complete document structure with all pages and their hierarchies',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeDetails: { type: 'boolean', description: 'Include detailed node information', default: false },
                        maxNodesPerPage: { type: 'number', description: 'Max nodes per page', default: 200 },
                        fields: { type: 'array', items: { type: 'string' }, description: 'Fields to include (e.g., ["id","name","type"])' },
                        excludeFields: { type: 'array', items: { type: 'string' }, description: 'Fields to exclude (e.g., ["style","position"])' },
                        summaryMode: { type: 'boolean', description: 'Return summary instead of full structure', default: false },
                        maxDepth: { type: 'number', description: 'Max hierarchy depth', default: 3 },
                        groupSimilar: { type: 'boolean', description: 'Group similar nodes', default: false }
                    }
                }
            },
            {
                name: 'getSymbols',
                description: 'Get Symbol Masters or Instances from the Sketch document. Replaces getSymbolMasters + getSymbolInstances.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['master', 'instance'], default: 'master', description: '"master" for Symbol Masters, "instance" for Symbol Instances' }
                    }
                }
            },
            {
                name: 'getSymbolMasterBySymbolID',
                description: 'Get Symbol Master by its Symbol ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        symbolID: { type: 'string', description: 'The Symbol ID to search for' }
                    },
                    required: ['symbolID']
                }
            },
            {
                name: 'getSymbolInstanceStyles',
                description: 'Get styles from Symbol Instance including overrides applied to Symbol Master',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: { type: 'string', description: 'The ID of the Symbol Instance' }
                    },
                    required: ['instanceId']
                }
            },
            {
                name: 'renderNodeAsBase64',
                description: 'Render a node as Base64 encoded SVG image. Supports rectangle, oval, text, shapePath (with path data), group (recursive).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        nodeId: { type: 'string', description: 'The ID of the node to render' },
                        format: { type: 'string', enum: ['svg', 'png'], default: 'svg', description: 'Output format (only SVG supported)' }
                    },
                    required: ['nodeId']
                }
            },
            {
                name: 'extractBitmaps',
                description: 'Extract bitmap PNG resources from loaded .sketch file by node IDs. Returns base64-encoded images.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bitmapIds: { type: 'array', items: { type: 'string' }, description: 'Array of bitmap node IDs to extract' }
                    },
                    required: ['bitmapIds']
                }
            },
            {
                name: 'matchIconFromName',
                description: 'Match node names to iconfont icon library. Uses a scoring system that returns Top-3 candidates per name. Recognises compound semantics (e.g. "folder + add" → FolderAddOutlined) to avoid generic-keyword shadowing (e.g. "新增" alone → PlusOutlined). Returned shape: { results: [{nodeName, top3:[{source,score,iconType?,antdIcon?,matchedBy,rationale?}], bestMatch}], matchedIcons (Top-1 backward-compat), unmatched, recommendFallback }.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        nodeNames: { type: 'array', items: { type: 'string' }, description: 'Node names to match (e.g., ["表 icon", "编组11备份"])' },
                        library: { type: 'string', description: 'Iconfont library name', default: 'newFont' }
                    },
                    required: ['nodeNames']
                }
            },
            {
                name: 'getShapePathData',
                description: 'Extract SVG path data from shapePath nodes. Returns ready-to-use SVG path elements for code generation.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        nodeIds: { type: 'array', items: { type: 'string' }, description: 'Array of shapePath node IDs' }
                    },
                    required: ['nodeIds']
                }
            }
        ];
    }

    /**
     * 调用指定的工具
     */
    async callTool(name: string, args: any): Promise<any> {
        if (!this.analyzer.hasConfig()) {
            if (name !== 'loadSketchByPath' && name !== 'loadSketchByConfig' && name !== 'matchIconFromName') {
                throw new Error('No Sketch configuration loaded. Please load a Sketch file first.');
            }
        }
        switch (name) {
            case 'loadSketchByPath': {
                const { loadSketchConfigFromPath } = await import('../core/file');
                try {
                    const config = await loadSketchConfigFromPath(args.path);
                    const result = this.analyzer.analyzeConfig(config);
                    if ((config as any)._extractDir) {
                        (this.analyzer as any)._sketchExtractDir = (config as any)._extractDir;
                    }
                    return { pages: result.pages, layers: result.layers };
                } catch (error) {
                    throw new Error(`Failed to load Sketch file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            case 'loadSketchByConfig': {
                const result = this.analyzer.analyzeConfig(args.cfg);
                return { pages: result.pages, layers: result.layers };
            }
            case 'listPages':
                return this.analyzer.listPages();
            case 'queryNodes': {
                const { pageId, type, name: queryName, nameContains, limit = 50, offset = 0 } = args;
                // Name fuzzy search (replaces findNodesByName)
                if (queryName) {
                    const results = this.analyzer.findNodesByName(queryName);
                    return { nodes: results.slice(0, limit), total: results.length, mode: 'nameSearch' };
                }
                // Page-scoped query (replaces listNodesByPage)
                if (pageId) {
                    const result = this.analyzer.listNodesByPage(pageId, limit, type, nameContains, offset);
                    const pageInfo = this.analyzer.getPageInfo(pageId);
                    return { page: pageInfo, nodes: result || [], total: (result as any[]).length || 0, limit, offset, mode: 'pageQuery' };
                }
                // Global query (replaces listNodes)
                const result = this.analyzer.listNodes(limit, type, nameContains, offset);
                return { nodes: result || [], total: (result as any[]).length || 0, limit, offset, mode: 'globalQuery' };
            }
            case 'getNodeInfo':
                return this.analyzer.getNodeInfo(args.nodeId);
            case 'getMultipleNodeInfo': {
                const { nodeIds } = args;
                if (!Array.isArray(nodeIds)) throw new Error('nodeIds must be an array');
                const BATCH_SIZE = 100;
                const allResults: any[] = [];
                for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
                    const batch = nodeIds.slice(i, i + BATCH_SIZE);
                    for (const nodeId of batch) {
                        const info = this.analyzer.getNodeInfo(nodeId);
                        if (info) allResults.push(info);
                    }
                }
                return { nodes: allResults, total: allResults.length, requested: nodeIds.length, batches: Math.ceil(nodeIds.length / BATCH_SIZE) };
            }
            case 'getPageStructure': {
                const { pageId, mode = 'tree', fields, groupBy = 'type', maxDepth = 10, includeDetails = true, maxSamples = 5 } = args;
                if (mode === 'ids') {
                    return (this.analyzer as any).getNodeIdList(pageId);
                }
                if (mode === 'summary') {
                    return this.nodesSummaryTool.getNodesSummary({ pageId, groupBy, includeStats: true, maxSamples });
                }
                // Default: tree mode
                return this.analyzer.getPageStructure(pageId, includeDetails, maxDepth, fields);
            }
            case 'getDocumentStructure': {
                const { includeDetails = false, maxNodesPerPage = 200, fields, excludeFields, summaryMode = false, maxDepth = 3, groupSimilar = false } = args;
                return this.analyzer.getDocumentStructure(includeDetails, maxNodesPerPage, { fields, excludeFields, summaryMode, maxDepth, groupSimilar } as any);
            }
            case 'getSymbols': {
                const { type = 'master' } = args;
                return type === 'instance' ? this.analyzer.getSymbolInstances() : this.analyzer.getSymbolMasters();
            }
            case 'getSymbolMasterBySymbolID':
                return this.analyzer.getSymbolMasterBySymbolID(args.symbolID);
            case 'getSymbolInstanceStyles':
                return this.analyzer.getSymbolInstanceStyles(args.instanceId);
            case 'renderNodeAsBase64': {
                const { nodeId, format = 'svg' } = args;
                return this.analyzer.renderNodeAsBase64(nodeId, format);
            }
            case 'extractBitmaps': {
                const { bitmapIds } = args;
                return (this.analyzer as any).extractBitmaps(bitmapIds, (this.analyzer as any)._sketchExtractDir);
            }
            case 'matchIconFromName': {
                const { nodeNames, library = 'newFont' } = args;
                return this.iconMatcherTool.matchIcons(nodeNames, library);
            }
            case 'getShapePathData': {
                const { nodeIds } = args;
                return (this.analyzer as any).getShapePathData(nodeIds);
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
}
