import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build } from './build.mjs';

test('重新建置同步新增、同名替換和刪除，並保留原始檔名', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mini-gallery-'));
  const jpg = 'data/image/原始 照片.jpg';
  const png = 'data/image/Mini 散步.01.PNG';
  const mp4 = 'data/video/Mini 玩球.02.MP4';
  const avatar = 'data/image/main.jpg';
  const manifest = async () => {
    const html = await readFile(join(root, 'dist/index.html'), 'utf8');
    return JSON.parse(html.match(/id="media">([^<]*)<\/script>/)[1]);
  };

  try {
    await mkdir(join(root, 'data/image'), { recursive: true });
    await mkdir(join(root, 'data/video'));
    await assert.rejects(build(root), /data\/image\/main\.jpg/);
    await writeFile(join(root, avatar), 'avatar');
    await writeFile(join(root, jpg), 'original');
    await build(root);
    assert.deepEqual((await manifest()).map(item => item.path), [jpg]);

    await writeFile(join(root, jpg), 'replacement');
    await writeFile(join(root, png), 'added photo');
    await writeFile(join(root, mp4), 'added video');
    await build(root);
    const items = await manifest();
    assert.deepEqual(new Set(items.map(item => item.path)), new Set([jpg, png, mp4]));
    for (const item of items) {
      assert.equal(decodeURI(new URL(item.url, 'https://example.test/mini/').pathname), `/mini/${item.path}`);
    }
    assert.equal(await readFile(join(root, 'dist', jpg), 'utf8'), 'replacement');
    await rm(join(root, mp4));
    await build(root);
    assert.equal((await manifest()).some(item => item.type === 'video'), false);
    await assert.rejects(readFile(join(root, 'dist', mp4)), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
