# 1004 · SketchUp → Three.js

這個資料夾提供瀏覽器端的 SketchUp → Three.js 檢視 / GLB 轉換頁。

## 使用方式

1. 開啟 GitHub Pages 的 `/1004/` 頁面。
2. 選擇或拖入 `1004.skp`。
3. 50 MB 以上的 SKP 會優先採用 OpenSKP WASM 快速模式。
4. 模型載入後可旋轉、縮放、置中，並下載 `.glb`。

SKP 檔案預設只在瀏覽器本機處理，不會上傳到本頁伺服器。

如果之後把 `1004.skp` 放到這個資料夾，頁面會自動載入它。

## 技術

- Three.js
- OpenSKP 1.3.0
- 大型檔：OpenSKP C++ / WebAssembly fast preview
- 小型檔：OpenSKP TypeScript 完整解析（材質 / 貼圖 / GLB export）
