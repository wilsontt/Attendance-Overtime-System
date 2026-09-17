/**
 * 預覽 Modal 組件
 *
 * 用途：提供加班申請表預覽、記錄選擇、國定假日標記與下載功能
 * 流程：
 * 1. 過濾有完整上下班刷卡時間的記錄
 * 2. 分離平日加班與例假日加班記錄
 * 3. 使用者可勾選要包含在申請表中的記錄
 * 4. 使用者可標記國定假日（影響加班時數計算）
 * 5. 使用者填寫工作地點與加班原因
 * 6. 驗證必填欄位後下載 Excel/PDF 或列印
 */

import React, { useState, useEffect, useRef } from 'react';
import type { OvertimeReport } from '../types';
import {
  isNaturalHoliday,
} from '../services/calculationService';
import {
  REPORT_REMARK_LINE_CHARS,
  REPORT_REMARK_LINES,
  REPORT_REMARK_MAX_CHARS,
  REPORT_WORK_LOCATION_MAX_CHARS,
} from '../services/reportService';
import { formatDate } from '../utils/dateFormatter';
import './PreviewModal.css';

const OVERTIME_REASON_MAX_LENGTH = 200;
const PREVIEW_ITEMS_PER_PAGE = 15;
const REMARK_MAX_LENGTH = REPORT_REMARK_MAX_CHARS;
const REMARK_LINE_LENGTH = REPORT_REMARK_LINE_CHARS;
const REMARK_TOTAL_LINES = REPORT_REMARK_LINES;

function normalizeRemarkInput(input: string): string {
  const singleLine = input.replace(/\r?\n/g, '');
  return Array.from(singleLine).slice(0, REMARK_MAX_LENGTH).join('');
}

function normalizeWorkLocationInput(input: string): string {
  return Array.from(input.replace(/\r?\n/g, ''))
    .slice(0, REPORT_WORK_LOCATION_MAX_CHARS)
    .join('');
}

/**
 * PreviewModal 組件的 Props 介面
 */
interface PreviewModalProps {
  /** 加班報表陣列 */
  reports: OvertimeReport[];
  /** 原始 TXT 內容（僅 TXT 上傳時有值） */
  rawTxtContent: string;
  /** 「加到例假日加班」強制標記（key: `${employeeId}__${date}`），與主列表雙向同步 */
  holidayOverrides: Record<string, boolean>;
  /** 切換「加到例假日加班」強制標記回呼函數（同步回主列表） */
  onToggleHolidayOverride: (employeeId: string, date: string) => void;
  /** 「加到平日加班」強制標記（key: `${employeeId}__${date}`），與主列表雙向同步 */
  weekdayOverrides: Record<string, boolean>;
  /** 切換「加到平日加班」強制標記回呼函數（同步回主列表） */
  onToggleWeekdayOverride: (employeeId: string, date: string) => void;
  /** Modal 開關狀態 */
  isOpen: boolean;
  /** 關閉 Modal 回呼函數 */
  onClose: () => void;
  /** 下載 Excel 回呼函數 */
  onDownloadExcel: (
    weekdayReports: OvertimeReport[],
    holidayReports: OvertimeReport[],
    weekdayWorkLocation: string,
    weekdayRemarks: string,
    holidayWorkLocation: string,
    holidayRemarks: string,
  ) => void;
  /** 下載 PDF 回呼函數 */
  onDownloadPdf: (
    weekdayReports: OvertimeReport[],
    holidayReports: OvertimeReport[],
    weekdayWorkLocation: string,
    weekdayRemarks: string,
    holidayWorkLocation: string,
    holidayRemarks: string,
  ) => void;
  /** 列印回呼函數 */
  onPrint: (
    weekdayReports: OvertimeReport[],
    holidayReports: OvertimeReport[],
    weekdayWorkLocation: string,
    weekdayRemarks: string,
    holidayWorkLocation: string,
    holidayRemarks: string,
  ) => void;
  /** 預設平日加班備註（包含補登理由） */
  defaultWeekdayRemarks: string;
  /** 預設例假日加班備註（包含補登理由） */
  defaultHolidayRemarks: string;
}

/**
 * PreviewModal 組件
 * @param {PreviewModalProps} props - 組件屬性
 * @returns {JSX.Element | null} 預覽 Modal 組件
 */
const PreviewModal: React.FC<PreviewModalProps> = ({
  reports,
  rawTxtContent,
  holidayOverrides,
  onToggleHolidayOverride,
  weekdayOverrides,
  onToggleWeekdayOverride,
  isOpen,
  onClose,
  onDownloadExcel,
  onDownloadPdf,
  onPrint,
  defaultWeekdayRemarks,
  defaultHolidayRemarks,
}) => {
  /** 過濾出有完整上下班刷卡時間的記錄 */
  const [filteredReports, setFilteredReports] = useState<OvertimeReport[]>([]);

  /** 平日加班工作地點 */
  const [workLocation, setWorkLocation] = useState<string>('');

  /** 平日加班備註 */
  const [remarks, setRemarks] = useState<string>('');

  /** 例假日加班工作地點 */
  const [holidayWorkLocation, setHolidayWorkLocation] = useState<string>('');

  /** 例假日加班備註 */
  const [holidayRemarks, setHolidayRemarks] = useState<string>('');


  /** 記錄選擇狀態（key: `${employeeId}__${date}__${segment}`） */
  const [recordSelection, setRecordSelection] = useState<{
    [key: string]: boolean;
  }>({});

  /** 加班原因編輯狀態（key: `${employeeId}__${date}__${segment}`） */
  const [editedReasons, setEditedReasons] = useState<{ [key: string]: string }>(
    {},
  );

  /** 平日加班工作地點輸入框（開啟時自動聚焦） */
  const weekdayWorkLocationRef = useRef<HTMLInputElement>(null);

  /** 例假日加班工作地點輸入框（無平日加班時的聚焦備援） */
  const holidayWorkLocationRef = useRef<HTMLInputElement>(null);

  /**
   * 當 Modal 開啟或 reports 變更時，初始化狀態
   */
  useEffect(() => {
    if (isOpen) {
      // 過濾有完整刷卡且加班時數達門檻（>= 0.5 小時）的記錄；
      // 未達加班標準的日子（如未達 30 分鐘）不進入預覽，連帶不會被選取/匯出/列印。
      const filtered = reports.filter(
        (r) => Boolean(r.clockIn && r.clockOut) && r.overtimeHours >= 0.5,
      );
      setFilteredReports(filtered);

      // 初始化記錄選擇狀態
      setRecordSelection(prev => {
        const newSelection = { ...prev };
        filtered.forEach((report) => {
          const key = `${report.employeeId}__${report.date}__${report.segment || '全'}`;
          if (newSelection[key] === undefined) {
            if (
              report.attendanceType &&
              report.attendanceType !== '空' &&
              report.attendanceType !== ''
            ) {
              if (report.clockIn && report.clockOut) {
                newSelection[key] = false; // 預設不選中，需要用戶確認
              } else {
                newSelection[key] = false; // 沒有打卡時間，不選中
              }
            } else {
              newSelection[key] = true; // 正常上班日，預設選中
            }
          }
        });
        return newSelection;
      });

      // 初始化加班原因
      setEditedReasons(prev => {
        const newReasons = { ...prev };
        filtered.forEach((report) => {
          const key = `${report.employeeId}__${report.date}__${report.segment || '全'}`;
          if (newReasons[key] === undefined) {
            newReasons[key] = report.overtimeReason || '';
          }
        });
        return newReasons;
      });

      setWorkLocation('');
      setRemarks(defaultWeekdayRemarks);         // 改吃傳入的預設平日備註
      setHolidayRemarks(defaultHolidayRemarks);  // 改吃傳入的預設假日備註

      // 開啟後將游標停在平日加班工作地點（無平日加班時退而聚焦例假日）。
      // 以 setTimeout 等待 DOM 完成渲染後再聚焦。
      setTimeout(() => {
        if (weekdayWorkLocationRef.current) {
          weekdayWorkLocationRef.current.focus();
        } else {
          holidayWorkLocationRef.current?.focus();
        }
      }, 0);
    }
    // 不將 holidayOverrides 納入依賴：僅在開啟當下讀取快照，
    // 避免 Modal 開啟中由預覽端切換假日造成 effect 重跑而清空已填輸入。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reports]);

  if (!isOpen) return null;

  /**
   * 處理國定假日標記切換事件
   * @param {string} employeeId - 員工編號
   * @param {string} date - 日期字串
   */
  const handleHolidayToggle = (
    employeeId: string,
    date: string,
  ) => {
    // 雙向同步回主列表的「加到例假日加班」標記
    onToggleHolidayOverride(employeeId, date);
  };

  /**
   * 處理「補班日改列平日加班」切換事件（週末記錄專用）
   * @param {string} employeeId - 員工編號
   * @param {string} date - 日期字串
   */
  const handleWeekdayToggle = (
    employeeId: string,
    date: string,
  ) => {
    // 雙向同步回主列表的「加到平日加班」標記
    onToggleWeekdayOverride(employeeId, date);
  };

  /**
   * 處理記錄選擇切換事件
   * @param {string} key - 記錄唯一鍵值
   */
  const handleRecordSelection = (key: string) => {
    setRecordSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * 處理加班原因編輯事件
   * @param {string} key - 記錄唯一鍵值
   * @param {string} newReason - 新的加班原因
   */
  const handleReasonChange = (key: string, newReason: string) => {
    if (newReason.length > OVERTIME_REASON_MAX_LENGTH) {
      alert(
        `加班理由最多 ${OVERTIME_REASON_MAX_LENGTH} 字元（含中英文與符號）。`,
      );
      return;
    }
    setEditedReasons((prev) => ({ ...prev, [key]: newReason }));
  };

  /**
   * 取得選中的記錄並更新加班原因與國定假日標記
   * @returns {OvertimeReport[]} 選中的加班報表陣列
   */
  const getSelectedReports = () => {
    return filteredReports
      .map((report) => {
        const key = `${report.employeeId}__${report.date}__${report.segment || '全'}`;
        return {
          ...report,
          overtimeReason: editedReasons[key] || report.overtimeReason,
          isHoliday: isHolidayRecord(report),
        };
      })
      .filter((report) => {
        const key = `${report.employeeId}__${report.date}__${report.segment || '全'}`;
        return recordSelection[key] === true;
      });
  };

  /**
   * 判斷記錄是否為例假日（套用強制標記後的最終結果）
   * 優先序：強制例假日 > 強制平日（補班）> 自然星期幾。
   * @param {OvertimeReport} report - 加班報表
   * @returns {boolean} 是否為例假日
   */
  const isHolidayRecord = (report: OvertimeReport): boolean => {
    const key = `${report.employeeId}__${report.date}`;
    if (holidayOverrides[key]) return true; // 強制例假日（國定假日落在平日）
    if (weekdayOverrides[key]) return false; // 強制平日（補班日落在週末）
    return report.isHoliday || false;
  };

  /**
   * 分離平日與例假日記錄（附加 reportKey 供後續使用）
   */
  const weekdayReports: Array<OvertimeReport & { reportKey: string }> = [];
  const holidayReports: Array<OvertimeReport & { reportKey: string }> = [];

  filteredReports.forEach((report) => {
    const key = `${report.employeeId}__${report.date}__${report.segment || '全'}`;
    if (isHolidayRecord(report)) {
      holidayReports.push({ ...report, reportKey: key });
    } else {
      weekdayReports.push({ ...report, reportKey: key });
    }
  });

  /**
   * 渲染表格區塊
   * @param {string} title - 表格標題
   * @param {Array<OvertimeReport & { reportKey: string }>} records - 加班記錄陣列（附加索引）
   * @param {number} pageNumber - 頁碼
   * @returns {JSX.Element | null} 表格組件或 null
   */
  const renderTable = (
    title: string,
    records: Array<OvertimeReport & { reportKey: string }>,
    pageNumber: number,
  ) => {
    if (records.length === 0) return null;

    return (
      <div className="table-section">
        <h3>{title}</h3>
        <table className="preview-table">
          <thead>
            <tr>
              <th>ITEM</th>
              <th>選擇</th>
              <th>假日↔平日</th>
              <th>日期</th>
              <th>班表</th>
              <th>段別</th>
              <th>考勤別</th>
              <th>上班時間</th>
              <th>下班時間</th>
              <th>加班時間</th>
              <th>加班時數</th>
              <th>誤餐費</th>
              <th>加班原因</th>
            </tr>
          </thead>
          <tbody>
            {records.map((report, rowIndex) => {
              const key = report.reportKey;
              const isLeaveDay =
                report.attendanceType &&
                report.attendanceType !== '空' &&
                report.attendanceType !== '';
              const hasClockTime = Boolean(report.clockIn && report.clockOut);
              const isUnderThreshold = report.overtimeHours < 0.5;
              const shouldHighlight = isLeaveDay && hasClockTime;
              // 選擇欄勾選且有完整打卡，並達到 0.5 小時門檻才可編輯
              const isOvertimeEditable =
                recordSelection[key] &&
                hasClockTime &&
                !isLeaveDay &&
                !isUnderThreshold;
              const reasonStateClass = !recordSelection[key]
                ? 'reason-unselected'
                : isLeaveDay
                  ? 'reason-disabled-leave'
                  : !hasClockTime
                    ? 'reason-disabled-missing-clock'
                    : isUnderThreshold
                      ? 'reason-disabled-threshold'
                      : 'reason-editable';

              return (
                <tr
                  key={key}
                  className={shouldHighlight ? 'highlight-leave-day' : ''}
                >
                  <td>{rowIndex + 1}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={recordSelection[key] || false}
                      onChange={() => handleRecordSelection(key)}
                    />
                  </td>
                  <td>
                    {isNaturalHoliday(report.date) ? (
                      <input
                        type="checkbox"
                        checked={
                          weekdayOverrides[
                            `${report.employeeId}__${report.date}`
                          ] || false
                        }
                        onChange={() =>
                          handleWeekdayToggle(
                            report.employeeId,
                            report.date,
                          )
                        }
                        title="勾選＝補班日，改列「平日加班」（18:00 起算）"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={
                          holidayOverrides[
                            `${report.employeeId}__${report.date}`
                          ] || false
                        }
                        onChange={() =>
                          handleHolidayToggle(
                            report.employeeId,
                            report.date,
                          )
                        }
                        title="勾選＝國定假日，改列「例假日加班」（全日計算）"
                      />
                    )}
                  </td>
                  <td>{formatDate(report.date)}</td>
                  <td>{report.shiftType === 'warehouse' ? '倉庫班' : '公司班'}</td>
                  <td>{report.segment || '全'}</td>
                  <td>{report.attendanceType || '-'}</td>
                  <td>{report.clockIn}</td>
                  <td>{report.clockOut}</td>
                  <td>{report.overtimeRange}</td>
                  <td>{report.overtimeHours.toFixed(2)}</td>
                  <td>{report.mealAllowance}</td>
                  <td>
                    <input
                      type="text"
                      value={editedReasons[key] || ''}
                      onChange={(e) =>
                        handleReasonChange(key, e.target.value)
                      }
                      placeholder={
                        isLeaveDay
                          ? `請${report.attendanceType}`
                          : isUnderThreshold
                            ? '未達30分鐘'
                            : !hasClockTime
                              ? '缺少刷卡時間'
                              : '請輸入原因'
                      }
                      disabled={!isOvertimeEditable}
                      className={`reason-input ${reasonStateClass}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div
          style={{
            textAlign: 'right',
            marginTop: '10px',
            fontSize: '14px',
            color: '#666',
          }}
        >
          頁碼：{pageNumber}
        </div>
      </div>
    );
  };

  /**
   * 依區塊記錄彙整員工資訊（員工編號＋員工姓名）
   * - 單一員工：直接顯示「A123 王小明」
   * - 多位員工：以頓號串接，避免重複顯示
   */
  const buildEmployeeSummary = (
    records: Array<OvertimeReport & { reportKey: string }>,
  ): string => {
    const employeeSet = new Set<string>();

    records.forEach((report) => {
      const employeeId = report.employeeId?.trim();
      const employeeName = report.name?.trim();
      if (employeeId || employeeName) {
        employeeSet.add([employeeId, employeeName].filter(Boolean).join(' '));
      }
    });

    return employeeSet.size > 0
      ? Array.from(employeeSet).join('、')
      : '無員工資訊';
  };

  /**
   * 依區塊記錄彙整申請年月（民國年格式）
   * - 來源：報表資料中的 date 欄位
   * - 7 碼民國格式（YYYMMDD）轉為「YYY年MM月」
   * - 若同區塊有多個月份，使用頓號串接
   */
  const buildYearMonthSummary = (
    records: Array<OvertimeReport & { reportKey: string }>,
  ): string => {
    const yearMonthSet = new Set<string>();

    records.forEach((report) => {
      const dateStr = report.date?.trim() ?? '';
      if (/^\d{7}$/.test(dateStr)) {
        const rocYear = dateStr.substring(0, 3);
        const month = dateStr.substring(3, 5);
        yearMonthSet.add(`${rocYear}年${month}月`);
      }
    });

    return yearMonthSet.size > 0
      ? Array.from(yearMonthSet).join('、')
      : '無申請年月';
  };

  /**
   * 驗證工作地點是否已填寫
   * @returns {boolean} 驗證結果
   */
  const validateWorkLocation = (): {
    isValid: boolean;
    errorMessage: string;
  } => {
    // 驗證平日加班工作地點
    if (weekdayReports.length > 0 && !workLocation.trim()) {
      return {
        isValid: false,
        errorMessage: '請輸入平日加班的工作地點',
      };
    }

    // 驗證例假日加班工作地點
    if (holidayReports.length > 0 && !holidayWorkLocation.trim()) {
      return {
        isValid: false,
        errorMessage: '請輸入例假日加班的工作地點',
      };
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  };

  /**
   * 驗證選中記錄的加班原因是否都已填寫
   * @returns {{ isValid: boolean; missingIndexes: number[] }} 驗證結果
   */
  const validateOvertimeReasons = (): {
    isValid: boolean;
    missingLocations: string[];
    tooLongLocations: string[];
  } => {
    const missingLocations: string[] = [];
    const tooLongLocations: string[] = [];

    const collectIssuesBySection = (
      sectionName: '平日加班' | '例假日加班',
      records: Array<OvertimeReport & { reportKey: string }>,
    ) => {
      records.forEach((report, sectionIndex) => {
        const recordKey = report.reportKey;
        if (!recordSelection[recordKey]) return;

        const itemNumber = sectionIndex + 1;
        const pageNumber =
          Math.floor(sectionIndex / PREVIEW_ITEMS_PER_PAGE) + 1;
        const locationText = `${sectionName} 第${pageNumber}頁 ITEM 第${itemNumber}筆`;
        const currentReason = (
          editedReasons[recordKey] ||
          report.overtimeReason ||
          ''
        ).trim();

        // 需要填寫加班原因的條件：有完整刷卡且加班時數 >= 0.5 小時
        const hasClockTime = Boolean(report.clockIn && report.clockOut);
        const needsReason = hasClockTime && report.overtimeHours >= 0.5;

        if (needsReason && currentReason === '') {
          missingLocations.push(locationText);
        }

        if (currentReason.length > OVERTIME_REASON_MAX_LENGTH) {
          tooLongLocations.push(locationText);
        }
      });
    };

    collectIssuesBySection('平日加班', weekdayReports);
    collectIssuesBySection('例假日加班', holidayReports);

    return {
      isValid: missingLocations.length === 0 && tooLongLocations.length === 0,
      missingLocations,
      tooLongLocations,
    };
  };

  /**
   * 完整驗證（工作地點 + 加班原因）
   * @returns {{ isValid: boolean; errorMessage: string }} 驗證結果
   */
  const validateAll = (): { isValid: boolean; errorMessage: string } => {
    // 驗證工作地點
    const locationValidation = validateWorkLocation();
    if (!locationValidation.isValid) {
      return locationValidation;
    }

    const weekdayWorkLocationLen = Array.from(
      workLocation.replace(/\r?\n/g, ''),
    ).length;
    const holidayWorkLocationLen = Array.from(
      holidayWorkLocation.replace(/\r?\n/g, ''),
    ).length;
    if (
      weekdayReports.length > 0 &&
      weekdayWorkLocationLen > REPORT_WORK_LOCATION_MAX_CHARS
    ) {
      return {
        isValid: false,
        errorMessage: `平日加班工作地點最多 ${REPORT_WORK_LOCATION_MAX_CHARS} 字。`,
      };
    }
    if (
      holidayReports.length > 0 &&
      holidayWorkLocationLen > REPORT_WORK_LOCATION_MAX_CHARS
    ) {
      return {
        isValid: false,
        errorMessage: `例假日加班工作地點最多 ${REPORT_WORK_LOCATION_MAX_CHARS} 字。`,
      };
    }

    const weekdayRemarkLength = Array.from(
      (remarks || '').replace(/\r?\n/g, ''),
    ).length;
    const holidayRemarkLength = Array.from(
      (holidayRemarks || '').replace(/\r?\n/g, ''),
    ).length;
    if (weekdayReports.length > 0 && weekdayRemarkLength > REMARK_MAX_LENGTH) {
      return {
        isValid: false,
        errorMessage: `平日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`,
      };
    }
    if (holidayReports.length > 0 && holidayRemarkLength > REMARK_MAX_LENGTH) {
      return {
        isValid: false,
        errorMessage: `例假日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`,
      };
    }

    // 驗證加班原因
    const reasonValidation = validateOvertimeReasons();
    if (!reasonValidation.isValid) {
      if (reasonValidation.missingLocations.length > 0) {
        return {
          isValid: false,
          errorMessage: `請先填寫所有記錄的加班原因。\n未填寫的記錄：\n- ${reasonValidation.missingLocations.join('\n- ')}`,
        };
      }

      return {
        isValid: false,
        errorMessage: `加班理由最多 ${OVERTIME_REASON_MAX_LENGTH} 字元（含中英文與符號）。\n超長記錄：\n- ${reasonValidation.tooLongLocations.join('\n- ')}`,
      };
    }

    return {
      isValid: true,
      errorMessage: '',
    };
  };

  /**
   * 處理下載 Excel 事件（含驗證）
   */
  const handleDownloadExcel = () => {
    const validation = validateAll();
    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter((r) => !isHolidayRecord(r));
    const selectedHoliday = selected.filter((r) => isHolidayRecord(r));
    onDownloadExcel(
      selectedWeekday,
      selectedHoliday,
      workLocation,
      remarks,
      holidayWorkLocation,
      holidayRemarks,
    );
  };

  /**
   * 處理下載 PDF 事件（含驗證）
   */
  const handleDownloadPdf = () => {
    const validation = validateAll();
    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter((r) => !isHolidayRecord(r));
    const selectedHoliday = selected.filter((r) => isHolidayRecord(r));
    onDownloadPdf(
      selectedWeekday,
      selectedHoliday,
      workLocation,
      remarks,
      holidayWorkLocation,
      holidayRemarks,
    );
  };

  /**
   * 處理列印事件（含驗證）
   */
  const handlePrint = () => {
    const validation = validateAll();
    if (!validation.isValid) {
      alert(validation.errorMessage);
      return;
    }

    const selected = getSelectedReports();
    const selectedWeekday = selected.filter((r) => !isHolidayRecord(r));
    const selectedHoliday = selected.filter((r) => isHolidayRecord(r));
    onPrint(
      selectedWeekday,
      selectedHoliday,
      workLocation,
      remarks,
      holidayWorkLocation,
      holidayRemarks,
    );
  };

  /**
   * 合併多頁 TXT 內容，移除重複頁首與分頁資訊
   * 規則：刪除「... 接下頁 ...」前最後一條分隔線到下一頁表頭下方分隔線之間的內容
   */
  const mergePagedTxtForPrint = (rawTxt: string): string => {
    const normalized = rawTxt.replace(/\r\n/g, '\n').replace(/\f/g, '\n');
    const lines = normalized.split('\n');
    const headerMatcher = (line: string) =>
      line.includes('員工姓名') &&
      line.includes('歸屬日期') &&
      line.includes('主管核定');

    let searchFrom = 0;
    while (true) {
      const nextPageMarker = lines.findIndex(
        (line, idx) => idx >= searchFrom && line.includes('... 接下頁 ...'),
      );
      if (nextPageMarker < 0) break;

      let removeStart = -1;
      for (let i = nextPageMarker; i >= 0; i--) {
        if (lines[i].includes('====')) {
          removeStart = i;
          break;
        }
      }

      const secondHeader = lines.findIndex(
        (line, idx) => idx > nextPageMarker && headerMatcher(line),
      );
      if (secondHeader < 0 || removeStart < 0) {
        searchFrom = nextPageMarker + 1;
        continue;
      }

      let removeEnd = -1;
      for (let i = secondHeader + 1; i < lines.length; i++) {
        if (lines[i].includes('====')) {
          removeEnd = i;
          break;
        }
      }

      if (removeEnd < removeStart) {
        searchFrom = secondHeader + 1;
        continue;
      }

      lines.splice(removeStart, removeEnd - removeStart + 1);
      searchFrom = removeStart;
    }

    return lines
      .filter(
        (line, index, arr) =>
          !(line.trim() === '' && arr[index - 1]?.trim() === ''),
      )
      .join('\n')
      .trim();
  };

  /**
   * 以 iframe 列印原始 TXT（比照 Notepad：目標 12pt、四邊 4mm）。
   * Windows 優先細明體；Mac 使用自架等寬中文 Noto Sans Mono CJK TC，避免比例字型破壞欄位對齊。
   * 等待等寬字型載入後再列印；超出可印寬時等比縮小字級，內容須落在邊界內。
   * 檔名格式與下載 PDF 相同，末尾加 _原始TXT。
   */
  const handlePrintRawTxt = () => {
    if (!rawTxtContent.trim()) {
      alert('目前沒有可列印的原始 TXT 內容。');
      return;
    }

    const mergedTxt = mergePagedTxtForPrint(rawTxtContent);

    // 從報表取得員工資訊與年月，組成與下載 PDF 相同規則的標題（用作儲存 PDF 的預設檔名）
    const firstReport = filteredReports[0];
    let docTitle = '員工加班申請表_原始TXT';
    if (firstReport) {
      const employeeName =
        `${firstReport.employeeId} ${firstReport.name}`.trim();
      const dateStr = firstReport.date ?? '';
      const yearMonth = /^\d{7}$/.test(dateStr)
        ? `${dateStr.substring(0, 3)}年${dateStr.substring(3, 5)}月`
        : '';
      docTitle = yearMonth
        ? `員工加班申請表-${employeeName}-${yearMonth}_原始TXT`
        : `員工加班申請表-${employeeName}_原始TXT`;
    }

    const escapedTxt = mergedTxt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Vite base（正式環境為 /attendance/）確保字型 URL 正確
    const monoFontUrl = `${import.meta.env.BASE_URL}fonts/NotoSansMonoCJKtc-Regular.otf`;

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>${docTitle}</title>
<style>
  @font-face {
    font-family: "Noto Sans Mono CJK TC";
    src: url("${monoFontUrl}") format("opentype");
    font-weight: 400;
    font-style: normal;
    font-display: block;
  }
  @page { size: A4 portrait; margin: 4mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  pre {
    font-family: "Noto Sans Mono CJK TC", "MingLiU", "PMingLiU", "Courier New", "PingFang TC", "Heiti TC", monospace;
    font-size: 12pt;
    line-height: 1.0;
    tab-size: 8;
    white-space: pre;
    margin: 0;
    padding: 0;
    color: #000;
  }
  a { color: inherit !important; text-decoration: none !important; pointer-events: none; }
</style>
</head>
<body>
<pre>${escapedTxt}</pre>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    // 移出畫面但保留 A4 尺寸，避免 0×0 導致量測／列印裁切異常
    iframe.style.cssText =
      'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      const run = async () => {
        try {
          const fonts = iframe.contentDocument?.fonts;
          if (fonts) {
            await fonts.load('12pt "Noto Sans Mono CJK TC"');
            await fonts.ready;
          }
        } catch {
          /* ignore：無 Mono 時退回系統字型 */
        }

        const pre = iframe.contentDocument?.querySelector('pre');
        if (pre) {
          const usableWidthPx = (210 - 8) * (96 / 25.4); // 4mm 邊界 → 202mm
          const contentWidthPx = pre.scrollWidth;
          const scale = Math.min(1, usableWidthPx / contentWidthPx);
          // 直接改 font-size，保留正確列印分頁；不要用 transform:scale
          pre.style.fontSize = `${12 * scale}pt`;
        }

        setTimeout(() => {
          const originalTitle = document.title;
          document.title = docTitle;
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error('Print failed:', e);
          } finally {
            setTimeout(() => {
              document.title = originalTitle;
              if (document.body.contains(iframe))
                document.body.removeChild(iframe);
            }, 3000);
          }
        }, 200);
      };
      void run();
    };
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>加班申請預覽</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 說明文字 */}
          <div className="preview-instructions">
            <p>
              📌
              以下顯示有完整上下班刷卡的記錄，已分為「平日加班」與「例假日加班」
            </p>
            <p>⚠️ 黃色標記為請假日但有打卡記錄，請確認是否包含在申請表中</p>
            <p>
              🏖️「假日↔平日」欄：平日列勾選＝國定假日（移至例假日、全時段計算）；週末列勾選＝補班日（移至平日、18:00
              起算）
            </p>
            <p>
              📝 工作地點最多 {REPORT_WORK_LOCATION_MAX_CHARS} 字；備註欄最多{' '}
              {REMARK_MAX_LENGTH} 字（每列 {REMARK_LINE_LENGTH} 字，共{' '}
              {REMARK_TOTAL_LINES} 列）
            </p>
            <p>
              ✍️ 加班原因最多 {OVERTIME_REASON_MAX_LENGTH} 字（含中英文與符號）
            </p>
          </div>

          {/* 平日加班區塊 */}
          {weekdayReports.length > 0 && (
            <div className="overtime-section">
              {/* 平日加班的工作地點和備註 */}
              <div className="input-section">
                <h3>平日加班資訊</h3>
                <p className="employee-info-text">
                  員工資訊：{buildEmployeeSummary(weekdayReports)}
                </p>
                <p className="employee-info-text">
                  申請年月：{buildYearMonthSummary(weekdayReports)}
                </p>
                <div className="input-group">
                  <label className="label-left">
                    工作地點：<span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    ref={weekdayWorkLocationRef}
                    value={workLocation}
                    maxLength={REPORT_WORK_LOCATION_MAX_CHARS}
                    onChange={(e) =>
                      setWorkLocation(
                        normalizeWorkLocationInput(e.target.value),
                      )
                    }
                    placeholder="請輸入工作地點"
                  />
                </div>
                <div className="input-group">
                  <label className="label-left">
                    備註：(最多 {REMARK_MAX_LENGTH} 字元)
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => {
                      const normalized = normalizeRemarkInput(e.target.value);
                      if (
                        Array.from(e.target.value.replace(/\r?\n/g, ''))
                          .length > REMARK_MAX_LENGTH
                      ) {
                        alert(
                          `平日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`,
                        );
                      }
                      setRemarks(normalized);
                    }}
                    placeholder="請輸入備註（選填）"
                    rows={3}
                    maxLength={REMARK_MAX_LENGTH}
                  />
                </div>
              </div>
              {/* 平日加班表格 */}
              {renderTable('平日加班', weekdayReports, 1)}
            </div>
          )}

          {/* 例假日加班區塊 */}
          {holidayReports.length > 0 && (
            <div className="overtime-section">
              {/* 例假日加班的工作地點和備註 */}
              <div className="input-section">
                <h3>例假日加班資訊</h3>
                <p className="employee-info-text">
                  員工資訊：{buildEmployeeSummary(holidayReports)}
                </p>
                <p className="employee-info-text">
                  申請年月：{buildYearMonthSummary(holidayReports)}
                </p>
                <div className="input-group">
                  <label className="label-left">
                    工作地點：<span className="required">*</span>
                  </label>
                  <div className="input-with-copy">
                    <input
                      type="text"
                      ref={holidayWorkLocationRef}
                      value={holidayWorkLocation}
                      maxLength={REPORT_WORK_LOCATION_MAX_CHARS}
                      onChange={(e) =>
                        setHolidayWorkLocation(
                          normalizeWorkLocationInput(e.target.value),
                        )
                      }
                      placeholder="請輸入工作地點"
                    />
                    {weekdayReports.length > 0 && (
                      <button
                        type="button"
                        className="copy-icon-button"
                        onClick={() => setHolidayWorkLocation(workLocation)}
                        title="從平日加班複製工作地點"
                      >
                        📋 複製
                      </button>
                    )}
                  </div>
                </div>
                <div className="input-group">
                  <label className="label-left">備註：</label>
                  <div className="input-with-copy">
                    <textarea
                      value={holidayRemarks}
                      onChange={(e) => {
                        const normalized = normalizeRemarkInput(e.target.value);
                        if (
                          Array.from(e.target.value.replace(/\r?\n/g, ''))
                            .length > REMARK_MAX_LENGTH
                        ) {
                          alert(
                            `例假日加班備註最多 ${REMARK_MAX_LENGTH} 字（每列 ${REMARK_LINE_LENGTH} 字，共 ${REMARK_TOTAL_LINES} 列）。`,
                          );
                        }
                        setHolidayRemarks(normalized);
                      }}
                      placeholder="請輸入備註（選填）"
                      rows={3}
                      maxLength={REMARK_MAX_LENGTH}
                    />
                    {weekdayReports.length > 0 && (
                      <button
                        type="button"
                        className="copy-icon-button"
                        onClick={() => setHolidayRemarks(remarks)}
                        title="從平日加班複製備註"
                      >
                        📋 複製
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* 例假日加班表格 */}
              {renderTable('例假日加班', holidayReports, 1)}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="btn-confirm"
            onClick={handlePrintRawTxt}
            disabled={!rawTxtContent.trim()}
          >
            列印原始TXT
          </button>
          <button className="btn-confirm" onClick={handleDownloadExcel}>
            下載 Excel
          </button>
          <button className="btn-confirm" onClick={handleDownloadPdf}>
            下載 PDF
          </button>
          <button className="btn-confirm" onClick={handlePrint}>
            列印
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
