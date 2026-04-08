import type { ReactElement } from 'react';
import { CrownBrand } from '@shared-ui/crown-brand';
import { NavCalendarCluster, PortalTopNav } from '@shared-ui/portal-nav';
import logoUrl from '@shared-ui/crown-brand/assets/CROWN_logo.png';
import { APP_VERSION } from '../constants/appVersion';

/**
 * 首頁頂部導覽：左品牌、中系統名稱與版號、右即時日期時間。
 */
export function TopTitleNav(): ReactElement {
  return (
    <PortalTopNav
      left={<CrownBrand logoSrc={logoUrl} title="海灣國際" subtitle="" />}
      center={
        <div className="flex flex-col items-center justify-center gap-0.5 text-center min-w-0 px-2">
          <span className="font-black text-base sm:text-lg text-gray-800 tracking-tight leading-tight">
            出勤加班單系統
          </span>
          <span className="text-xs font-bold text-blue-600 tabular-nums">v{APP_VERSION}</span>
        </div>
      }
      right={<NavCalendarCluster />}
    />
  );
}
