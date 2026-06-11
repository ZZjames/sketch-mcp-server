import fs from 'fs';
import path from 'path';
import os from 'os';
import extract from 'extract-zip';
import { SketchConfig } from '../types';

/**
 * 检查文件是否存在且为文件
 */
export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * 检查路径是否存在且为目录
 */
export function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 检查是否为Sketch归档文件
 */
export function isSketchArchive(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.sketch') || lower.endsWith('.sketon') || lower.endsWith('.zip');
}

/**
 * 解压Sketch归档文件到临时目录
 */
export async function extractSketchArchive(archivePath: string): Promise<string> {
  const abs = path.resolve(archivePath);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-mcp-'));
  await extract(abs, { dir: tempDir });
  return tempDir;
}

/**
 * 从目录加载Sketch配置
 */
export function loadSketchConfigFromDirectory(directoryPath: string): SketchConfig {
  const documentPath = path.join(directoryPath, 'document.json');
  const pagesDir = path.join(directoryPath, 'pages');
  
  if (!isFile(documentPath)) {
    throw new Error(`document.json not found in ${directoryPath}`);
  }
  
  const document = JSON.parse(fs.readFileSync(documentPath, 'utf-8'));
  let pages: any[] = [];
  
  if (isDirectory(pagesDir)) {
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.json'));
    pages = files.map(f => JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf-8')));
  }
  
  return {
    document: {
      id: document?.do_objectID || document?.id || 'doc',
      name: document?.name || 'Sketch',
      pages
    }
  };
}

/**
 * 从JSON文件加载Sketch配置
 */
export function loadSketchConfigFromJsonFile(filePath: string): SketchConfig {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 从路径加载Sketch配置（统一入口）
 *
 * 加载来源是 .sketch / 目录时，会在返回的 config 上挂一个 _extractDir 字段，
 * 供 extractBitmaps 工具读取原始 bitmap 资源文件。
 */
export async function loadSketchConfigFromPath(inputPath: string): Promise<SketchConfig> {
  const abs = path.resolve(inputPath);

  // 处理归档文件
  if (isFile(abs) && isSketchArchive(abs)) {
    const tempDir = await extractSketchArchive(abs);
    const config = loadSketchConfigFromDirectory(tempDir);
    // Save extract dir for extractBitmaps tool
    (config as any)._extractDir = tempDir;
    return config;
  }

  // 处理目录
  if (isDirectory(abs)) {
    const config = loadSketchConfigFromDirectory(abs);
    (config as any)._extractDir = abs;
    return config;
  }

  // 处理JSON文件
  if (isFile(abs)) {
    return loadSketchConfigFromJsonFile(abs);
  }

  throw new Error(`Path not found: ${inputPath}`);
}