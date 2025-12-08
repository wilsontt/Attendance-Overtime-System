/**
 * 主應用程式組件
 * 
 * 用途：作為應用程式的根組件，負責組裝主要頁面
 * 流程：
 * 1. 渲染主要頁面容器
 * 2. 載入 HomePage 組件
 */

import HomePage from './pages/HomePage';
import './App.css';

/**
 * App 組件
 * @returns {JSX.Element} 應用程式根組件
 */
function App() {
  return (
    <div className="App">
      <HomePage />
    </div>
  );
}

export default App;

