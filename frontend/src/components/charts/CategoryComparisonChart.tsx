import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { BarChart3, Loader2 } from "lucide-react";

import { fetchCategoryComparison } from "../../api";
import type { CategoryComparisonResponse } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { categoryColor, categoryLabel } from "../../constants";

export default function CategoryComparisonChart() {
  const [data, setData] = useState<CategoryComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategoryComparison(7)
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

  if (!data || data.categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[15px]">
            <BarChart3 className="h-4 w-4 text-primary" /> 카테고리 비교
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-tertiary dark:text-gray-500 text-center py-8">데이터가 부족합니다.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.categories.slice(0, 8).map((cat) => ({
    name: categoryLabel(cat.category).slice(0, 10),
    기사수: cat.article_count,
    감성: Math.round(cat.avg_sentiment),
    fill: categoryColor(cat.category),
    keywords: cat.top_keywords.join(", "),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <BarChart3 className="h-4 w-4 text-primary" /> 카테고리 비교 분석
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border dark:stroke-gray-700" />
            <XAxis dataKey="name" className="text-xs" tick={{ fill: "currentColor", fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
            <YAxis yAxisId="left" className="text-xs" tick={{ fill: "currentColor", fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} className="text-xs" tick={{ fill: "currentColor", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--color-surface, #f8f9fa)", border: "1px solid var(--color-border, #e5e7eb)", borderRadius: 12, fontSize: 12 }}
              formatter={(value, name) => [String(name) === "감성" ? `${value}/100` : String(value), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="기사수" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="감성" fill="#6366f1" radius={[4, 4, 0, 0]} fillOpacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
        {/* Top keywords per category */}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.categories.slice(0, 5).map((cat) => (
            <div key={cat.category} className="rounded-lg bg-surface dark:bg-gray-800 px-2.5 py-1.5 text-[11px]">
              <span className="font-medium text-text-primary dark:text-gray-200">{categoryLabel(cat.category)}</span>
              <span className="text-text-tertiary dark:text-gray-500 ml-1">{cat.top_keywords.slice(0, 3).join(", ")}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
