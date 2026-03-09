import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, TrendingUp } from "lucide-react";

import { fetchSentimentTrend } from "../../api";
import type { SentimentTrendResponse } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function SentimentTrendChart() {
  const [data, setData] = useState<SentimentTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSentimentTrend(7)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.trend.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <TrendingUp className="h-4 w-4 text-primary" /> 감성 트렌드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-tertiary dark:text-gray-500 text-center py-8">데이터가 부족합니다.</p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data with category lines
  const categories = Object.keys(data.by_category).slice(0, 5);
  const chartData = data.trend.map((point) => {
    const entry: Record<string, unknown> = {
      date: point.date.slice(5), // MM-DD
      전체: point.avg_sentiment,
    };
    for (const cat of categories) {
      const catPoint = data.by_category[cat]?.find((p) => p.date === point.date);
      entry[cat] = catPoint?.avg_sentiment ?? null;
    }
    return entry;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <TrendingUp className="h-4 w-4 text-primary" /> 7일 감성 트렌드
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border dark:stroke-gray-700" />
            <XAxis dataKey="date" className="text-xs" tick={{ fill: "currentColor", fontSize: 11 }} />
            <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: "currentColor", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--color-surface, #f8f9fa)", border: "1px solid var(--color-border, #e5e7eb)", borderRadius: 12, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="전체" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
            {categories.map((cat, i) => (
              <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[(i + 1) % COLORS.length]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
