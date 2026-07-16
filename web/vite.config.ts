import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // GitHub Pages 專案頁面網址是 https://<user>.github.io/pika_team_killer/，
  // 所以打包後的資源路徑要加上這個 base，否則 JS/CSS 會抓錯路徑。
  base: '/pika_team_killer/',
})
