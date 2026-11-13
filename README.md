# Mini 的日常

Mini 是一隻出生於 2024 年 7 月 24 日的女生柯基。這個網站用 Instagram 風格的白底個人頁展示她的照片、影片和限時動態。

- 圖庫可切換「全部」、「照片」和「影片」。點照片可放大，點影片縮圖可開啟播放器。
- 頭貼有彩色外圈時，點一下就會靜音播放限時動態。多支影片會依檔名順序接續播放。
- 貼文數依圖庫的照片與影片自動計算。個人頁顯示 70 億粉絲與 0 追蹤中。

## 在本機執行

1. 準備 Node.js 22 或更新版本。專案使用原生 HTML、CSS 和 JavaScript，可直接執行建置。
2. 若要產生影片縮圖，將 FFmpeg 加入 PATH，或在專案根目錄建立 `.env.local` 並填入執行檔的完整路徑。例如 `MINI_FFMPEG="C:/tools/ffmpeg/bin/ffmpeg.exe"`。缺少 FFmpeg 時，圖庫影片會以播放圖示顯示。
3. 在專案根目錄開啟終端機並執行：

   ```sh
   npm run build
   ```

4. 用瀏覽器開啟專案最外層的 `index.html`。

## 更新照片、影片與限時動態

| 位置 | 用途 |
| --- | --- |
| `data/image/main.jpg` | Mini 的頭貼 |
| `data/image/` | 圖庫照片，支援 JPG、JPEG、PNG、WebP |
| `data/video/` | 圖庫影片，支援 MP4、WebM |
| `data/shorts/` | 點頭貼播放的限時動態，支援 MP4、WebM |

在對應資料夾新增、替換或移除素材，再執行 `npm run build`。素材可以保留原始檔名，包含中文、空格或多個句點。限時動態會保留到你移除影片並重新建置為止。

## 測試與部署

執行 `npm test` 可驗證素材新增、刪除、同名替換及檔名處理。測試在暫存目錄執行。

`dist/` 是建置產生的完整靜態網站，包含首頁、素材副本和影片縮圖。日常更新請編輯 `data/`。若使用 GitHub Pages，可設定 GitHub Actions 在推送後執行建置並發布 `dist/`，部署環境需提供 FFmpeg 才能產生縮圖。專案規則與維護細節請見 [AGENTS.md](AGENTS.md)。
