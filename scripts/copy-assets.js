#!/usr/bin/env node
/**
 * 编译后把 src 下非 .ts 静态资源（如 data/*.json）拷贝到 dist。
 * tsc 不会处理这些文件，需要单独复制。
 */
const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.join(__dirname, '..', 'src');
const DIST_ROOT = path.join(__dirname, '..', 'dist');

/**
 * 递归收集 srcDir 下所有匹配指定后缀的文件，返回相对路径数组
 */
function collectFiles(dir, exts, baseDir = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, exts, baseDir));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(path.relative(baseDir, full));
    }
  }
  return out;
}

function copyFile(rel) {
  const src = path.join(SRC_ROOT, rel);
  const dst = path.join(DIST_ROOT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`copied: ${rel}`);
}

const assets = collectFiles(SRC_ROOT, ['.json']);
for (const rel of assets) copyFile(rel);

console.log(`copy-assets done. Total: ${assets.length} file(s).`);
