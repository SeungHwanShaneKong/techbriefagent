import dayjs from "dayjs";

/** Format date string (YYYY-MM-DD) to Korean locale display */
export function formatDate(dateStr: string, format = "YYYY년 M월 D일"): string {
  const d = dayjs(dateStr);
  return d.isValid() ? d.format(format) : dateStr;
}

/** Format number with thousands separators */
export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** Format USD cost to display string */
export function formatCost(usd: number, decimals = 4): string {
  return `$${usd.toFixed(decimals)}`;
}

/** Format KRW cost to display string */
export function formatKRW(krw: number): string {
  return `₩${Math.round(krw).toLocaleString("ko-KR")}`;
}

/** Relative time display (e.g., "3분 전", "2시간 전") */
export function relativeTime(dateStr: string): string {
  const now = dayjs();
  const target = dayjs(dateStr);
  if (!target.isValid()) return dateStr;

  const diffMin = now.diff(target, "minute");
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = now.diff(target, "hour");
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = now.diff(target, "day");
  if (diffDay < 7) return `${diffDay}일 전`;

  return target.format("M월 D일");
}
