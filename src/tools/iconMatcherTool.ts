const fs = require('fs');
const path = require('path');

/**
 * 图标匹配工具：根据节点名匹配 iconfont 图标库
 *
 * v1.3.x 新增。映射数据由 data/iconfont-mapping.json 提供（编译期由 copy-assets.js 复制到 dist/data/）。
 */
export class IconMatcherTool {
    private _mappingCache: any = null;

    constructor() {
        this._mappingCache = null;
    }

    /**
     * 加载映射数据（懒加载，只加载一次）
     */
    private _loadMapping(): any {
        if (this._mappingCache) return this._mappingCache;
        const mappingPath = path.join(__dirname, '..', 'data', 'iconfont-mapping.json');
        if (fs.existsSync(mappingPath)) {
            this._mappingCache = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
        } else {
            this._mappingCache = { libraries: {} };
        }
        return this._mappingCache;
    }

    /**
     * 从节点名中提取关键词
     * 例如: "表 icon" → "表", "文件icon" → "文件", "菜单 icon 16" → "菜单"
     */
    private _extractKeywords(nodeName: string): string {
        // Remove common suffixes and noise
        const cleaned = nodeName
            .replace(/icon\s*\d*/gi, '')
            .replace(/\d+\s*px/gi, '')
            .replace(/\s+/g, '')
            .replace(/[_\-\/\\]/g, '')
            .trim();
        return cleaned;
    }

    /**
     * 匹配图标
     * @param nodeNames 节点名列表
     * @param library 图标库名称，默认 "newFont"
     * @returns 匹配结果
     */
    matchIcons(nodeNames: string[], library: string = 'newFont'): any {
        const mapping = this._loadMapping();
        const lib = mapping.libraries[library];
        if (!lib) {
            return {
                error: `Library "${library}" not found. Available: ${Object.keys(mapping.libraries).join(', ')}`,
                matchedIcons: [],
                unmatched: nodeNames,
                recommendFallback: {}
            };
        }

        const icons = lib.icons || {};
        const matchedIcons: any[] = [];
        const unmatched: string[] = [];
        const recommendFallback: { [key: string]: string } = {};

        for (const nodeName of nodeNames) {
            const keyword = this._extractKeywords(nodeName);
            if (!keyword) {
                unmatched.push(nodeName);
                continue;
            }

            let found = false;
            for (const [iconType, iconDef] of Object.entries<any>(icons)) {
                const keywords = iconDef.keywords || [];
                // Check if any keyword matches the node name or extracted keyword
                for (const kw of keywords) {
                    if (keyword.includes(kw) || kw.includes(keyword) || nodeName.includes(kw)) {
                        matchedIcons.push({
                            nodeName,
                            iconType,
                            library,
                            keyword: kw
                        });
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (!found) {
                unmatched.push(nodeName);
                // Try to suggest a fallback from antd icons
                for (const [, iconDef] of Object.entries<any>(icons)) {
                    const keywords = iconDef.keywords || [];
                    for (const kw of keywords) {
                        if (keyword.includes(kw) || kw.includes(keyword)) {
                            recommendFallback[nodeName] = iconDef.fallback || `antd QuestionOutlined`;
                            break;
                        }
                    }
                    if (recommendFallback[nodeName]) break;
                }
                // If still no fallback, suggest generic antd icon
                if (!recommendFallback[nodeName]) {
                    recommendFallback[nodeName] = 'antd QuestionOutlined';
                }
            }
        }

        return {
            matchedIcons,
            unmatched,
            recommendFallback,
            library,
            totalProcessed: nodeNames.length,
            matchRate: nodeNames.length > 0
                ? ((matchedIcons.length / nodeNames.length) * 100).toFixed(1) + '%'
                : '0%'
        };
    }
}
