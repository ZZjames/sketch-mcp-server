/**
 * 简化版 SketchConfigAnalyzer（v1.4.0 引入，目前为孤儿模块，未被其他文件 require）
 *
 * 仅维护 idToNode/idToParentId/nameToIds 三个 Map，无外部依赖。
 * 为对齐 backup dist 行为保留 src 文件。
 */
export class SketchConfigAnalyzer {
    private config: any = null;
    private idToNode: Map<string, any> = new Map();
    private idToParentId: Map<string, string | null> = new Map();
    private nameToIds: Map<string, Set<string>> = new Map();

    constructor() {
        this.config = null;
        this.idToNode = new Map();
        this.idToParentId = new Map();
        this.nameToIds = new Map();
    }

    analyzeConfig(config: any): { pages: number; layers: number } {
        this.config = config || null;
        this.idToNode.clear();
        this.idToParentId.clear();
        this.nameToIds.clear();
        if (!config || !config.document || !Array.isArray(config.document.pages)) {
            return { pages: 0, layers: 0 };
        }
        let layerCount = 0;
        const pages = config.document.pages || [];
        for (const page of pages) {
            this.indexNode(page.id, page, null);
            if (Array.isArray(page.layers)) {
                for (const layer of page.layers) {
                    layerCount += this.walkAndIndex(layer, page.id);
                }
            }
        }
        return { pages: pages.length, layers: layerCount };
    }

    hasConfig(): boolean {
        return !!(this.config && this.config.document);
    }

    listPages(): Array<{ id: string; name: string; layerCount: number }> {
        if (!this.config || !this.config.document || !Array.isArray(this.config.document.pages)) return [];
        const results: Array<{ id: string; name: string; layerCount: number }> = [];
        for (const page of this.config.document.pages) {
            let count = 0;
            if (Array.isArray(page.layers)) {
                for (const layer of page.layers) {
                    count += this.countLayers(layer);
                }
            }
            results.push({ id: page.id || page.do_objectID, name: page.name || '', layerCount: count });
        }
        return results;
    }

    countLayers(node: any): number {
        if (!node || typeof node !== 'object') return 0;
        const self = node.id || node.do_objectID ? 1 : 0;
        const children = node.layers || node.children || [];
        if (!Array.isArray(children)) return self;
        let sum = self;
        for (const child of children) sum += this.countLayers(child);
        return sum;
    }

    listNodes(limit: number = 50, type?: string, nameContains?: string, offset: number = 0): any[] {
        const out: any[] = [];
        let skipped = 0;
        for (const [id, node] of this.idToNode.entries()) {
            if (type) {
                const nodeType = node.type || node._class || '';
                if (String(nodeType).toLowerCase() !== String(type).toLowerCase()) continue;
            }
            if (nameContains) {
                const nm = String(node.name || '').toLowerCase();
                if (!nm.includes(String(nameContains).toLowerCase())) continue;
            }
            const info = this.getNodeInfo(id);
            if (info) {
                if (skipped < offset) {
                    skipped++;
                } else {
                    out.push(info);
                }
            }
            if (out.length >= limit) break;
        }
        return out;
    }

    listNodesByPage(pageId: string, limit: number = 50, type?: string, nameContains?: string, offset: number = 0): any[] {
        const page = this.idToNode.get(pageId);
        if (!page) return [];
        const results: any[] = [];
        let skipped = 0;
        const matchesType = (node: any): boolean => {
            if (!type) return true;
            const nodeType = node?.type || node?._class || '';
            return String(nodeType).toLowerCase() === String(type).toLowerCase();
        };
        const matchesName = (node: any): boolean => {
            if (!nameContains) return true;
            const nm = String(node?.name || '').toLowerCase();
            return nm.includes(String(nameContains).toLowerCase());
        };
        const walk = (node: any) => {
            if (!node || typeof node !== 'object') return;
            const id = node.id || node.do_objectID;
            if (id && matchesType(node) && matchesName(node)) {
                const info = this.getNodeInfo(id);
                if (info) {
                    if (skipped < offset) {
                        skipped++;
                    } else {
                        results.push(info);
                    }
                }
            }
            if (results.length >= limit) return;
            const children = node.layers || node.children || [];
            if (Array.isArray(children)) {
                for (const child of children) {
                    if (results.length >= limit) break;
                    walk(child);
                }
            }
        };
        const pageLayers = page.layers || [];
        if (Array.isArray(pageLayers)) {
            for (const layer of pageLayers) {
                if (results.length >= limit) break;
                walk(layer);
            }
        }
        return results;
    }

    walkAndIndex(node: any, parentId: string | null): number {
        if (!node || typeof node !== 'object') return 0;
        const nodeId = node.id || node.do_objectID || undefined;
        if (nodeId) {
            this.indexNode(nodeId, node, parentId);
        }
        let count = nodeId ? 1 : 0;
        const children = node.layers || node.children || [];
        if (Array.isArray(children)) {
            for (const child of children) {
                count += this.walkAndIndex(child, nodeId || parentId || null);
            }
        }
        return count;
    }

    indexNode(id: string, node: any, parentId: string | null): void {
        this.idToNode.set(id, node);
        this.idToParentId.set(id, parentId);
        const name = node.name || '';
        if (name) {
            if (!this.nameToIds.has(name)) this.nameToIds.set(name, new Set());
            this.nameToIds.get(name)!.add(id);
        }
    }

    getNodeInfo(nodeId: string): any {
        const node = this.idToNode.get(nodeId);
        if (!node) return null;
        const frame = node.frame || {};
        return {
            id: nodeId,
            name: node.name || '',
            position: { x: frame.x ?? 0, y: frame.y ?? 0 },
            size: { width: frame.width ?? 0, height: frame.height ?? 0 }
        };
    }

    getNodePosition(nodeId: string): { x: number; y: number } | null {
        const node = this.idToNode.get(nodeId);
        if (!node) return null;
        const frame = node.frame || {};
        return { x: frame.x ?? 0, y: frame.y ?? 0 };
    }

    findNodesByName(name: string): any[] {
        const ids = this.nameToIds.get(name);
        if (!ids) return [];
        const results: any[] = [];
        for (const id of ids) {
            const info = this.getNodeInfo(id);
            if (info) results.push(info);
        }
        return results;
    }

    getAncestors(nodeId: string): string[] {
        const ancestors: string[] = [];
        let current: string | null | undefined = nodeId;
        while (current) {
            const parent: string | null = this.idToParentId.get(current) ?? null;
            if (parent) ancestors.push(parent);
            current = parent;
        }
        return ancestors;
    }

    getRawNode(nodeId: string): any {
        return this.idToNode.get(nodeId) || null;
    }
}
