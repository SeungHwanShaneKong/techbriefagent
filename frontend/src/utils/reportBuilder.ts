import { categoryLabel } from "../constants";
import type { DailyBriefResponse } from "../types";

export function buildReportHTML(
  dailyBrief: DailyBriefResponse,
  selectedDate: string,
): string {
  const sr = dailyBrief.strategic_report;
  const hasReport = !!sr;

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const pillarsHTML = hasReport
    ? sr!.strategic_pillars
        .map(
          (p) => `
      <span class="pillar-title">&bull; ${esc(p.theme)}</span>
      <div class="pillar-content">
        ${esc(p.situation)}<br>
        <span class="highlight">&rarr;</span> ${esc(p.implication)}
      </div>`
        )
        .join("")
    : '<p style="color:#AEAEB2;">테마별 분석 데이터가 아직 없습니다.</p>';

  const signalsHTML = hasReport
    ? sr!.high_value_signals
        .map((s) => {
          const st = s.signal_type.toLowerCase();
          const cls =
            st.includes("risk") || st.includes("주의")
              ? "risk"
              : st.includes("opportunit") || st.includes("기회")
              ? "opportunity"
              : st.includes("watch") || st.includes("관찰")
              ? "watch"
              : "";
          return `<tr><td class="${cls}">${esc(s.signal_type)}</td><td>${esc(s.description)}</td><td>${esc(s.strategic_response)}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="3" style="text-align:center;color:#AEAEB2;">아직 분석된 신호가 없습니다.</td></tr>';

  const watchItems = hasReport
    ? sr!.consultant_briefing.watch_list.map((w) => esc(w)).join(", ")
    : "모니터링 항목이 아직 없습니다.";

  const csData = dailyBrief.categorized_summary;
  let appendixAInner: string;
  if (csData && csData.length > 0) {
    appendixAInner = csData
      .map(
        (cat) =>
          `<div class="cat-heading"><span class="cat-dot"></span>${esc(cat.category)}</div>
          <ul class="summary-list">${cat.bullets
            .slice(0, 2)
            .map((b) => `<li>${esc(b)}</li>`)
            .join("")}</ul>`
      )
      .join("");
  } else {
    appendixAInner =
      dailyBrief.summary_lines.length > 0
        ? `<ul class="summary-list">${dailyBrief.summary_lines
            .slice(0, 10)
            .map((l, i) => `<li>${i + 1}. ${esc(l)}</li>`)
            .join("")}</ul>`
        : '<p style="color:#AEAEB2;">아직 생성된 요약이 없습니다.</p>';
  }

  const catReportsHTML = (dailyBrief.category_reports || [])
    .map(
      (r) =>
        `<tr><td><strong>${esc(categoryLabel(r.category))}</strong></td><td>${r.article_count}건</td><td>${r.average_sentiment.toFixed(1)}/100</td><td>${esc(r.executive_summary)}</td><td>${r.key_topics.map((t) => esc(t)).join(", ")}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>오늘의 기술 뉴스 브리핑 - ${esc(selectedDate)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
      body { font-family: 'Noto Sans KR', -apple-system, sans-serif; line-height: 1.7; color: #1C1C1E; max-width: 850px; margin: 20px auto; padding: 20px; background-color: #FAFAFA; }
      .header { text-align: center; border-bottom: 3px solid #FF6B35; padding-bottom: 12px; margin-bottom: 24px; }
      .header h1 { color: #1C1C1E; margin: 0; font-size: 22px; }
      .header .subtitle { margin: 6px 0 0; color: #8E8E93; font-size: 14px; }
      .header .meta { margin-top: 6px; font-size: 13px; color: #AEAEB2; }
      .section { margin-bottom: 25px; background: #fff; padding: 18px; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
      .section-title { font-size: 17px; color: #1C1C1E; border-left: 4px solid #FF6B35; padding-left: 10px; margin-bottom: 14px; font-weight: 700; }
      .summary-box { display: flex; justify-content: space-between; background: #FFF0E8; padding: 12px; border-radius: 12px; margin-bottom: 12px; font-size: 14px; gap: 8px; }
      .summary-item { flex: 1; text-align: center; border-right: 1px solid #E5E5EA; padding: 0 8px; }
      .summary-item:last-child { border-right: none; }
      .summary-item strong { display: block; color: #FF6B35; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      .pillar-title { font-weight: bold; color: #1C1C1E; margin-top: 12px; display: block; font-size: 15px; }
      .pillar-content { margin-left: 16px; font-size: 14px; margin-bottom: 12px; color: #8E8E93; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13.5px; }
      th { background-color: #FF6B35; color: white; padding: 10px 8px; text-align: left; font-size: 13px; border-radius: 4px; }
      td { border: 1px solid #E5E5EA; padding: 10px 8px; vertical-align: top; }
      .risk { color: #FF3B30; font-weight: bold; }
      .opportunity { color: #34C759; font-weight: bold; }
      .watch { color: #FF9500; font-weight: bold; }
      .footer { font-size: 13px; color: #AEAEB2; border-top: 1px solid #E5E5EA; padding-top: 12px; margin-top: 24px; text-align: center; }
      .highlight { font-weight: bold; color: #FF6B35; }
      .badge { display: inline-block; background: #FF6B35; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px; margin: 2px; }
      .appendix-title { font-size: 16px; color: #1C1C1E; border-left: 4px solid #FF6B35; padding-left: 8px; margin: 20px 0 10px; font-weight: bold; }
      .summary-list { padding-left: 0; list-style: none; }
      .summary-list li { background: #F5F5F7; padding: 10px 14px; margin-bottom: 5px; border-radius: 10px; font-size: 14px; border-left: 3px solid #FF6B35; color: #1C1C1E; }
      .cat-heading { font-weight: bold; color: #1C1C1E; margin: 16px 0 8px; font-size: 14px; display: flex; align-items: center; gap: 6px; }
      .cat-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #FF6B35; }
      @media print {
        body { border: none; background: white; color: #1C1C1E; }
        .section { box-shadow: none; break-inside: avoid; }
        .header { break-after: avoid; }
      }
      @media (prefers-color-scheme: dark) {
        body { background: #1C1C1E; color: #F5F5F7; }
        .section { background: #2C2C2E; box-shadow: none; }
        .header { border-bottom-color: #FF6B35; }
        td { border-color: #48484A; }
        th { background-color: #FF6B35; }
        .summary-box { background: #3A2A1E; }
        .summary-list li { background: #2C2C2E; color: #F5F5F7; }
      }
  </style>
</head>
<body>
  <div class="header">
      <h1>\u{1F4CB} 오늘의 기술 뉴스 브리핑</h1>
      <p class="subtitle">${esc(selectedDate)} | AI 기반 자동 분석 리포트</p>
      <p class="meta">${dailyBrief.total_articles}건의 기사 \u00B7 ${dailyBrief.unique_publishers}개 매체 \u00B7 전반적 분위기 ${dailyBrief.average_sentiment.toFixed(1)}/100 \u00B7 ${dailyBrief.generated_with_model ? "AI 모델" : "기본 엔진"} 분석 \u00B7 생성: ${new Date().toLocaleString("ko-KR")}</p>
  </div>
  <div class="section">
      <div class="section-title">\u{1F4CC} 오늘의 핵심 요약</div>
      <div class="summary-box">
          <div class="summary-item"><strong>한줄 요약</strong>${hasReport ? esc(sr!.executive_summary.core_message) : "데이터 준비 중"}</div>
          <div class="summary-item"><strong>주요 키워드</strong>${hasReport ? sr!.executive_summary.keywords.map((k) => `<span class="badge">${esc(k)}</span>`).join(" ") : "-"}</div>
          <div class="summary-item"><strong>시장 분위기</strong>${hasReport ? esc(sr!.executive_summary.sentiment_label) : "-"}</div>
      </div>
      <p style="font-size: 14px; margin-top: 10px; color: #8E8E93;">${hasReport ? esc(sr!.executive_summary.market_narrative) : "리포트 데이터가 아직 생성되지 않았습니다."}</p>
  </div>
  <div class="section">
      <div class="section-title">\u{1F50D} 주요 테마 분석</div>
      ${pillarsHTML}
  </div>
  <div class="section">
      <div class="section-title">\u26A1 주목할 신호: 위험과 기회</div>
      <table><tr><th width="20%">구분</th><th width="40%">주요 내용</th><th width="40%">대응 방안</th></tr>${signalsHTML}</table>
  </div>
  <div class="section" style="border: 1px dashed #FF6B35; background: #FFF0E8;">
      <div class="section-title">\u{1F4A1} 오늘의 핵심 인사이트</div>
      <ul style="font-size: 14.5px; padding-left: 20px; color: #1C1C1E;">
          <li><strong>핵심 메시지:</strong> ${hasReport ? esc(sr!.consultant_briefing.insight) : "데이터 준비 중"}</li>
          <li><strong>앞으로 주목할 이슈:</strong> ${watchItems}</li>
      </ul>
  </div>
  <div class="section">
      <div class="appendix-title">\u{1F4CA} 분야별 뉴스 요약</div>
      ${appendixAInner}
  </div>
  ${catReportsHTML ? `<div class="section">
      <div class="appendix-title">\u{1F4C2} 카테고리별 상세 분석</div>
      <table><tr><th>카테고리</th><th>기사 수</th><th>분위기</th><th>핵심 요약</th><th>주요 키워드</th></tr>${catReportsHTML}</table>
  </div>` : ""}
  <div class="footer">이 리포트는 AI가 오늘의 기술 뉴스를 분석하여 자동으로 생성한 요약입니다.</div>
</body>
</html>`;
}
