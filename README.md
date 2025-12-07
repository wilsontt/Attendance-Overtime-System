# 🏢 出勤加班單系統 (Attendance Overtime System)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)

一個專為企業設計的自動化出勤加班計算系統。透過上傳出勤打卡記錄 (CSV)，系統能依照預設規則自動計算員工的加班時數與誤餐費，並支援報表匯出與列印，大幅節省人資與主管的核對時間。

## ✨ 主要功能

- **📂 快速匯入資料**：支援 CSV 格式的出勤記錄批次上傳與解析。
- **⚡ 自動化計算**：
  - **加班時數**：自動判定平日 (18:00 後) 與假日 (全天) 加班時數。
  - **誤餐費**：自動判定平日下班超過 19:30 給予誤餐費補助。
- **🔍 智慧篩選**：可依「員工姓名」或「日期範圍」快速查找特定記錄。
- **📊 多元報表輸出**：
  - **Excel 下載**：匯出完整的計算明細試算表。
  - **PDF 下載**：生成排版精美的 PDF 報告（支援中文顯示）。
  - **列印支援**：優化的網頁列印樣式，所見即所得。

## 🛠️ 技術棧

本專案採用現代化前端技術構建：

- **核心框架**: [React 19](https://react.dev/)
- **開發語言**: [TypeScript](https://www.typescriptlang.org/)
- **建置工具**: [Vite](https://vitejs.dev/)
- **資料處理**: 
  - `react-papaparse` (CSV 解析)
  - `exceljs` (Excel 生成)
- **PDF 生成**: `html2canvas` + `jspdf` (解決中文字型顯示問題)

## 🚀 快速開始

### 前置需求
- [Node.js](https://nodejs.org/) (建議 v18 以上)
- npm 或 yarn

### 安裝步驟

1. **複製專案**
   git clone <repository-url>
   cd "出勤加班單系統"
   2. **進入前端目錄並安裝依賴**
   cd frontend
   npm install
   3. **啟動開發伺服器**
   
   npm run dev
      瀏覽器將自動開啟 `http://localhost:5173`。

## 📖 使用說明

### 1. 準備 CSV 檔案
請準備符合以下格式的 CSV 檔案（包含標頭）：

員工編號,姓名,歸屬日期,上班時間,下班時間
200038,王小明,1141001,08:50,20:00
...> **注意**：
> - 日期格式支援民國年 (如 `1141001`) 或西元格式。
> - 時間格式請使用 `HH:mm`。

### 2. 計算規則詳細

| 項目 | 平日 (週一至週五) | 假日 (週六、週日) |
| :--- | :--- | :--- |
| **加班計算** | 從 **18:00** 起算至下班時間 | **全天工時** (下班 - 上班) 皆計為加班 |
| **誤餐費** | 下班時間 **≥ 19:30**，給予 **$50** | 不提供 |

### 3. 匯出報告
計算完成後，您可以使用頁面下方的按鈕進行操作：
- **下載 Excel**：取得 `.xlsx` 檔。
- **下載 PDF**：系統將自動截取表格畫面並生成 PDF 下載。
- **列印報告**：開啟系統列印視窗。

## �� 專案結構

```
frontend/
├── public/              # 靜態資源 (Logo 等)
├── src/
│   ├── components/      # React 元件 (上傳器、表格、報告產生器)
│   ├── services/        # 核心計算邏輯 (加班費、誤餐費公式)
│   ├── pages/           # 頁面入口
│   ├── types/           # TypeScript 型別定義
│   └── App.tsx          # 主程式
└── package.json         # 相依套件設定
```

## 📄 License

This project is licensed under the MIT License.
    