import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const project = fileURLToPath(new URL('.', import.meta.url));
const avatar = 'data/image/main.jpg';
const formats = {
  image: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  video: new Set(['.mp4', '.webm']),
  shorts: new Set(['.mp4', '.webm']),
};
const collator = new Intl.Collator('en', { numeric: true });
const compare = (a, b) => collator.compare(a, b) || (a < b ? -1 : Number(a > b));
const run = promisify(execFile);

export async function build(root, { thumbnails = false } = {}) {
  const output = join(root, 'dist');
  if (!(await stat(join(root, avatar), { throwIfNoEntry: false }))?.isFile()) {
    throw new Error(`找不到頭貼：${avatar}`);
  }

  const entries = [];
  for (const [type, extensions] of Object.entries(formats)) {
    const directory = `data/${type}`;
    const files = await readdir(join(root, directory), { withFileTypes: true })
      .catch(error => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
    for (const file of files) {
      const path = `${directory}/${file.name}`;
      if (!file.isFile() || path === avatar || !extensions.has(extname(file.name).toLowerCase())) continue;
      entries.push({
        type, path,
        name: file.name.slice(0, -extname(file.name).length),
        url: path.split('/').map(encodeURIComponent).join('/'),
      });
    }
  }
  entries.sort((a, b) => compare(a.name, b.name) || compare(a.path, b.path));

  await rm(output, { recursive: true, force: true });
  await Promise.all(Object.keys(formats).map(type => mkdir(join(output, 'data', type), { recursive: true })));
  await Promise.all([avatar, ...entries.map(item => item.path)].map(path =>
    copyFile(join(root, path), join(output, path))));
  const videos = entries.filter(item => item.type === 'video');
  if (thumbnails && videos.length) {
    const ffmpeg = process.env.MINI_FFMPEG || 'ffmpeg';
    await mkdir(join(output, 'posters'), { recursive: true });
    for (const [index, item] of videos.entries()) {
      const poster = `posters/${index + 1}.jpg`;
      try {
        await run(ffmpeg, ['-nostdin', '-v', 'error', '-i', join(root, item.path),
          '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=decrease',
          '-q:v', '4', '-update', '1', join(output, poster)], { windowsHide: true });
        if ((await stat(join(output, poster), { throwIfNoEntry: false }))?.size) item.poster = poster;
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.warn('找不到 FFmpeg，影片暫以播放圖示顯示。請將 FFmpeg 加入 PATH 或設定 MINI_FFMPEG。');
          break;
        }
        console.warn(`無法擷取影片縮圖：${item.path}`);
      }
    }
  }
  await Promise.all(['styles.css', 'gallery.js'].map(file =>
    copyFile(join(project, 'src', file), join(output, file))));
  const template = await readFile(join(project, 'src', 'index.html'), 'utf8');
  const render = (items, assetPrefix = '') => {
    const json = JSON.stringify(items).replaceAll('<', '\\u003c');
    return template
      .replace('href="styles.css"', `href="${assetPrefix}styles.css"`)
      .replace('src="gallery.js"', `src="${assetPrefix}gallery.js"`)
      .replace('<!-- media -->', () => json);
  };
  await writeFile(join(output, 'index.html'), render(entries));
  const rootEntries = entries.map(item =>
    item.poster ? { ...item, poster: `dist/${item.poster}` } : item);
  await writeFile(join(root, 'index.html'), render(rootEntries, 'src/'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const localConfig = join(project, '.env.local');
  if (await stat(localConfig, { throwIfNoEntry: false })) process.loadEnvFile(localConfig);
  await build(project, { thumbnails: true });
  console.log('已產生根目錄 index.html 與部署用 dist/index.html');
}
