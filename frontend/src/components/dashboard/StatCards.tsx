import { DollarSign, Newspaper, Sparkles, Zap } from "lucide-react";
import type { StatsResponse } from "../../types";

interface StatCardsProps {
  stats: StatsResponse;
}

function StatMini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white border border-border/60 px-4 py-3 shadow-card">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary truncate">{label}</p>
        <p className="text-lg font-bold text-text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

export default function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatMini
        icon={<Newspaper className="h-5 w-5" />}
        label="최근 48시간 기사"
        value={stats.total_articles.toLocaleString()}
      />
      <StatMini
        icon={<DollarSign className="h-5 w-5" />}
        label="누적 비용 (USD)"
        value={`$${stats.usage.total_estimated_cost_usd.toFixed(4)}`}
      />
      <StatMini
        icon={<Sparkles className="h-5 w-5" />}
        label="총 요약 요청"
        value={stats.usage.total_requests.toLocaleString()}
      />
      <StatMini
        icon={<Zap className="h-5 w-5" />}
        label="현재 모델"
        value={stats.usage.current_model}
      />
    </div>
  );
}
