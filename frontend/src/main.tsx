/**
 * 應用程式進入點
 * 
 * 用途：初始化並渲染 React 應用程式至 DOM
 * 流程：
 * 1. 取得 root DOM 元素
 * 2. 建立 React 根節點
 * 3. 以 StrictMode 渲染 App 組件
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
