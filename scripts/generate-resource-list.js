import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.resolve(__dirname, '../public');
const OUTPUT_FILE = path.resolve(PUBLIC_DIR, 'resource-list.json');

const ASSETS_DIR = path.resolve(PUBLIC_DIR, 'assets');
const AUDIO_DIR = path.resolve(PUBLIC_DIR, 'audio');

function getFilesRecursively(dir, baseDir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath, baseDir));
        } else {
            // 只收集特定格式的文件
            const ext = path.extname(file).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.wav', '.ogg'].includes(ext)) {
                // 转换为相对于 public 目录的路径，并确保使用正斜杠
                const relativePath = '/' + path.relative(baseDir, filePath).split(path.sep).join('/');
                results.push(relativePath);
            }
        }
    });
    return results;
}

function generate() {
    console.log('正在扫描资源文件...');
    
    const images = getFilesRecursively(ASSETS_DIR, PUBLIC_DIR);
    const audios = getFilesRecursively(AUDIO_DIR, PUBLIC_DIR);
    
    const manifest = {
        images,
        audios,
        generatedAt: new Date().toISOString(),
        totalImages: images.length,
        totalAudios: audios.length
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    console.log(`资源清单已生成: ${OUTPUT_FILE}`);
    console.log(`共发现 ${images.length} 张图片和 ${audios.length} 个音频文件。`);
}

generate();

