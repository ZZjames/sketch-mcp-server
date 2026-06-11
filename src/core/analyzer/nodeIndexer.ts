/**
 * 节点索引器 - 负责构建和维护节点索引
 */
export class NodeIndexer {
    private idToNode: Map<string, any> = new Map();
    private idToParentId: Map<string, string | null> = new Map();
    private nameToIds: Map<string, Set<string>> = new Map();

    /**
     * 清空所有索引
     */
    clear(): void {
        this.idToNode.clear();
        this.idToParentId.clear();
        this.nameToIds.clear();
    }

    /**
     * 索引配置文档
     */
    indexConfig(config: any): { pages: number; layers: number } {
        this.clear();

        if (!config || !config.document || !Array.isArray(config.document.pages)) {
            return { pages: 0, layers: 0 };
        }

        let layerCount = 0;
        const pages = config.document.pages || [];
        
        for (const page of pages) {
            const pageId: string | undefined = page?.id || page?.do_objectID;
            if (pageId) {
                this.indexNode(pageId, page, null);
            }
            if (Array.isArray(page.layers)) {
                for (const layer of page.layers) {
                    layerCount += this.walkAndIndex(layer, pageId ?? null);
                }
            }
        }

        return { pages: pages.length, layers: layerCount };
    }

    /**
     * 递归遍历并索引节点
     */
    private walkAndIndex(node: any, parentId: string | null): number {
        const nodeId = node?.id || node?.do_objectID;
        if (nodeId) {
            this.indexNode(nodeId, node, parentId);
        }
        
        let count = 1;
        if (Array.isArray(node.layers)) {
            for (const child of node.layers) {
                count += this.walkAndIndex(child, nodeId);
            }
        }
        return count;
    }

    /**
     * 索引单个节点
     */
    private indexNode(id: string, node: any, parentId: string | null): void {
        this.idToNode.set(id, node);
        this.idToParentId.set(id, parentId);
        
        const name = node.name || '';
        if (name) {
            if (!this.nameToIds.has(name)) {
                this.nameToIds.set(name, new Set());
            }
            this.nameToIds.get(name)!.add(id);
        }
    }

    /**
     * 计算节点层数
     */
    countLayers(node: any): number {
        let count = 1;
        if (Array.isArray(node.layers)) {
            for (const child of node.layers) {
                count += this.countLayers(child);
            }
        }
        return count;
    }

    /**
     * 获取节点
     */
    getNode(nodeId: string): any {
        return this.idToNode.get(nodeId);
    }

    /**
     * 获取父节点ID
     */
    getParentId(nodeId: string): string | null {
        return this.idToParentId.get(nodeId) || null;
    }

    /**
     * 根据名称查找节点
     */
    findNodesByName(name: string): Array<{ id: string; name: string; type: string }> {
        const results: Array<{ id: string; name: string; type: string }> = [];
        const nodeIds = this.nameToIds.get(name);
        
        if (nodeIds) {
            for (const nodeId of nodeIds) {
                const node = this.idToNode.get(nodeId);
                if (node) {
                    results.push({
                        id: nodeId,
                        name: node.name || '',
                        type: this.getNodeType(node)
                    });
                }
            }
        }
        
        return results;
    }

    /**
     * 获取祖先节点
     */
    getAncestors(nodeId: string): string[] {
        const ancestors: string[] = [];
        let currentId: string | null = nodeId;
        
        while (currentId) {
            const parentId = this.idToParentId.get(currentId);
            if (parentId) {
                ancestors.unshift(parentId);
                currentId = parentId;
            } else {
                break;
            }
        }
        
        return ancestors;
    }

    /**
     * 列出所有节点
     */
    listNodes(limit: number = 50, type?: string | string[], nameContains?: string, offset: number = 0): any[] {
        const results: any[] = [];
        let count = 0;
        let skipped = 0;
        const typeSet = type ? new Set(Array.isArray(type) ? type : [type]) : null;

        for (const [nodeId, node] of this.idToNode) {
            if (typeSet && !typeSet.has(this.getNodeType(node))) {
                continue;
            }
            
            if (nameContains && (!node.name || !node.name.toLowerCase().includes(nameContains.toLowerCase()))) {
                continue;
            }
            
            if (skipped < offset) {
                skipped++;
                continue;
            }
            
            if (count >= limit) {
                break;
            }
            
            results.push({
                id: nodeId,
                name: node.name || '',
                type: this.getNodeType(node)
            });
            count++;
        }
        
        return results;
    }

    /**
     * 获取节点类型
     */
    private getNodeType(node: any): string {
        if (!node || !node._class) return 'unknown';
        
        switch (node._class) {
            case 'page': return 'page';
            case 'artboard': return 'artboard';
            case 'group': return 'group';
            case 'rectangle': return 'rectangle';
            case 'oval': return 'oval';
            case 'text': return 'text';
            case 'symbolInstance': return 'symbolInstance';
            case 'symbolMaster': return 'symbolMaster';
            case 'shapePath': return 'shapePath';
            case 'bitmap': return 'bitmap';
            default: return node._class || 'unknown';
        }
    }

    /**
     * 获取索引统计信息
     */
    getStats(): { totalNodes: number; totalNames: number } {
        return {
            totalNodes: this.idToNode.size,
            totalNames: this.nameToIds.size
        };
    }
}