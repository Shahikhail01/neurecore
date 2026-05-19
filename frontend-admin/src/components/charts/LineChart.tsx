"use client";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartSkeleton } from "./ChartSkeleton";
import type { ChartProps, TimeSeriesPoint } from "@/types/ui.types";
import { format } from "date-fns";

interface LineChartProps extends ChartProps<TimeSeriesPoint> {
  color?: string;
  label?: string;
  dataKey?: string;
  xKey?: string; // accepted for API compatibility
}

export function LineChart({
  data,
  loading = false,
  height = 200,
  className = "",
  color = "#22c55e",
  label = "Value",
}: LineChartProps) {
  if (loading) return <ChartSkeleton height={height} className={className} />;

  const formatted = data.map((d) => ({
    ...d,
    _label: (() => {
      try {
        return format(new Date(d.ts), "HH:mm");
      } catch {
        return d.ts;
      }
    })(),
  }));

  return (
    <div
      className={className}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        minWidth: 0,
        minHeight: typeof height === "number" ? `${height}px` : height,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart
          data={formatted}
          margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="_label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}
