import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart3 } from "lucide-react";

interface CategoryBarChartProps {
  data: Array<{ name: string; count: number; fill: string }>;
}

const CategoryBarChart = React.memo(function CategoryBarChart({ data }: CategoryBarChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <BarChart3 className="h-4 w-4 text-primary" /> 카테고리 분포 (48시간)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#8E8E93", fontSize: 11 }}
              tickFormatter={(value: string) => value.length > 8 ? value.slice(0, 8) + "\u2026" : value}
            />
            <YAxis tick={{ fill: "#8E8E93", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #E5E5EA",
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

export default CategoryBarChart;
