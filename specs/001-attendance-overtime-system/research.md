# 研究: 出勤加班單系統

## 階段 0：大綱與研究

### 1. UI 元件庫

**任務**: 研究並推薦一個適用於 React + TypeScript **考量因素**:
- 易用性與學習曲線。
- 元件集的完整性（例如，檔案上傳、表格、日期選擇器）。
- 客製化與主題能力。
- 社群支援與文件。
**候選項目**:
- Material-UI (MUI)
- Ant Design
- Chakra UI
- Mantine

### 2. CSV 解析庫

**任務**: 研究並推薦一個用於瀏覽器端客戶端檔案處理的 CSV 解析庫。

**考量因素**:
- 處理大型檔案的效能。
- 易用性與 API 設計。
- 錯誤處理能力。
- 支援串流/分塊以避免阻塞主執行緒。
- 社群支援與維護。

**候選項目**:
- PapaParse
- react-papaparse
- d3-dsv

## 決策

### CSV 解析庫

**選擇**: `react-papaparse`
**理由**: 這是 `PapaParse` 的 React 包裝版本，能讓 React 專案中的使用更為簡便，且繼承了 `PapaParse` 的強大功能與效能。

### Excel 和 PDF 產生函式庫

**選擇**: Excel: `exceljs`, PDF: `pdfmake`
**理由**: `exceljs` 和 `pdfmake` 是功能豐富且社群支援良好的函式庫，提供產生複雜 Excel 和 PDF 文件的能力。
