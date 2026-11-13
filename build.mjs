import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
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

export async function build(root, { thumbnails = false, optimizeVideos = false } = {}) {
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
  const ffmpeg = process.env.MINI_FFMPEG || 'ffmpeg';
  let avatarThumbnail;
  if (thumbnails) {
    const photos = entries.filter(item => item.type === 'image');
    await mkdir(join(output, 'thumbnails'), { recursive: true });
    for (const [index, item] of [{ path: avatar }, ...photos].entries()) {
      const thumbnail = `thumbnails/${index}.webp`;
      try {
        await run(ffmpeg, ['-nostdin', '-v', 'error', '-i', join(root, item.path),
          '-frames:v', '1', '-vf', index === 0
            ? "scale=w='min(320,iw)':h='min(320,ih)':force_original_aspect_ratio=decrease"
            : "scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease",
          '-c:v', 'libwebp', '-quality', '78', join(output, thumbnail)], { windowsHide: true });
        if (!(await stat(join(output, thumbnail), { throwIfNoEntry: false }))?.size) continue;
        if (index === 0) avatarThumbnail = thumbnail;
        else item.thumbnail = thumbnail;
      } catch (error) {
        if (error.code === 'ENOENT' && error.syscall?.startsWith('spawn')) {
          console.warn('找不到 FFmpeg，照片縮圖使用原始照片。');
          break;
        }
        console.warn(`無法產生照片縮圖：${item.path}`);
      }
    }
  }
  const optimized = new Set();
  if (optimizeVideos) {
    const mp4s = entries.filter(item => item.type !== 'image' && extname(item.path).toLowerCase() === '.mp4');
    for (const item of mp4s) {
      const destination = join(output, item.path);
      const temporary = `${destination}.optimized.mp4`;
      try {
        await run(ffmpeg, ['-nostdin', '-v', 'error', '-i', join(root, item.path),
          '-map', '0:V:0', '-map', '0:a:0?', '-vf',
          "scale=w='min(960,iw)':h='min(960,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-maxrate', '1500k', '-bufsize', '3000k',
          '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', temporary],
        { windowsHide: true });
        await rename(temporary, destination);
        optimized.add(item.path);
      } catch (error) {
        if (error.code === 'ENOENT' && error.syscall?.startsWith('spawn')) {
          console.warn('找不到 FFmpeg，部署使用原始影片。請將 FFmpeg 加入 PATH 或設定 MINI_FFMPEG。');
          break;
        }
        console.warn(`無法最佳化影片，部署使用原始檔：${item.path}`);
      } finally {
        await rm(temporary, { force: true });
      }
    }
  }

  const videos = entries.filter(item => item.type === 'video');
  if (thumbnails && videos.length) {
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
  const render = (items, assetPrefix = '', mediaPrefix = '') => {
    const json = JSON.stringify(items).replaceAll('<', '\\u003c');
    return template
      .replace('href="styles.css"', `href="${assetPrefix}styles.css"`)
      .replace('src="gallery.js"', `src="${assetPrefix}gallery.js"`)
      .replace(`src="${avatar}"`, `src="${avatarThumbnail ? mediaPrefix + avatarThumbnail : avatar}"`)
      .replace('<!-- media -->', () => json);
  };
  await writeFile(join(output, 'index.html'), render(entries));
  const rootEntries = entries.map(item => ({
    ...item,
    url: optimized.has(item.path) ? `dist/${item.url}` : item.url,
    ...(item.thumbnail && { thumbnail: `dist/${item.thumbnail}` }),
    ...(item.poster && { poster: `dist/${item.poster}` }),
  }));
  await writeFile(join(root, 'index.html'), render(rootEntries, 'src/', 'dist/'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const localConfig = join(project, '.env.local');
  if (await stat(localConfig, { throwIfNoEntry: false })) process.loadEnvFile(localConfig);
  await build(project, { thumbnails: true, optimizeVideos: true });
  console.log('已產生根目錄 index.html 與部署用 dist/index.html');
}
