/**
 * 代码生成器（v1.4.0 引入，目前为孤儿模块，未被其他文件 require）
 * 为对齐 backup dist 行为保留 src 文件。
 */
export class CodeGenerator {
    private tools: any;

    constructor(tools: any) {
        this.tools = tools;
    }

    generateCode(nodeId: string): string {
        const nodeInfo = this.tools.getNodeInfo(nodeId);
        const position = this.tools.getNodePosition(nodeId);
        let code = `// Generated from Sketch node\n`;
        code += `const nodeId = '${nodeId}';\n`;
        code += `const nodeInfo = ${JSON.stringify(nodeInfo, null, 2)};\n`;
        if (position) {
            code += `const position = { x: ${position.x}, y: ${position.y} };\n`;
        } else {
            code += `const position = null;\n`;
        }
        return code;
    }
}
