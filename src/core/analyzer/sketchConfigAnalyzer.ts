export class SketchConfigAnalyzer {
    private config: any | null = null;
    private idToNode: Map<string, any> = new Map();
    private idToParentId: Map<string, string | null> = new Map();
    private nameToIds: Map<string, Set<string>> = new Map();

    constructor() {}

    analyzeConfig(config: any) {
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

    private countLayers(node: any): number {
        if (!node || typeof node !== 'object') return 0;
        const self = node.id || node.do_objectID ? 1 : 0;
        const children = node.layers || node.children || [];
        if (!Array.isArray(children)) return self;
        let sum = self;
        for (const child of children) sum += this.countLayers(child);
        return sum;
    }

    listNodes(limit: number = 50, type?: string, nameContains?: string, offset: number = 0) {
        const out: any[] = [];
        let skipped = 0;
        for (const [id, node] of this.idToNode.entries()) {
            if (type) {
                const nodeType = node.type || node._class || '';
                if (String(nodeType).toLowerCase() !== String(type).toLowerCase()) continue;
            }
            if (nameContains) {
                const nm = String(node.name || '')
                    .toLowerCase();
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

    getPageInfo(pageId: string) {
        const page = this.idToNode.get(pageId);
        if (!page) return null;
        
        // Count total nodes in the page
        let totalNodeCount = 0;
        const countNodes = (node: any) => {
            if (!node || typeof node !== 'object') return;
            const id = node.id || node.do_objectID;
            if (id) totalNodeCount++;
            
            const children = node.layers || node.children || [];
            if (Array.isArray(children)) {
                for (const child of children) {
                    countNodes(child);
                }
            }
        };
        
        // Count nodes in the page
        const pageLayers = page.layers || [];
        if (Array.isArray(pageLayers)) {
            for (const layer of pageLayers) {
                countNodes(layer);
            }
        }
        
        return {
            id: pageId,
            name: page.name || '',
            totalNodeCount: totalNodeCount
        };
    }

    listNodesByPage(pageId: string, limit: number = 50, type?: string, nameContains?: string, offset: number = 0) {
        const page = this.idToNode.get(pageId);
        if (!page) return { nodes: [], totalNodes: 0, returnedNodes: 0 };
        const results: any[] = [];
        let skipped = 0;
        let totalMatchingNodes = 0;
        
        const matchesType = (node: any) => {
            if (!type) return true;
            const nodeType = node?.type || node?._class || '';
            return String(nodeType).toLowerCase() === String(type).toLowerCase();
        };
        const matchesName = (node: any) => {
            if (!nameContains) return true;
            const nm = String(node?.name || '').toLowerCase();
            return nm.includes(String(nameContains).toLowerCase());
        };
        
        // First pass to count total matching nodes
        const countMatches = (node: any) => {
            if (!node || typeof node !== 'object') return;
            const id = node.id || node.do_objectID;
            if (id && matchesType(node) && matchesName(node)) {
                totalMatchingNodes++;
            }
            const children = node.layers || node.children || [];
            if (Array.isArray(children)) {
                for (const child of children) {
                    countMatches(child);
                }
            }
        };
        
        // Second pass to collect results with pagination
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
        
        // Only traverse page.layers to avoid cross-page results
        const pageLayers = page.layers || [];
        if (Array.isArray(pageLayers)) {
            // First count total matching nodes
            for (const layer of pageLayers) {
                countMatches(layer);
            }
            
            // Then collect results with pagination
            for (const layer of pageLayers) {
                if (results.length >= limit) break;
                walk(layer);
            }
        }
        
        return {
            nodes: results,
            totalNodes: totalMatchingNodes,
            returnedNodes: results.length
        };
    }

    private walkAndIndex(node: any, parentId: string | null): number {
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

    private indexNode(id: string, node: any, parentId: string | null) {
        this.idToNode.set(id, node);
        this.idToParentId.set(id, parentId);
        const name = node.name || '';
        if (name) {
            if (!this.nameToIds.has(name)) this.nameToIds.set(name, new Set());
            this.nameToIds.get(name)!.add(id);
        }
    }

    getNodeInfo(nodeId: string) {
        const node = this.idToNode.get(nodeId);
        if (!node) return null;
        const frame = node.frame || {};
        
        // 基础信息
        const result: any = {
            id: nodeId,
            name: node.name || '',
            type: node._class || node.class || 'unknown',
            position: { x: frame.x ?? 0, y: frame.y ?? 0 },
            size: { width: frame.width ?? 0, height: frame.height ?? 0 },
            rotation: node.rotation ?? 0,
            isVisible: node.isVisible ?? true,
            isLocked: node.isLocked ?? false,
            opacity: node.style?.contextSettings?.opacity ?? 1
        };

        // 样式信息
        if (node.style) {
            result.style = this.extractStyleInfo(node.style);
        }

        // 文本特定信息
        if (node._class === 'text' && node.attributedString) {
            result.text = this.extractTextInfo(node.attributedString);
        }

        // 形状特定信息
        if (node._class === 'shapeGroup' || node._class === 'rectangle' || node._class === 'oval') {
            result.shape = this.extractShapeInfo(node);
        }

        // 图片特定信息
        if (node._class === 'bitmap') {
            result.image = this.extractImageInfo(node);
        }

        // Symbol特定信息
        if (node._class === 'symbolMaster' || node._class === 'symbolInstance') {
            result.symbol = this.extractSymbolInfo(node);
        }

        return result;
    }

    /**
     * 提取样式信息
     */
    private extractStyleInfo(style: any): any {
        const styleInfo: any = {};

        // 填充信息
        if (style.fills && Array.isArray(style.fills)) {
            styleInfo.fills = style.fills.map((fill: any) => ({
                type: fill.fillType || 'color',
                color: this.extractColor(fill.color),
                isEnabled: fill.isEnabled ?? true,
                opacity: fill.contextSettings?.opacity ?? 1
            }));
        }

        // 边框信息
        if (style.borders && Array.isArray(style.borders)) {
            styleInfo.borders = style.borders.map((border: any) => ({
                color: this.extractColor(border.color),
                thickness: border.thickness ?? 1,
                position: border.position ?? 0, // 0: center, 1: inside, 2: outside
                isEnabled: border.isEnabled ?? true
            }));
        }

        // 阴影信息
        if (style.shadows && Array.isArray(style.shadows)) {
            styleInfo.shadows = style.shadows.map((shadow: any) => ({
                color: this.extractColor(shadow.color),
                offsetX: shadow.offsetX ?? 0,
                offsetY: shadow.offsetY ?? 0,
                blurRadius: shadow.blurRadius ?? 0,
                spread: shadow.spread ?? 0,
                isEnabled: shadow.isEnabled ?? true
            }));
        }

        // 内阴影信息
        if (style.innerShadows && Array.isArray(style.innerShadows)) {
            styleInfo.innerShadows = style.innerShadows.map((shadow: any) => ({
                color: this.extractColor(shadow.color),
                offsetX: shadow.offsetX ?? 0,
                offsetY: shadow.offsetY ?? 0,
                blurRadius: shadow.blurRadius ?? 0,
                spread: shadow.spread ?? 0,
                isEnabled: shadow.isEnabled ?? true
            }));
        }

        // 模糊效果
        if (style.blur) {
            styleInfo.blur = {
                type: style.blur.type ?? 0, // 0: gaussian, 1: motion, 2: zoom, 3: background
                radius: style.blur.radius ?? 0,
                isEnabled: style.blur.isEnabled ?? true
            };
        }

        return styleInfo;
    }

    /**
     * 提取颜色信息
     */
    private extractColor(color: any): any {
        if (!color) return null;
        
        return {
            red: color.red ?? 0,
            green: color.green ?? 0,
            blue: color.blue ?? 0,
            alpha: color.alpha ?? 1,
            hex: this.rgbaToHex(color.red ?? 0, color.green ?? 0, color.blue ?? 0, color.alpha ?? 1)
        };
    }

    /**
     * 将RGBA转换为HEX
     */
    private rgbaToHex(r: number, g: number, b: number, a: number): string {
        const toHex = (n: number) => {
            const hex = Math.round(n * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        return a < 1 ? `${hex}${toHex(a)}` : hex;
    }

    /**
     * 提取文本信息
     */
    private extractTextInfo(attributedString: any): any {
        const textInfo: any = {
            content: attributedString.string || '',
            attributes: []
        };

        if (attributedString.attributes && Array.isArray(attributedString.attributes)) {
            textInfo.attributes = attributedString.attributes.map((attr: any) => ({
                location: attr.location ?? 0,
                length: attr.length ?? 0,
                attributes: {
                    fontFamily: attr.attributes?.MSAttributedStringFontAttribute?.attributes?.name,
                    fontSize: attr.attributes?.MSAttributedStringFontAttribute?.attributes?.size,
                    color: this.extractColor(attr.attributes?.MSAttributedStringColorAttribute),
                    alignment: attr.attributes?.paragraphStyle?.alignment,
                    lineHeight: attr.attributes?.paragraphStyle?.maximumLineHeight,
                    letterSpacing: attr.attributes?.kerning
                }
            }));
        }

        return textInfo;
    }

    /**
     * 提取形状信息
     */
    private extractShapeInfo(node: any): any {
        const shapeInfo: any = {
            type: node._class
        };

        // 圆角信息
        if (node.fixedRadius !== undefined) {
            shapeInfo.cornerRadius = node.fixedRadius;
        }

        // 路径信息
        if (node.path) {
            shapeInfo.path = {
                isClosed: node.path.isClosed ?? false,
                pointRadiusBehaviour: node.path.pointRadiusBehaviour ?? 1
            };
        }

        // 布尔运算信息
        if (node.booleanOperation !== undefined) {
            shapeInfo.booleanOperation = node.booleanOperation;
        }

        return shapeInfo;
    }

    /**
     * 提取图片信息
     */
    private extractImageInfo(node: any): any {
        const imageInfo: any = {};

        if (node.image) {
            imageInfo.imageId = node.image._ref;
            imageInfo.fillReplacesImage = node.fillReplacesImage ?? false;
        }

        if (node.clippingMask) {
            imageInfo.clippingMask = node.clippingMask;
        }

        return imageInfo;
    }

    /**
     * 提取Symbol信息
     */
    private extractSymbolInfo(node: any): any {
        const symbolInfo: any = {
            type: node._class
        };

        // Symbol Master信息
        if (node._class === 'symbolMaster') {
            symbolInfo.symbolID = node.symbolID;
            symbolInfo.includeBackgroundColorInExport = node.includeBackgroundColorInExport ?? false;
            symbolInfo.includeBackgroundColorInInstance = node.includeBackgroundColorInInstance ?? false;
            symbolInfo.allowsOverrides = node.allowsOverrides ?? true;
            
            // 获取Symbol的所有图层
            if (node.layers && Array.isArray(node.layers)) {
                symbolInfo.layers = node.layers.map((layer: any) => ({
                    id: layer.do_objectID || layer.id,
                    name: layer.name,
                    type: layer._class,
                    allowsOverrides: layer.allowsOverrides ?? true
                }));
            }
        }

        // Symbol Instance信息
        if (node._class === 'symbolInstance') {
            symbolInfo.symbolID = node.symbolID;
            symbolInfo.masterInfluenceEdgeMinXPadding = node.masterInfluenceEdgeMinXPadding ?? 0;
            symbolInfo.masterInfluenceEdgeMinYPadding = node.masterInfluenceEdgeMinYPadding ?? 0;
            symbolInfo.masterInfluenceEdgeMaxXPadding = node.masterInfluenceEdgeMaxXPadding ?? 0;
            symbolInfo.masterInfluenceEdgeMaxYPadding = node.masterInfluenceEdgeMaxYPadding ?? 0;
            
            // Override信息
            if (node.overrideValues && Array.isArray(node.overrideValues)) {
                symbolInfo.overrides = node.overrideValues.map((override: any) => ({
                    overrideName: override.overrideName,
                    value: override.value
                }));
            }
        }

        return symbolInfo;
    }

    /**
     * 获取所有Symbol Masters
     */
    getSymbolMasters(): Array<{ id: string; name: string; symbolID: string; layers: any[] }> {
        const symbols: Array<{ id: string; name: string; symbolID: string; layers: any[] }> = [];
        
        for (const [id, node] of this.idToNode) {
            if (node._class === 'symbolMaster') {
                symbols.push({
                    id,
                    name: node.name || '',
                    symbolID: node.symbolID || '',
                    layers: node.layers || []
                });
            }
        }
        
        return symbols;
    }

    /**
     * 根据symbolID获取Symbol Master
     */
    getSymbolMasterBySymbolID(symbolID: string): any {
        for (const [id, node] of this.idToNode) {
            if (node._class === 'symbolMaster' && node.symbolID === symbolID) {
                return {
                    id,
                    node,
                    info: this.getNodeInfo(id)
                };
            }
        }
        return null;
    }

    /**
     * 获取所有Symbol Instances
     */
    getSymbolInstances(): Array<{ id: string; name: string; symbolID: string; overrides: any[] }> {
        const instances: Array<{ id: string; name: string; symbolID: string; overrides: any[] }> = [];
        
        for (const [id, node] of this.idToNode) {
            if (node._class === 'symbolInstance') {
                instances.push({
                    id,
                    name: node.name || '',
                    symbolID: node.symbolID || '',
                    overrides: node.overrideValues || []
                });
            }
        }
        
        return instances;
    }

    /**
     * 根据Symbol Instance获取其对应的Symbol Master样式
     */
    getSymbolInstanceStyles(instanceId: string): any {
        const instance = this.idToNode.get(instanceId);
        if (!instance || instance._class !== 'symbolInstance') {
            return null;
        }

        const master = this.getSymbolMasterBySymbolID(instance.symbolID);
        if (!master) {
            return null;
        }

        // 获取Symbol Master的样式信息
        const masterStyles = this.getNodeInfo(master.id);
        
        // 应用Override值
        const result = {
            ...masterStyles,
            symbolInfo: {
                masterSymbolID: instance.symbolID,
                instanceId: instanceId,
                overrides: instance.overrideValues || [],
                masterStyles: masterStyles.style || {}
            }
        };

        // 应用overrides到样式中
        if (instance.overrideValues && Array.isArray(instance.overrideValues)) {
            for (const override of instance.overrideValues) {
                if (override.overrideName && override.value !== undefined) {
                    // 根据override名称更新相应的样式属性
                    this.applyOverrideToStyles(result, override);
                }
            }
        }

        return result;
    }

    /**
     * 应用Override到样式中
     */
    private applyOverrideToStyles(styles: any, override: any): void {
        const { overrideName, value } = override;
        
        // 处理文本内容override
        if (overrideName.includes('stringValue')) {
            if (!styles.text) styles.text = {};
            styles.text.content = value;
        }
        
        // 处理图片override
        if (overrideName.includes('image')) {
            if (!styles.image) styles.image = {};
            styles.image.imageId = value;
        }
        
        // 处理颜色override
        if (overrideName.includes('color')) {
            // 这里可以根据具体的override格式来解析颜色值
            if (value && typeof value === 'object') {
                const color = this.extractColor(value);
                if (color) {
                    if (!styles.style) styles.style = {};
                    if (!styles.style.fills) styles.style.fills = [];
                    styles.style.fills[0] = {
                        type: 'color',
                        color: color,
                        isEnabled: true,
                        opacity: 1
                    };
                }
            }
        }
    }

    /**
     * 将节点渲染为Base64图片
     */
    renderNodeAsBase64(nodeId: string, format: 'svg' | 'png' = 'svg'): any {
        const debugSteps: string[] = [];
        debugSteps.push(`Starting render for node: ${nodeId}`);
        
        // 检查是否已加载Sketch文件
        if (this.idToNode.size === 0) {
            debugSteps.push('No Sketch file loaded');
            return {
                error: 'No Sketch file loaded',
                message: 'Please call loadSketchByPath first to load a Sketch file',
                nodeId: nodeId,
                debugSteps: debugSteps,
                debugInfo: {
                    totalNodes: 0,
                    sketchFileLoaded: false,
                    instruction: 'Use loadSketchByPath tool to load a .sketch file first'
                }
            };
        }

        debugSteps.push(`Total nodes loaded: ${this.idToNode.size}`);
        
        const node = this.idToNode.get(nodeId);
        if (!node) {
            debugSteps.push('Node not found in idToNode map');
            return {
                error: 'Node not found',
                nodeId: nodeId,
                availableNodes: Array.from(this.idToNode.keys()).slice(0, 10),
                debugSteps: debugSteps,
                debugInfo: {
                    totalNodes: this.idToNode.size,
                    searchedNodeId: nodeId,
                    sketchFileLoaded: true,
                    suggestion: 'Use listNodes tool to get valid node IDs'
                }
            };
        }

        debugSteps.push(`Found node: ${node.name || 'unnamed'}, type: ${node._class || 'unknown'}`);
        
        const nodeInfo = this.getNodeInfo(nodeId);
        if (!nodeInfo) {
            debugSteps.push('Failed to get node info');
            return {
                error: 'Failed to get node info',
                nodeId: nodeId,
                rawNode: {
                    name: node.name,
                    class: node._class,
                    frame: node.frame
                },
                debugSteps: debugSteps,
                debugInfo: {
                    nodeFound: true,
                    nodeInfoFailed: true
                }
            };
        }

        debugSteps.push(`NodeInfo obtained: type=${nodeInfo.type}, size=${JSON.stringify(nodeInfo.size)}`);

        try {
            if (format === 'svg') {
                debugSteps.push('Rendering as SVG');
                const result = this.renderNodeAsSVG(nodeInfo);
                debugSteps.push('SVG render successful');
                return {
                    ...result,
                    debugSteps: debugSteps,
                    debugInfo: {
                        renderSuccess: true,
                        nodeType: nodeInfo.type,
                        nodeSize: nodeInfo.size,
                        format: 'svg'
                    }
                };
            } else {
                debugSteps.push('PNG format requested, rendering as SVG');
                const result = this.renderNodeAsSVG(nodeInfo);
                debugSteps.push('PNG->SVG render successful');
                return {
                    ...result,
                    debugSteps: debugSteps,
                    debugInfo: {
                        renderSuccess: true,
                        nodeType: nodeInfo.type,
                        nodeSize: nodeInfo.size,
                        format: 'svg',
                        formatNote: 'PNG requested but returned as SVG'
                    }
                };
            }
        } catch (error) {
            debugSteps.push(`Render failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                error: 'Render failed',
                nodeId: nodeId,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                nodeInfo: nodeInfo,
                debugSteps: debugSteps,
                debugInfo: {
                    renderFailed: true,
                    errorType: error instanceof Error ? error.constructor.name : 'Unknown'
                }
            };
        }
    }

    /**
     * 将节点渲染为SVG格式的Base64
     */
    private renderNodeAsSVG(nodeInfo: any): any {
        const { position, size, style, type, name } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;

        let svgContent = '';

        // 根据节点类型生成SVG内容
        switch (type) {
            case 'rectangle':
            case 'shape':
                svgContent = this.generateRectangleSVG(nodeInfo);
                break;
            case 'oval':
                svgContent = this.generateOvalSVG(nodeInfo);
                break;
            case 'text':
                svgContent = this.generateTextSVG(nodeInfo);
                break;
            case 'symbolInstance':
                svgContent = this.generateSymbolInstanceSVG(nodeInfo);
                break;
            case 'group':
                svgContent = this.generateGroupSVG(nodeInfo);
                break;
            case 'artboard':
                svgContent = this.generateArtboardSVG(nodeInfo);
                break;
            case 'shapePath':
                svgContent = this.generateShapePathSVG(nodeInfo);
                break;
            default:
                svgContent = this.generateDefaultShapeSVG(nodeInfo);
        }

        const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`;
        const base64 = Buffer.from(svg).toString('base64');
        
        return {
            nodeId: nodeInfo.id,
            name: name,
            format: 'svg',
            width: width,
            height: height,
            imageData: `data:image/svg+xml;base64,${base64}`,
            svgContent: svg
        };
    }

    /**
     * 生成矩形SVG
     */
    private generateRectangleSVG(nodeInfo: any): string {
        const { size, style } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        
        let fill = '#cccccc';
        let stroke = 'none';
        let strokeWidth = 0;
        let rx = 0; // 圆角

        if (style) {
            // 填充颜色
            if (style.fills && style.fills.length > 0) {
                const firstFill = style.fills[0];
                if (firstFill.color && firstFill.isEnabled) {
                    fill = firstFill.color.hex || '#cccccc';
                }
            }

            // 边框
            if (style.borders && style.borders.length > 0) {
                const firstBorder = style.borders[0];
                if (firstBorder.isEnabled) {
                    stroke = firstBorder.color?.hex || '#000000';
                    strokeWidth = firstBorder.thickness || 1;
                }
            }
        }

        // 检查是否有圆角（从shape信息中获取）
        if (nodeInfo.shape && nodeInfo.shape.cornerRadius) {
            rx = nodeInfo.shape.cornerRadius;
        }

        return `<rect x="0" y="0" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }

    /**
     * 生成椭圆SVG
     */
    private generateOvalSVG(nodeInfo: any): string {
        const { size, style } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        const cx = width / 2;
        const cy = height / 2;
        const rx = width / 2;
        const ry = height / 2;
        
        let fill = '#cccccc';
        let stroke = 'none';
        let strokeWidth = 0;

        if (style) {
            if (style.fills && style.fills.length > 0) {
                const firstFill = style.fills[0];
                if (firstFill.color && firstFill.isEnabled) {
                    fill = firstFill.color.hex || '#cccccc';
                }
            }

            if (style.borders && style.borders.length > 0) {
                const firstBorder = style.borders[0];
                if (firstBorder.isEnabled) {
                    stroke = firstBorder.color?.hex || '#000000';
                    strokeWidth = firstBorder.thickness || 1;
                }
            }
        }

        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }

    /**
     * 生成文本SVG
     */
    private generateTextSVG(nodeInfo: any): string {
        const { size, style, text } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        
        let content = text?.content || 'Text';
        let fontSize = 14;
        let fontFamily = 'Arial, sans-serif';
        let fill = '#000000';
        let textAnchor = 'start';
        let y = fontSize; // 默认基线位置

        if (text && text.attributes && text.attributes.length > 0) {
            const attr = text.attributes[0].attributes;
            if (attr) {
                fontSize = attr.fontSize || fontSize;
                fontFamily = attr.fontFamily || fontFamily;
                if (attr.color && attr.color.hex) {
                    fill = attr.color.hex;
                }
                // 简单的对齐处理
                if (attr.alignment === 1) textAnchor = 'middle';
                if (attr.alignment === 2) textAnchor = 'end';
            }
        }

        // 调整y位置使文本居中
        y = height / 2 + fontSize / 3;
        let x = 0;
        if (textAnchor === 'middle') x = width / 2;
        if (textAnchor === 'end') x = width;

        return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" fill="${fill}" text-anchor="${textAnchor}">${this.escapeXML(content)}</text>`;
    }

    /**
     * 生成Symbol Instance SVG
     */
    private generateSymbolInstanceSVG(nodeInfo: any): string {
        const { size } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        
        // 简单的Symbol占位符
        return `<rect x="0" y="0" width="${width}" height="${height}" fill="#e0e0e0" stroke="#999999" stroke-width="1" stroke-dasharray="5,5"/>
                <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="12" fill="#666666" text-anchor="middle" dominant-baseline="middle">Symbol</text>`;
    }

    /**
     * 生成Group SVG
     */
    private generateGroupSVG(nodeInfo: any): string {
        const { size } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        
        // 获取Group的子节点
        const groupNode = this.idToNode.get(nodeInfo.id);
        let childrenSVG = '';
        
        if (groupNode && groupNode.layers && Array.isArray(groupNode.layers)) {
            // 渲染前几个子节点
            const maxChildren = Math.min(groupNode.layers.length, 5); // 最多渲染5个子节点
            
            for (let i = 0; i < maxChildren; i++) {
                const child = groupNode.layers[i];
                const childId = child.do_objectID || child.id;
                
                if (childId) {
                    try {
                        const childInfo = this.getNodeInfo(childId);
                        if (childInfo) {
                            // 计算子节点相对于Group的位置
                            // 确保相对位置在Group范围内
                            let relativeX = (childInfo.position.x || 0) - (nodeInfo.position.x || 0);
                            let relativeY = (childInfo.position.y || 0) - (nodeInfo.position.y || 0);
                            
                            // 如果子节点位置超出Group边界，调整到可见范围内
                            if (relativeX < 0 || relativeX >= width) {
                                relativeX = Math.max(0, Math.min(relativeX, width - (childInfo.size.width || 10)));
                            }
                            if (relativeY < 0 || relativeY >= height) {
                                relativeY = Math.max(0, Math.min(relativeY, height - (childInfo.size.height || 10)));
                            }
                            
                            // 生成子节点SVG
                            let childSVG = '';
                            switch (childInfo.type) {
                                case 'rectangle':
                                case 'shape':
                                    childSVG = this.generateRectangleSVG(childInfo);
                                    break;
                                case 'oval':
                                    childSVG = this.generateOvalSVG(childInfo);
                                    break;
                                case 'text':
                                    childSVG = this.generateTextSVG(childInfo);
                                    break;
                                case 'group':
                                    // 递归渲染嵌套的Group
                                    childSVG = this.generateGroupSVG(childInfo);
                                    break;
                                case 'shapePath':
                                    childSVG = this.generateShapePathSVG(childInfo);
                                    break;
                                default:
                                    childSVG = this.generateDefaultShapeSVG(childInfo);
                            }
                            
                            // 包装在group中并设置位置
                            if (childSVG) {
                                childrenSVG += `<g transform="translate(${relativeX}, ${relativeY})">${childSVG}</g>`;
                            }
                        }
                    } catch (error) {
                        // 静默处理错误
                    }
                }
            }
        }
        
        // 如果有子节点内容，添加Group背景（可选）
        if (childrenSVG) {
            // 添加一个透明的背景矩形作为Group的边界
            const backgroundRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="none"/>`;
            return backgroundRect + childrenSVG;
        }
        
        // 如果没有子节点或渲染失败，显示Group占位符
        return `<rect x="0" y="0" width="${width}" height="${height}" fill="#f8f8f8" stroke="#cccccc" stroke-width="1" stroke-dasharray="3,3"/>
                <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="12" fill="#999999" text-anchor="middle" dominant-baseline="middle">Group (${groupNode?.layers?.length || 0} items)</text>`;
    }

    /**
     * 生成Artboard SVG
     */
    private generateArtboardSVG(nodeInfo: any): string {
        const { size } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        
        // Artboard通常有背景色
        let backgroundColor = '#ffffff';
        if (nodeInfo.style && nodeInfo.style.fills && nodeInfo.style.fills.length > 0) {
            const fill = nodeInfo.style.fills[0];
            if (fill.color && fill.isEnabled) {
                backgroundColor = fill.color.hex || '#ffffff';
            }
        }
        
        return `<rect x="0" y="0" width="${width}" height="${height}" fill="${backgroundColor}" stroke="#dddddd" stroke-width="2"/>
                <text x="10" y="20" font-family="Arial" font-size="12" fill="#666666">${nodeInfo.name || 'Artboard'}</text>`;
    }

    /**
     * 生成ShapePath SVG
     */
    private generateShapePathSVG(nodeInfo: any): string {
        const rawNode = this.idToNode.get(nodeInfo.id);
        
        // 尝试提取路径数据
        let pathData = null;
        let fillColor = '#cccccc';
        let strokeColor = 'none';
        let strokeWidth = 0;
        
        if (rawNode) {
            // 提取路径数据
            if (rawNode.path && rawNode.path.pathData) {
                pathData = rawNode.path.pathData;
            } else if (rawNode.pathData) {
                pathData = rawNode.pathData;
            } else if (rawNode.points && Array.isArray(rawNode.points)) {
                // 从points数组构建路径
                pathData = this.pointsToPathData(rawNode.points, rawNode.frame);
            }
            
            // 提取样式信息
            if (rawNode.style) {
                // 填充颜色
                if (rawNode.style.fills && rawNode.style.fills.length > 0) {
                    const fill = rawNode.style.fills[0];
                    if (fill.isEnabled && fill.color) {
                        fillColor = fill.color.hex || fillColor;
                    }
                }
                
                // 描边信息
                if (rawNode.style.borders && rawNode.style.borders.length > 0) {
                    const border = rawNode.style.borders[0];
                    if (border.isEnabled) {
                        strokeColor = border.color?.hex || '#000000';
                        strokeWidth = border.thickness || 1;
                    }
                }
            }
        }
        
        // 如果有路径数据，生成path元素
        if (pathData) {
            return `<path d="${pathData}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
        }
        
        // 降级到默认形状
        return this.generateDefaultShapeSVG(nodeInfo);
    }
    
    /**
     * 将points数组转换为SVG路径数据
     */
    private pointsToPathData(points: any[], nodeFrame?: any): string {
        if (!points || points.length === 0) return '';
        
        // 获取节点的实际尺寸用于坐标转换
        const width = nodeFrame?.width || 100;
        const height = nodeFrame?.height || 100;
        
        let pathData = '';
        
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            
            // 解析坐标（Sketch中的坐标是相对值0-1）
            let relativeX = 0, relativeY = 0;
            
            if (point.point && typeof point.point === 'string') {
                // 解析 "{x, y}" 格式的字符串
                const coords = point.point.match(/([\d.-]+)/g);
                if (coords && coords.length >= 2) {
                    relativeX = parseFloat(coords[0]);
                    relativeY = parseFloat(coords[1]);
                }
            } else if (point.point && typeof point.point === 'object') {
                relativeX = point.point.x || 0;
                relativeY = point.point.y || 0;
            } else if (point.x !== undefined && point.y !== undefined) {
                relativeX = point.x;
                relativeY = point.y;
            }
            
            // 转换为绝对坐标
            const x = relativeX * width;
            const y = relativeY * height;
            
            if (i === 0) {
                pathData += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
            } else {
                // 检查是否有控制点（贝塞尔曲线）
                if (point.hasCurveFrom || point.hasCurveTo) {
                    // 解析控制点坐标
                    let cp1x = x, cp1y = y, cp2x = x, cp2y = y;
                    
                    if (point.curveFrom && typeof point.curveFrom === 'string') {
                        const fromCoords = point.curveFrom.match(/([\d.-]+)/g);
                        if (fromCoords && fromCoords.length >= 2) {
                            cp1x = parseFloat(fromCoords[0]) * width;
                            cp1y = parseFloat(fromCoords[1]) * height;
                        }
                    }
                    
                    if (point.curveTo && typeof point.curveTo === 'string') {
                        const toCoords = point.curveTo.match(/([\d.-]+)/g);
                        if (toCoords && toCoords.length >= 2) {
                            cp2x = parseFloat(toCoords[0]) * width;
                            cp2y = parseFloat(toCoords[1]) * height;
                        }
                    }
                    
                    pathData += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
                } else {
                    pathData += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
                }
            }
        }
        
        // 如果是闭合路径
        if (points.length > 2) {
            pathData += ' Z';
        }
        
        return pathData;
    }

    /**
     * 生成默认形状SVG
     */
    private generateDefaultShapeSVG(nodeInfo: any): string {
        const { size } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        
        return `<rect x="0" y="0" width="${width}" height="${height}" fill="#f0f0f0" stroke="#cccccc" stroke-width="1"/>
                <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="10" fill="#999999" text-anchor="middle" dominant-baseline="middle">${nodeInfo.type}</text>`;
    }

    /**
     * XML转义
     */
    private escapeXML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    getNodePosition(nodeId: string) {
        const node = this.idToNode.get(nodeId);
        if (!node) return null;
        const frame = node.frame || {};
        return { x: frame.x ?? 0, y: frame.y ?? 0 };
    }

    findNodesByName(name: string) {
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
            const parent: string | null = (this.idToParentId.get(current) as string | null | undefined) ?? null;
            if (parent) ancestors.push(parent);
            current = parent;
        }
        return ancestors;
    }

    getRawNode(nodeId: string) {
        return this.idToNode.get(nodeId) || null;
    }

    /**
     * 获取页面的完整层级结构
     */
    getPageStructure(pageId: string, includeDetails: boolean = true, maxDepth: number = 10): any {
        if (!this.config || !this.config.document || !Array.isArray(this.config.document.pages)) {
            return null;
        }

        const page = this.config.document.pages.find((p: any) => 
            (p.id || p.do_objectID) === pageId
        );
        
        if (!page) {
            return null;
        }

        const buildHierarchy = (node: any, depth: number = 0): any => {
            if (depth >= maxDepth) {
                return null;
            }

            const nodeId = node.id || node.do_objectID;
            const result: any = {
                id: nodeId,
                name: node.name || '',
                type: node.type || node._class || ''
            };

            if (includeDetails) {
                const frame = node.frame || {};
                result.position = { x: frame.x ?? 0, y: frame.y ?? 0 };
                result.size = { width: frame.width ?? 0, height: frame.height ?? 0 };
                result.visible = node.isVisible !== false;
            }

            if (Array.isArray(node.layers) && node.layers.length > 0) {
                result.children = [];
                for (const child of node.layers) {
                    const childResult = buildHierarchy(child, depth + 1);
                    if (childResult) {
                        result.children.push(childResult);
                    }
                }
            }

            return result;
        };

        const pageStructure = {
            id: pageId,
            name: page.name || '',
            type: 'page',
            children: [] as any[]
        };

        if (Array.isArray(page.layers)) {
            for (const layer of page.layers) {
                const layerStructure = buildHierarchy(layer, 0);
                if (layerStructure) {
                    pageStructure.children.push(layerStructure);
                }
            }
        }

        return pageStructure;
    }

    /**
     * 获取整个文档的结构
     */
    getDocumentStructure(includeDetails: boolean = false, maxNodesPerPage: number = 200): any {
        if (!this.config || !this.config.document || !Array.isArray(this.config.document.pages)) {
            return { pages: [], totalPages: 0 };
        }

        const pages = [];
        for (const page of this.config.document.pages) {
            const pageId = page.id || page.do_objectID;
            const pageInfo = {
                id: pageId,
                name: page.name || '',
                type: 'page'
            };

            if (includeDetails && Array.isArray(page.layers)) {
                 const nodes: any[] = [];
                 let nodeCount = 0;
                
                const collectNodes = (layer: any) => {
                    if (nodeCount >= maxNodesPerPage) return;
                    
                    const nodeId = layer.id || layer.do_objectID;
                    if (nodeId) {
                        const nodeInfo = this.getNodeInfo(nodeId);
                        if (nodeInfo) {
                            nodes.push({
                                ...nodeInfo,
                                type: layer.type || layer._class || ''
                            });
                            nodeCount++;
                        }
                    }
                    
                    if (Array.isArray(layer.layers)) {
                        for (const child of layer.layers) {
                            collectNodes(child);
                        }
                    }
                };
                
                for (const layer of page.layers) {
                    collectNodes(layer);
                }
                
                (pageInfo as any).nodes = nodes;
                (pageInfo as any).nodeCount = nodeCount;
                (pageInfo as any).truncated = nodeCount >= maxNodesPerPage;
            } else {
                // 只统计节点数量
                let layerCount = 0;
                if (Array.isArray(page.layers)) {
                    for (const layer of page.layers) {
                        layerCount += this.countLayers(layer);
                    }
                }
                (pageInfo as any).layerCount = layerCount;
            }
            
            pages.push(pageInfo);
        }

        return {
            pages,
            totalPages: pages.length,
            includeDetails
        };
    }

    /**
     * 获取页面中所有节点 ID，按类型分组返回
     * @param pageId 页面 ID
     * @param typeFilter 可选，限制只返回指定类型的 ID（如 ['text', 'rectangle']）
     */
    getNodeIdList(pageId: string, typeFilter?: string[]): any {
        if (!this.config || !this.config.document || !Array.isArray(this.config.document.pages)) {
            return null;
        }
        const page = this.config.document.pages.find((p: any) => (p.id || p.do_objectID) === pageId);
        if (!page) {
            return null;
        }
        const groups: { [key: string]: string[] } = {};
        const collectIds = (node: any) => {
            const nodeId = node.id || node.do_objectID;
            const nodeType = node._class || node.type || 'unknown';
            if (nodeId) {
                if (!typeFilter || typeFilter.length === 0 || typeFilter.includes(nodeType)) {
                    if (!groups[nodeType]) {
                        groups[nodeType] = [];
                    }
                    groups[nodeType].push(nodeId);
                }
            }
            if (Array.isArray(node.layers)) {
                for (const child of node.layers) {
                    collectIds(child);
                }
            }
        };
        if (Array.isArray(page.layers)) {
            for (const layer of page.layers) {
                collectIds(layer);
            }
        }
        const summary: { [key: string]: number } = {};
        for (const [type, ids] of Object.entries(groups)) {
            summary[type] = ids.length;
        }
        return {
            pageId,
            pageName: page.name || '',
            groups,
            summary,
            totalIds: Object.values(groups).reduce((sum: number, arr: string[]) => sum + arr.length, 0)
        };
    }

    /**
     * 提取 bitmap 节点的 PNG 资源
     * @param bitmapIds bitmap 节点 ID 列表
     * @param sketchExtractDir sketch 解压目录（由 loadSketchByPath 时设置）
     */
    extractBitmaps(bitmapIds: string[], sketchExtractDir: string | undefined): any {
        if (!sketchExtractDir) {
            return { error: 'No sketch extract directory available. Please load a .sketch file first.', bitmaps: [] };
        }
        const fs = require('fs');
        const path = require('path');
        const results: any[] = [];
        for (const nodeId of bitmapIds) {
            const node = this.idToNode.get(nodeId);
            if (!node) {
                results.push({ nodeId, error: 'Node not found' });
                continue;
            }
            if (node._class !== 'bitmap') {
                results.push({ nodeId, name: node.name || '', error: 'Not a bitmap node' });
                continue;
            }
            const ref = node.image && (node.image._ref || node.image.path);
            if (!ref) {
                results.push({ nodeId, name: node.name || '', error: 'No image reference' });
                continue;
            }
            const imgPath = path.join(sketchExtractDir, ref.startsWith('images/') ? ref : 'images/' + ref);
            if (!fs.existsSync(imgPath)) {
                results.push({ nodeId, name: node.name || '', error: `Image file not found: ${ref}` });
                continue;
            }
            try {
                const buffer = fs.readFileSync(imgPath);
                const base64 = buffer.toString('base64');
                const ext = path.extname(imgPath).slice(1) || 'png';
                results.push({
                    nodeId,
                    name: node.name || '',
                    base64,
                    mimeType: `image/${ext}`,
                    size: buffer.length,
                    fileName: path.basename(ref)
                });
            } catch (e: any) {
                results.push({ nodeId, name: node.name || '', error: `Failed to read: ${e.message}` });
            }
        }
        return {
            bitmaps: results,
            total: results.length,
            successCount: results.filter((r: any) => !r.error).length
        };
    }
}