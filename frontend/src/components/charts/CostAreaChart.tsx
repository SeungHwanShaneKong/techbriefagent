import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { DollarSign } from "lucide-react";

interface CostAreaChartProps {
  data: Array<{ date: string; cost_usd: number }>;
}

const CostAreaChart = React.memo(function CostAreaChart({ data }: CostAreaChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <DollarSign className="h-4 w-4 text-primary" /> 비용 추이 (USD)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-72 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FF6B35" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8E8E93", fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={60}
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
            <Area type="monotone" dataKey="cost_usd" stroke="#FF6B35" strokeWidth={2} fillOpacity={1} fill="url(#costGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

export default CostAreaChart;
