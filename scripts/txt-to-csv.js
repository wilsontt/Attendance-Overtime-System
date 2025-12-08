#!/usr/bin/env node

/**
 * TXT 轉 CSV 轉換腳本
 * 
 * 用途：將固定寬度格式的出勤刷卡記錄 TXT 檔案轉換為 CSV 格式
 * 
 * 執行方式：node scripts/txt-to-csv.js <input.txt> <output.csv>
 * 範例：node scripts/txt-to-csv.js 100057-11411.TXT output.csv
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析 TXT 檔案的單一記錄區塊
 * @param {string[]} lines - 記錄區塊的行陣列
 * @returns {Object|null} 解析後的記錄物件
 */
function parseRecord(lines) {
  if (lines.length === 0) return null;

  const result = {
    employeeId: '',
    name: '',
    date: '',
    attendanceType: '',
    leaveQuantity: 0,
    clockIn: '',
    clockOut: ''
  };

  // 解析第一行：員工姓名和歸屬日期
  const firstLine = lines[0];
  
  // 提取員工編號和姓名（格式：100057 鄒東良）
  const nameMatch = firstLine.match(/(\d{6})\s+([\u4e00-\u9fa5]+)/);
  if (nameMatch) {
    result.employeeId = nameMatch[1];
    result.name = nameMatch[2];
  }

  // 提取歸屬日期（格式：1141101 或 1141104/1）
  const dateMatch = firstLine.match(/(\d{7})(?:\/\d)?/);
  if (dateMatch) {
    result.date = dateMatch[1];
  }

  // 提取考勤別和數量（格式：病假/1日//1141103  - 1141103）
  const leaveMatch = firstLine.match(/(事假|病假|請年休假|公假)\/(\d+(?:\.\d+)?)日/);
  if (leaveMatch) {
    result.attendanceType = leaveMatch[1];
    result.leaveQuantity = parseFloat(leaveMatch[2]);
  }

  // 提取刷卡時間
  const times = [];
  
  for (const line of lines) {
    // 匹配刷卡時間（格式：1141104 08:38 或在行尾）
    // 格式1: "1141104 08:38    正常" 或 "1141104 08:38    異常"
    const timeMatch = line.match(/\d{7}\s+(\d{2}:\d{2})\s+(?:正常|異常)/);
    if (timeMatch) {
      times.push(timeMatch[1]);
    }
  }

  // 第一個時間是上班時間，第二個是下班時間
  result.clockIn = times[0] || '';
  result.clockOut = times[1] || '';

  return result;
}

/**
 * 將 TXT 檔案轉換為 CSV
 * @param {string} inputPath - 輸入 TXT 檔案路徑
 * @param {string} outputPath - 輸出 CSV 檔案路徑
 */
function convertTxtToCsv(inputPath, outputPath) {
  try {
    // 讀取 TXT 檔案
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split('\n');

    const records = [];
    let currentRecord = [];
    let isDataSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 判斷是否開始資料區段（跳過標題）
      if (line.includes('員工姓名') && line.includes('歸屬日期')) {
        isDataSection = true;
        continue;
      }

      // 跳過分隔線和空白行
      if (line.includes('====') || line.includes('... 接下頁 ...') || line.trim() === '') {
        if (currentRecord.length > 0) {
          const parsed = parseRecord(currentRecord);
          if (parsed && parsed.employeeId) {
            records.push(parsed);
          }
          currentRecord = [];
        }
        continue;
      }

      // 收集記錄行
      if (isDataSection && line.includes('100057')) {
        // 新記錄開始
        if (currentRecord.length > 0) {
          const parsed = parseRecord(currentRecord);
          if (parsed && parsed.employeeId) {
            records.push(parsed);
          }
        }
        currentRecord = [line];
      } else if (currentRecord.length > 0 && line.includes('---------')) {
        // 記錄結束
        const parsed = parseRecord(currentRecord);
        if (parsed && parsed.employeeId) {
          records.push(parsed);
        }
        currentRecord = [];
      } else if (currentRecord.length > 0) {
        // 繼續收集同一記錄的行
        currentRecord.push(line);
      }
    }

    // 處理最後一筆記錄
    if (currentRecord.length > 0) {
      const parsed = parseRecord(currentRecord);
      if (parsed && parsed.employeeId) {
        records.push(parsed);
      }
    }

    // 生成 CSV
    const csvLines = [];
    csvLines.push('員工編號,姓名,歸屬日期,考勤別,數量,上班時間,下班時間');

    for (const record of records) {
      const line = [
        record.employeeId,
        record.name,
        record.date,
        record.attendanceType || '',
        record.leaveQuantity || 0,
        record.clockIn,
        record.clockOut
      ].join(',');
      csvLines.push(line);
    }

    // 寫入 CSV 檔案
    fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');

    console.log(`✅ 轉換成功！`);
    console.log(`   輸入檔案：${inputPath}`);
    console.log(`   輸出檔案：${outputPath}`);
    console.log(`   記錄筆數：${records.length}`);

  } catch (error) {
    console.error('❌ 轉換失敗：', error.message);
    process.exit(1);
  }
}

// 主程式
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方式：node scripts/txt-to-csv.js <input.txt> <output.csv>');
    console.log('範例：node scripts/txt-to-csv.js 100057-11411.TXT output.csv');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 錯誤：找不到輸入檔案 ${inputPath}`);
    process.exit(1);
  }

  convertTxtToCsv(inputPath, outputPath);
}

// 如果直接執行此腳本
if (require.main === module) {
  main();
}

module.exports = { convertTxtToCsv, parseRecord };

