/**
 * TypeScript 型別定義模組
 * 
 * 用途：定義應用程式中使用的資料結構型別
 * 流程：提供型別安全的介面定義，確保資料結構的一致性
 */

/**
 * 員工資訊介面
 */
export interface Employee {
  /** 員工編號 */
  id: string;
  /** 員工姓名 */
  name: string;
}

/**
 * 出勤記錄介面
 * 
 * 用途：儲存從 CSV 或 TXT 檔案解析出來的原始出勤資料
 */
export interface AttendanceRecord {
  /** 員工編號 */
  employeeId: string;
  /** 員工姓名 */
  name: string;
  /** 歸屬日期（民國年格式：1141001 或西元格式） */
  date: string;
  /** 考勤別（事假、病假、請年休假、公假或空白） */
  attendanceType?: string;
  /** 請假數量（天數） */
  leaveQuantity?: number;
  /** 上班打卡時間（格式：HH:mm） */
  clockIn: string;
  /** 下班打卡時間（格式：HH:mm） */
  clockOut: string;
}

/**
 * 加班報表介面
 * 
 * 用途：儲存計算後的加班時數、誤餐費及相關資訊
 * 流程：
 * 1. 繼承 AttendanceRecord 的基本資訊
 * 2. 加入計算後的加班時數、誤餐費、加班時間範圍等欄位
 */
export interface OvertimeReport {
  /** 員工編號 */
  employeeId: string;
  /** 員工姓名 */
  name: string;
  /** 歸屬日期（民國年格式：1141001 或西元格式） */
  date: string;
  /** 考勤別（事假、病假、請年休假、公假或空白） */
  attendanceType?: string;
  /** 請假數量（天數） */
  leaveQuantity?: number;
  /** 上班打卡時間（格式：HH:mm） */
  clockIn: string;
  /** 下班打卡時間（格式：HH:mm） */
  clockOut: string;
  /** 計算後的加班時數（單位：小時，對齊到 0.5 小時） */
  overtimeHours: number;
  /** 誤餐費金額（平日下班 >= 19:30 給予 $50） */
  mealAllowance: number;
  /** 加班時間範圍（格式：HH:mm - HH:mm） */
  overtimeRange: string;
  /** 加班原因（由使用者填寫） */
  overtimeReason: string;
  /** 是否為國定假日（用於調整計算規則） */
  isHoliday?: boolean;
}
