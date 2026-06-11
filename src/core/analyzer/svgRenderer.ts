/**
 * SVG渲染器 - 负责将Sketch节点渲染为SVG
 *
 * v1.3.x 新增：
 *  - 渐变填充支持（linear/radial，通过 <defs> 注入 <linearGradient>/<radialGradient>）
 *  - 阴影 filter 支持（通过 <defs> 注入 <filter><feDropShadow/></filter>）
 *  - opacity wrapper（透明度 < 1 时套 <g opacity="x">）
 *  - generateShapePathSVG 改为从 nodeInfo._pathData 读取路径
 */
export class SvgRenderer {

    /**
     * 渲染节点为SVG
     */
    renderNodeAsSVG(nodeInfo: any): any {
        const { size, name, id } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        // 节点 ID 清洗后用于 SVG 内部 def 的 id 前缀，避免特殊字符
        const nodeId = (id || 'node').replace(/[^a-zA-Z0-9_-]/g, '_');

        let svgContent = '';

        switch (nodeInfo.type) {
            case 'rectangle':
            case 'shape':
                svgContent = this.generateRectangleSVG(nodeInfo, nodeId);
                break;
            case 'oval':
                svgContent = this.generateOvalSVG(nodeInfo, nodeId);
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
                svgContent = this.generateShapePathSVG(nodeInfo, nodeId);
                break;
            default:
                svgContent = this.generateDefaultShapeSVG(nodeInfo);
        }

        // Opacity wrapper
        const opacity = nodeInfo.opacity !== undefined ? nodeInfo.opacity : 1;
        if (opacity < 1) {
            svgContent = `<g opacity="${opacity}">${svgContent}</g>`;
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
    private generateRectangleSVG(nodeInfo: any, nodeId: string): string {
        const { size, style } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;

        const { fillRef, defs } = this.buildFillRef(style, nodeId);
        let stroke = 'none';
        let strokeWidth = 0;
        let rx = 0;

        if (style && style.borders && style.borders.length > 0) {
            const borderStyle = style.borders[0];
            stroke = borderStyle.color?.hex || '#000000';
            strokeWidth = borderStyle.thickness || 1;
        }

        if (nodeInfo.shape && nodeInfo.shape.cornerRadius) {
            rx = nodeInfo.shape.cornerRadius;
        }

        const { filterAttr, defs: shadowDefs } = this.buildShadowFilter(style, nodeId);
        const allDefs = (defs || '') + (shadowDefs || '');
        return (allDefs ? `<defs>${allDefs}</defs>` : '') +
            `<rect x="0" y="0" width="${width}" height="${height}" rx="${rx}" fill="${fillRef}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`;
    }

    /**
     * 生成椭圆SVG
     */
    private generateOvalSVG(nodeInfo: any, nodeId: string): string {
        const { size, style } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;
        const cx = width / 2;
        const cy = height / 2;
        const rx = width / 2;
        const ry = height / 2;

        const { fillRef, defs } = this.buildFillRef(style, nodeId);
        let stroke = 'none';
        let strokeWidth = 0;

        if (style && style.borders && style.borders.length > 0) {
            const borderStyle = style.borders[0];
            stroke = borderStyle.color?.hex || '#000000';
            strokeWidth = borderStyle.thickness || 1;
        }

        const { filterAttr, defs: shadowDefs } = this.buildShadowFilter(style, nodeId);
        const allDefs = (defs || '') + (shadowDefs || '');
        return (allDefs ? `<defs>${allDefs}</defs>` : '') +
            `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fillRef}" stroke="${stroke}" stroke-width="${strokeWidth}"${filterAttr}/>`;
    }

    /**
     * 生成文本SVG
     */
    private generateTextSVG(nodeInfo: any): string {
        const { size, text } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;

        const content = text?.content || 'Text';
        const fontSize = text?.fontSize || 12;
        const fontFamily = text?.fontFamily || 'Arial';
        const color = text?.color || '#000000';

        const x = 10;
        const y = fontSize + 5;

        return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" fill="${color}">${this.escapeXML(content)}</text>`;
    }

    /**
     * 生成Symbol实例SVG
     */
    private generateSymbolInstanceSVG(nodeInfo: any): string {
        const { size } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;

        return `<rect x="0" y="0" width="${width}" height="${height}" fill="#e0e0e0" stroke="#999999" stroke-width="1" stroke-dasharray="3,3"/>
                <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="10" fill="#666666" text-anchor="middle" dominant-baseline="middle">Symbol</text>`;
    }

    /**
     * 生成Group SVG
     */
    generateGroupSVG(nodeInfo: any, childRenderer?: (childId: string) => string): string {
        const { size } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;

        let childrenSVG = '';

        // 如果提供了子节点渲染器，使用它来渲染子节点
        if (childRenderer && nodeInfo.children) {
            for (const childId of nodeInfo.children) {
                const childSVG = childRenderer(childId);
                if (childSVG) {
                    childrenSVG += `<g transform="translate(0, 0)">${childSVG}</g>`;
                }
            }
        }

        // 如果有子节点内容，添加Group背景（可选）
        if (childrenSVG) {
            const backgroundRect = `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="none"/>`;
            return backgroundRect + childrenSVG;
        }

        // 如果没有子节点或渲染失败，显示Group占位符
        return `<rect x="0" y="0" width="${width}" height="${height}" fill="#f8f8f8" stroke="#cccccc" stroke-width="1" stroke-dasharray="3,3"/>
                <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="12" fill="#999999" text-anchor="middle" dominant-baseline="middle">Group</text>`;
    }

    /**
     * 生成Artboard SVG
     */
    private generateArtboardSVG(nodeInfo: any): string {
        const { size, style } = nodeInfo;
        const width = size.width || 100;
        const height = size.height || 100;

        let backgroundColor = '#ffffff';

        if (style && style.fills && style.fills.length > 0) {
            const fill = style.fills[0];
            if (fill.color) {
                backgroundColor = fill.color.hex || '#ffffff';
            }
        }

        return `<rect x="0" y="0" width="${width}" height="${height}" fill="${backgroundColor}" stroke="#dddddd" stroke-width="2"/>
                <text x="10" y="20" font-family="Arial" font-size="12" fill="#666666">${nodeInfo.name || 'Artboard'}</text>`;
    }

    /**
     * 生成ShapePath SVG
     * pathData 通过 nodeInfo._pathData 传入（由 analyzer 在调用前注入）
     */
    generateShapePathSVG(nodeInfo: any, nodeId?: string): string {
        const pathData = nodeInfo._pathData;
        if (!pathData) {
            return this.generateDefaultShapeSVG(nodeInfo);
        }

        const { style } = nodeInfo;
        const { fillRef, defs } = this.buildFillRef(style, nodeId || 'sp');
        let strokeColor = 'none';
        let strokeWidth = 0;

        if (style && style.borders && style.borders.length > 0) {
            const border = style.borders[0];
            if (border.color) {
                strokeColor = border.color.hex || '#000000';
                strokeWidth = border.thickness || 1;
            }
        }

        const { filterAttr, defs: shadowDefs } = this.buildShadowFilter(style, nodeId);
        const allDefs = (defs || '') + (shadowDefs || '');
        return (allDefs ? `<defs>${allDefs}</defs>` : '') +
            `<path d="${pathData}" fill="${fillRef}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${filterAttr}/>`;
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
     * 构建 fill 引用（纯色或渐变）并收集 defs
     */
    buildFillRef(style: any, nodeId: string | undefined): { fillRef: string; defs: string } {
        let fillRef = '#cccccc';
        let defs = '';
        if (style && style.fills && style.fills.length > 0) {
            const fillStyle = style.fills[0];
            // 渐变填充
            if (fillStyle.gradient && fillStyle.type > 0) {
                const gradId = `grad-${nodeId}`;
                fillRef = `url(#${gradId})`;
                defs += this.generateGradientDef(fillStyle.gradient, gradId);
            } else {
                fillRef = fillStyle.color?.hex || fillRef;
            }
        }
        return { fillRef, defs };
    }

    /**
     * 生成渐变 <defs> 元素
     */
    generateGradientDef(gradient: any, gradId: string): string {
        const stops = (gradient.stops || [])
            .map((s: any) => {
                const color = s.color?.hex || '#000000';
                return `<stop offset="${(s.position || 0).toFixed(3)}" stop-color="${color}"/>`;
            })
            .join('');
        if (gradient.gradientType === 1) {
            // radial
            const fx = ((gradient.from?.x || 0.5) * 100).toFixed(1);
            const fy = ((gradient.from?.y || 0.5) * 100).toFixed(1);
            const r = (((gradient.elipseLength || 0.5) / 2) * 100).toFixed(1);
            return `<radialGradient id="${gradId}" cx="${fx}%" cy="${fy}%" r="${r}%">${stops}</radialGradient>`;
        }
        // linear (default)
        const x1 = ((gradient.from?.x || 0) * 100).toFixed(1);
        const y1 = ((gradient.from?.y || 0) * 100).toFixed(1);
        const x2 = ((gradient.to?.x || 1) * 100).toFixed(1);
        const y2 = ((gradient.to?.y || 1) * 100).toFixed(1);
        return `<linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
    }

    /**
     * 生成阴影 filter 属性并追加到 defs
     * @returns filter attribute string (e.g. ' filter="url(#shadow-xxx)"')
     */
    buildShadowFilter(style: any, nodeId: string | undefined): { filterAttr: string; defs: string } {
        if (!style || !style.shadows || style.shadows.length === 0) return { filterAttr: '', defs: '' };
        const filterId = `shadow-${nodeId}`;
        let filterContent = '';
        for (const s of style.shadows) {
            const color = s.color?.rgba || { r: 0, g: 0, b: 0, a: 0.3 };
            const floodColor = `rgba(${color.r},${color.g},${color.b},${color.a})`;
            filterContent += `<feDropShadow dx="${s.offsetX || 0}" dy="${s.offsetY || 0}" stdDeviation="${(s.blurRadius || 0) / 2}" flood-color="${floodColor}"/>`;
        }
        const defs = `<filter id="${filterId}">${filterContent}</filter>`;
        return { filterAttr: ` filter="url(#${filterId})"`, defs };
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
            .replace(/'/g, '&#39;');
    }
}
