/**
 * 首頁頂部導覽列。
 *
 * 職責：版頭展示 + 明確的身分相關入口（行事曆／Admin）。
 */
import type { ReactElement, ReactNode } from 'react';
import { CrownBrand } from '@shared-ui/crown-brand';
import { NavCalendarCluster, PortalTopNav } from '@shared-ui/portal-nav';
import logoUrl from '@shared-ui/crown-brand/assets/CROWN_logo.png';
import { APP_VERSION } from '../constants/appVersion';

type TopTitleNavProps = {
  /** 右側操作區（請假行事曆、Admin、登入態等） */
  actions?: ReactNode;
};

/**
 * 組合 shared-ui 的共用版頭元件，提供首頁一致的入口網站外觀。
 */
export function TopTitleNav({ actions }: TopTitleNavProps): ReactElement {
  return (
    <PortalTopNav
      left={<CrownBrand logoSrc={logoUrl} title="海灣國際" subtitle="" />}
      center={
        <div className="flex flex-col items-center justify-center gap-0.5 text-center min-w-0 px-2">
          <span className="font-black text-base sm:text-lg text-gray-800 tracking-tight leading-tight">
            出勤加班單系統
          </span>
          <span className="text-xs font-bold text-blue-600 tabular-nums">
            v{APP_VERSION}
          </span>
        </div>
      }
      right={
        <div className="flex items-center gap-3 min-w-0">
          {actions}
          <NavCalendarCluster />
        </div>
      }
    />
  );
}
