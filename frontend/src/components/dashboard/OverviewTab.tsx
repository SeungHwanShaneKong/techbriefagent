import CategoryBarChart from "../charts/CategoryBarChart";
import CostAreaChart from "../charts/CostAreaChart";
import KeywordCloud from "../charts/KeywordCloud";

interface OverviewTabProps {
  categoryChartData: Array<{ name: string; count: number; fill: string }>;
  costData: Array<{ date: string; cost_usd: number }>;
  keywordTrend: Array<{ name: string; count: number }>;
  setSearchKeyword: (kw: string) => void;
  showToast: (msg: string) => void;
}

export default function OverviewTab({
  categoryChartData,
  costData,
  keywordTrend,
  setSearchKeyword,
  showToast,
}: OverviewTabProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <CategoryBarChart data={categoryChartData} />
      <CostAreaChart data={costData} />
      <KeywordCloud
        keywords={keywordTrend}
        onKeywordClick={(kw) => {
          setSearchKeyword(kw);
          showToast(`"${kw}" 키워드로 필터링합니다`);
        }}
      />
    </div>
  );
}
