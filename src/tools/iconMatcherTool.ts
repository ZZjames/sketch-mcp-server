const fs = require('fs');
const path = require('path');

interface IconCandidate {
    source: 'compound' | 'iconfont';
    score: number;
    iconType?: string;    // newFont icon type, e.g. "icon-biao"
    antdIcon?: string;    // antd icon name when source = 'compound' or as fallback
    library?: string;     // iconfont library name when source = 'iconfont'
    matchedBy?: string;   // which keyword/rule matched
    rationale?: string;
}

/**
 * 图标匹配工具：根据节点名匹配 iconfont 图标库
 *
 * v1.5.0 改造：
 *  - 评分制：compoundIcons 命中 +100、keyword 精确 +20、keyword 包含 +10、nodeName 包含 +5、semanticTag +3
 *  - 每个 nodeName 返回 Top-3 候选（按分数降序）
 *  - 消费 iconfont-mapping.json 顶层 compoundIcons 段，避免『编组11备份』→PlusOutlined 这种语义吞噬
 *  - 兼容旧字段（matchedIcons/unmatched/recommendFallback）
 */
export class IconMatcherTool {
    private _mappingCache: any = null;

    constructor() {
        this._mappingCache = null;
    }

    private _loadMapping(): any {
        if (this._mappingCache) return this._mappingCache;
        const mappingPath = path.join(__dirname, '..', 'data', 'iconfont-mapping.json');
        if (fs.existsSync(mappingPath)) {
            this._mappingCache = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
        } else {
            this._mappingCache = { libraries: {}, compoundIcons: { rules: [] } };
        }
        return this._mappingCache;
    }

    private _extractKeywords(nodeName: string): string {
        return nodeName
            .replace(/icon\s*\d*/gi, '')
            .replace(/\d+\s*px/gi, '')
            .replace(/\s+/g, '')
            .replace(/[_\-\/\\]/g, '')
            .trim();
    }

    /**
     * 评估一个 nodeName 对所有候选图标的匹配分数
     */
    private _scoreCandidates(nodeName: string, library: string, mapping: any): IconCandidate[] {
        const candidates: IconCandidate[] = [];
        const keyword = this._extractKeywords(nodeName);
        const lowerName = nodeName.toLowerCase();
        const lowerKey = keyword.toLowerCase();

        // 1) compoundIcons: triggers 是 string[][]，每组必须至少命中一个，所有组都命中才生效
        const compoundRules = mapping.compoundIcons?.rules || [];
        for (const rule of compoundRules) {
            const triggers: string[][] = rule.triggers || [];
            if (triggers.length === 0) continue;
            const allGroupsHit = triggers.every((group) =>
                group.some((kw) => lowerName.includes(kw.toLowerCase()) || lowerKey.includes(kw.toLowerCase()))
            );
            if (allGroupsHit) {
                // 命中越多组、组内关键词越精准，分数越高
                let bonus = 0;
                for (const group of triggers) {
                    for (const kw of group) {
                        const lkw = kw.toLowerCase();
                        if (lowerKey === lkw) bonus += 5;
                        else if (lowerKey.includes(lkw) || lkw.includes(lowerKey)) bonus += 2;
                    }
                }
                candidates.push({
                    source: 'compound',
                    score: 100 + bonus,
                    antdIcon: rule.antdIcon,
                    matchedBy: triggers.map((g) => g.join('|')).join(' + '),
                    rationale: rule.rationale
                });
            }
        }

        // 2) iconfont library: keywords + semanticTags
        const lib = mapping.libraries?.[library];
        const icons = lib?.icons || {};
        for (const [iconType, iconDef] of Object.entries<any>(icons)) {
            const keywords: string[] = iconDef.keywords || [];
            const semanticTags: string[] = iconDef.semanticTags || [];
            let bestScore = 0;
            let bestMatchedBy = '';

            for (const kw of keywords) {
                const lkw = kw.toLowerCase();
                let s = 0;
                if (lowerKey === lkw) s = 20;
                else if (lowerKey.includes(lkw) || lkw.includes(lowerKey)) s = 10;
                else if (lowerName.includes(lkw)) s = 5;
                if (s > bestScore) {
                    bestScore = s;
                    bestMatchedBy = `keyword:${kw}`;
                }
            }
            for (const tag of semanticTags) {
                const ltag = tag.toLowerCase();
                if (lowerName.includes(ltag) || lowerKey.includes(ltag)) {
                    const s = 3;
                    if (s > bestScore || (bestScore === 0)) {
                        // semantic tag 只在没有 keyword 命中时计入，避免重复加分
                        if (bestScore === 0) {
                            bestScore = s;
                            bestMatchedBy = `semanticTag:${tag}`;
                        }
                    }
                }
            }

            if (bestScore > 0) {
                candidates.push({
                    source: 'iconfont',
                    score: bestScore,
                    iconType,
                    library,
                    antdIcon: iconDef.fallback ? String(iconDef.fallback).replace(/^antd\s+/, '') : undefined,
                    matchedBy: bestMatchedBy
                });
            }
        }

        return candidates.sort((a, b) => b.score - a.score);
    }

    /**
     * 匹配图标
     * @param nodeNames 节点名列表
     * @param library 图标库名称，默认 "newFont"
     * @returns 匹配结果（含 Top-3 候选 + 兼容旧字段）
     */
    matchIcons(nodeNames: string[], library: string = 'newFont'): any {
        const mapping = this._loadMapping();
        const lib = mapping.libraries?.[library];
        if (!lib) {
            return {
                error: `Library "${library}" not found. Available: ${Object.keys(mapping.libraries || {}).join(', ')}`,
                results: [],
                matchedIcons: [],
                unmatched: nodeNames,
                recommendFallback: {}
            };
        }

        const results: any[] = [];
        const matchedIcons: any[] = [];
        const unmatched: string[] = [];
        const recommendFallback: { [key: string]: string } = {};

        for (const nodeName of nodeNames) {
            const candidates = this._scoreCandidates(nodeName, library, mapping);
            const top3 = candidates.slice(0, 3);
            const top = top3[0];

            results.push({
                nodeName,
                top3,
                bestMatch: top || null
            });

            if (top) {
                if (top.source === 'compound') {
                    // compound 强映射：直接推荐 antd 复合图标
                    matchedIcons.push({
                        nodeName,
                        iconType: top.antdIcon ? `antd ${top.antdIcon}` : 'unknown',
                        library: 'antd',
                        source: 'compound',
                        matchedBy: top.matchedBy,
                        rationale: top.rationale
                    });
                } else {
                    matchedIcons.push({
                        nodeName,
                        iconType: top.iconType,
                        library: top.library,
                        keyword: top.matchedBy
                    });
                }
            } else {
                unmatched.push(nodeName);
                recommendFallback[nodeName] = 'antd QuestionOutlined';
            }
        }

        return {
            results,
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
