/**
 * 样式提取器 - 负责从Sketch节点中提取样式信息
 */
export class StyleExtractor {
    
    /**
     * 提取节点样式信息
     */
    extractStyleInfo(style: any): any {
        if (!style) {
            return {
                fills: [],
                borders: [],
                shadows: [],
                innerShadows: [],
                blur: {
                    type: 0,
                    radius: 10,
                    isEnabled: false
                }
            };
        }

        const result: any = {
            fills: [],
            borders: [],
            shadows: [],
            innerShadows: [],
            blur: {
                type: style.blur?.type || 0,
                radius: style.blur?.radius || 10,
                isEnabled: style.blur?.isEnabled || false
            }
        };

        // 提取填充
        if (Array.isArray(style.fills)) {
            for (const fill of style.fills) {
                if (fill.isEnabled) {
                    const fillData: any = {
                        type: fill.fillType || 0,
                        color: this.extractColor(fill.color),
                        opacity: fill.contextSettings?.opacity || 1
                    };
                    // 渐变填充：提取 gradient stops/from/to
                    if (fill.fillType > 0 && fill.gradient) {
                        fillData.gradient = this.extractGradient(fill.gradient);
                    }
                    result.fills.push(fillData);
                }
            }
        }

        // 提取边框
        if (Array.isArray(style.borders)) {
            for (const border of style.borders) {
                if (border.isEnabled) {
                    result.borders.push({
                        color: this.extractColor(border.color),
                        thickness: border.thickness || 1,
                        position: border.position || 0,
                        opacity: border.contextSettings?.opacity || 1
                    });
                }
            }
        }

        // 提取阴影
        if (Array.isArray(style.shadows)) {
            for (const shadow of style.shadows) {
                if (shadow.isEnabled) {
                    result.shadows.push({
                        color: this.extractColor(shadow.color),
                        offsetX: shadow.offsetX || 0,
                        offsetY: shadow.offsetY || 0,
                        blurRadius: shadow.blurRadius || 0,
                        spread: shadow.spread || 0
                    });
                }
            }
        }

        // 提取内阴影
        if (Array.isArray(style.innerShadows)) {
            for (const innerShadow of style.innerShadows) {
                if (innerShadow.isEnabled) {
                    result.innerShadows.push({
                        color: this.extractColor(innerShadow.color),
                        offsetX: innerShadow.offsetX || 0,
                        offsetY: innerShadow.offsetY || 0,
                        blurRadius: innerShadow.blurRadius || 0,
                        spread: innerShadow.spread || 0
                    });
                }
            }
        }

        return result;
    }

    /**
     * 提取渐变数据
     * @param gradient Sketch gradient object
     * @returns 提取后的 gradient（含 stops/from/to/gradientType/elipseLength）
     */
    extractGradient(gradient: any): any {
        if (!gradient) return null;
        const result: any = {
            gradientType: gradient.gradientType || 0, // 0=linear, 1=radial, 2=angular
            from: this.parsePointString(gradient.from),
            to: this.parsePointString(gradient.to),
            stops: []
        };
        if (Array.isArray(gradient.stops)) {
            for (const stop of gradient.stops) {
                result.stops.push({
                    position: stop.position || 0,
                    color: this.extractColor(stop.color)
                });
            }
        }
        // radial gradient extra
        if (gradient.gradientType === 1 && gradient.elipseLength) {
            result.elipseLength = gradient.elipseLength;
        }
        return result;
    }

    /**
     * 解析 Sketch 坐标字符串 "{x, y}" → {x, y}
     */
    parsePointString(str: any): { x: number; y: number } {
        if (!str) return { x: 0, y: 0 };
        if (typeof str === 'object') return { x: str.x || 0, y: str.y || 0 };
        const coords = String(str).match(/([\d.-]+)/g);
        if (coords && coords.length >= 2) {
            return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
        }
        return { x: 0, y: 0 };
    }

    /**
     * 提取颜色信息
     */
    extractColor(color: any): any {
        if (!color) {
            return {
                hex: '#000000',
                rgba: { r: 0, g: 0, b: 0, a: 1 }
            };
        }

        const r = Math.round((color.red || 0) * 255);
        const g = Math.round((color.green || 0) * 255);
        const b = Math.round((color.blue || 0) * 255);
        const a = color.alpha !== undefined ? color.alpha : 1;

        return {
            hex: this.rgbaToHex(r, g, b, a),
            rgba: { r, g, b, a }
        };
    }

    /**
     * RGBA转十六进制
     */
    private rgbaToHex(r: number, g: number, b: number, a: number): string {
        const toHex = (n: number) => {
            const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        let hex = '#' + toHex(r) + toHex(g) + toHex(b);
        if (a < 1) {
            hex += toHex(a * 255);
        }
        return hex;
    }

    /**
     * 提取文本信息
     */
    extractTextInfo(attributedString: any): any {
        if (!attributedString) {
            return {
                content: '',
                fontSize: 12,
                fontFamily: 'Arial',
                color: '#000000',
                alignment: 'left'
            };
        }

        const content = attributedString.string || '';
        let fontSize = 12;
        let fontFamily = 'Arial';
        let color = '#000000';
        let alignment = 'left';

        if (Array.isArray(attributedString.attributes)) {
            for (const attr of attributedString.attributes) {
                if (attr.attributes) {
                    if (attr.attributes.MSAttributedStringFontAttribute) {
                        const font = attr.attributes.MSAttributedStringFontAttribute.attributes;
                        fontSize = font.size || fontSize;
                        fontFamily = font.name || fontFamily;
                    }
                    if (attr.attributes.MSAttributedStringColorAttribute) {
                        const colorInfo = this.extractColor(attr.attributes.MSAttributedStringColorAttribute);
                        color = colorInfo.hex;
                    }
                }
            }
        }

        return { content, fontSize, fontFamily, color, alignment };
    }

    /**
     * 提取形状信息
     */
    extractShapeInfo(node: any): any {
        const result: any = {
            cornerRadius: 0,
            path: null
        };

        if (node._class === 'rectangle' && node.fixedRadius !== undefined) {
            result.cornerRadius = node.fixedRadius;
        }

        if (node._class === 'shapePath' && node.path) {
            result.path = {
                isClosed: node.path.isClosed || false,
                pointRadiusBehaviour: node.path.pointRadiusBehaviour || 1
            };
        }

        return result;
    }

    /**
     * 提取图片信息
     */
    extractImageInfo(node: any): any {
        const result: any = {
            imageType: 'unknown',
            originalSize: { width: 0, height: 0 }
        };

        if (node.image && node.image._ref) {
            result.imageRef = node.image._ref;
        }

        if (node.frame) {
            result.originalSize = {
                width: node.frame.width || 0,
                height: node.frame.height || 0
            };
        }

        return result;
    }

    /**
     * 提取Symbol信息
     */
    extractSymbolInfo(node: any): any {
        const result: any = {
            symbolID: '',
            overrides: []
        };

        if (node._class === 'symbolInstance') {
            result.symbolID = node.symbolID || '';
            
            if (Array.isArray(node.overrideValues)) {
                for (const override of node.overrideValues) {
                    result.overrides.push({
                        overrideName: override.overrideName || '',
                        value: override.value
                    });
                }
            }
        } else if (node._class === 'symbolMaster') {
            result.symbolID = node.symbolID || '';
            result.includeBackgroundColorInExport = node.includeBackgroundColorInExport || false;
            result.includeBackgroundColorInInstance = node.includeBackgroundColorInInstance || false;
        }

        return result;
    }
}