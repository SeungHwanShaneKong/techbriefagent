import { ChevronRight, Download } from "lucide-react";

import type { CategoryReport, DailyBriefResponse, StrategicReport } from "../../types";
import { buildReportHTML } from "../../utils/reportBuilder";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface DailyReportTabProps {
  dailyBrief: DailyBriefResponse;
  selectedDate: string;
  categoryReportData: Array<CategoryReport & { categoryLabel: string }>;
}

export default function DailyReportTab({
  dailyBrief,
  selectedDate,
  categoryReportData,
}: DailyReportTabProps) {
  const sr: StrategicReport | null | undefined = dailyBrief.strategic_report;
  const hasReport = !!sr;

  function handleDownloadHTML() {
    const html = buildReportHTML(dailyBrief, selectedDate);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tech_Brief_${selectedDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* ── Report Header Card ── */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">📋 오늘의 기술 뉴스 브리핑</h2>
              <p className="mt-1 text-sm text-white/80">
                {selectedDate} · AI 기반 자동 분석 리포트
              </p>
            </div>
            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <Download className="h-4 w-4" />
              HTML 다운로드
            </button>
          </div>
          {/* Meta stats */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: "기사 수", value: `${dailyBrief.total_articles}건` },
              { label: "매체 수", value: `${dailyBrief.unique_publishers}개` },
              { label: "분위기", value: `${dailyBrief.average_sentiment.toFixed(1)}/100` },
              { label: "분석 엔진", value: dailyBrief.generated_with_model ? "AI 모델" : "기본 엔진" },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[11px] text-white/70">{m.label}</p>
                <p className="text-sm font-bold">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Executive Summary ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">📌 오늘의 핵심 요약</CardTitle>
        </CardHeader>
        <CardContent>
          {hasReport ? (
            <>
              <div className="grid grid-cols-3 gap-3 rounded-2xl bg-primary-light p-4">
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">한줄 요약</p>
                  <p className="mt-1 text-sm text-text-primary">{sr!.executive_summary.core_message}</p>
                </div>
                <div className="border-x border-primary/20 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">주요 키워드</p>
                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                    {sr!.executive_summary.keywords.map((kw) => (
                      <span key={kw} className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-white">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">시장 분위기</p>
                  <p className="mt-1 text-sm font-medium text-text-primary">{sr!.executive_summary.sentiment_label}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary">{sr!.executive_summary.market_narrative}</p>
            </>
          ) : (
            <div className="rounded-2xl bg-surface p-6 text-center">
              <p className="text-sm text-text-tertiary">리포트 데이터가 아직 생성되지 않았습니다. 기사 수집 후 자동으로 만들어집니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Strategic Pillars ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">🔍 주요 테마 분석</CardTitle>
        </CardHeader>
        <CardContent>
          {hasReport && sr!.strategic_pillars.length > 0 ? (
            <div className="space-y-3">
              {sr!.strategic_pillars.map((pillar, idx) => (
                <div key={`pillar-${idx}`} className="rounded-2xl border border-border/60 bg-surface p-4 transition-colors hover:bg-white">
                  <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-white">{idx + 1}</span>
                    {pillar.theme}
                  </h4>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">{pillar.situation}</p>
                  <div className="mt-2 flex items-start gap-1.5">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm font-medium text-primary">{pillar.implication}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface p-6 text-center">
              <p className="text-sm text-text-tertiary">테마별 분석 데이터가 아직 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── High Value Signals ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">⚡ 주목할 신호: 위험과 기회</CardTitle>
        </CardHeader>
        <CardContent>
          {hasReport && sr!.high_value_signals.length > 0 ? (
            <div className="space-y-3">
              {sr!.high_value_signals.map((signal, idx) => {
                const st = signal.signal_type.toLowerCase();
                const isRisk = st.includes("risk") || st.includes("주의");
                const isOpp = st.includes("opportunit") || st.includes("기회");
                const color = isRisk ? "danger" : isOpp ? "success" : "warning";
                const colorMap = { danger: "#FF3B30", success: "#34C759", warning: "#FF9500" };
                return (
                  <div key={`signal-${idx}`} className="flex gap-4 rounded-2xl border border-border/60 bg-white p-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
                      style={{ backgroundColor: colorMap[color] }}
                    >
                      {isRisk ? "⚠" : isOpp ? "✦" : "◉"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold" style={{ color: colorMap[color] }}>{signal.signal_type}</p>
                      <p className="mt-1 text-sm text-text-primary">{signal.description}</p>
                      <p className="mt-1.5 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">대응:</span> {signal.strategic_response}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface p-6 text-center">
              <p className="text-sm text-text-tertiary">아직 분석된 신호가 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Consultant Insight ── */}
      <Card className="border-primary/20 bg-primary-light">
        <CardHeader>
          <CardTitle className="text-[15px] text-primary">💡 오늘의 핵심 인사이트</CardTitle>
        </CardHeader>
        <CardContent>
          {hasReport ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs font-semibold text-primary mb-1">핵심 메시지</p>
                <p className="text-sm text-text-primary leading-relaxed">{sr!.consultant_briefing.insight}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs font-semibold text-primary mb-1">앞으로 주목할 이슈</p>
                <p className="text-sm text-text-primary leading-relaxed">
                  {sr!.consultant_briefing.watch_list.length > 0
                    ? sr!.consultant_briefing.watch_list.join(" · ")
                    : "아직 등록된 이슈가 없습니다."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-white p-6 text-center">
              <p className="text-sm text-text-tertiary">인사이트 데이터가 아직 없습니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Categorized Summary ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">📊 분야별 뉴스 요약 ({selectedDate})</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const cs = dailyBrief.categorized_summary;
            if (cs && cs.length > 0) {
              return (
                <div className="space-y-4">
                  {cs.map((item, catIdx) => (
                    <div key={`cs-${catIdx}`}>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-text-primary">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                        {item.category}
                      </h4>
                      <div className="space-y-1.5">
                        {item.bullets.slice(0, 2).map((bullet, bIdx) => (
                          <div
                            key={`cs-${catIdx}-b-${bIdx}`}
                            className="rounded-xl border-l-[3px] border-primary bg-surface px-4 py-3 text-sm text-text-primary leading-relaxed"
                          >
                            {bullet}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            if (dailyBrief.summary_lines.length > 0) {
              return (
                <div className="space-y-1.5">
                  {dailyBrief.summary_lines.slice(0, 10).map((line, idx) => (
                    <div
                      key={`summary-${idx}`}
                      className="rounded-xl border-l-[3px] border-primary bg-surface px-4 py-3 text-sm text-text-primary leading-relaxed"
                    >
                      <span className="mr-2 font-bold text-primary">{idx + 1}.</span>
                      {line}
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div className="rounded-2xl bg-surface p-6 text-center">
                <p className="text-sm text-text-tertiary">아직 생성된 요약이 없습니다.</p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ── Category Reports Table ── */}
      {categoryReportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-[15px]">📂 카테고리별 상세 분석</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">카테고리</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">기사 수</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">분위기</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">핵심 요약</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">주요 키워드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryReportData.map((report: CategoryReport & { categoryLabel: string }) => (
                    <tr key={`cat-row-${report.category}`} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-text-primary">{report.categoryLabel}</td>
                      <td className="px-4 py-3 text-text-secondary">{report.article_count}건</td>
                      <td className="px-4 py-3 text-text-secondary">{report.average_sentiment.toFixed(1)}/100</td>
                      <td className="px-4 py-3 text-text-secondary max-w-xs">{report.executive_summary}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {report.key_topics.map((topic) => (
                            <span key={`${report.category}-${topic}`} className="inline-block rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Footer ── */}
      <div className="text-center text-xs text-text-tertiary py-2">
        이 리포트는 AI가 오늘의 기술 뉴스를 분석하여 자동으로 생성한 요약입니다.
      </div>
    </div>
  );
}
