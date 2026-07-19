import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { Users, TrendingUp, Clock, BarChart2, Loader2 } from "lucide-react";
import { api, type BusinessAnalytics } from "@/lib/api";

interface Props {
  businessId: string;
}

const HOUR_LABELS: Record<number, string> = {
  0: "12am", 1: "1am", 2: "2am", 3: "3am", 4: "4am", 5: "5am",
  6: "6am", 7: "7am", 8: "8am", 9: "9am", 10: "10am", 11: "11am",
  12: "12pm", 13: "1pm", 14: "2pm", 15: "3pm", 16: "4pm", 17: "5pm",
  18: "6pm", 19: "7pm", 20: "8pm", 21: "9pm", 22: "10pm", 23: "11pm",
};

function fillDailyGaps(raw: { date: string; count: number }[]): { date: string; label: string; count: number }[] {
  const byDate = new Map(raw.map((r) => [r.date, r.count]));
  const result: { date: string; label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const key = format(d, "yyyy-MM-dd");
    result.push({
      date: key,
      label: format(d, "MMM d"),
      count: byDate.get(key) ?? 0,
    });
  }
  return result;
}

function fillHourGaps(raw: { hour: number; count: number }[]): { hour: number; label: string; count: number }[] {
  const byHour = new Map(raw.map((r) => [r.hour, r.count]));
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: HOUR_LABELS[h] ?? `${h}:00`,
    count: byHour.get(h) ?? 0,
  }));
}

export function EngagementAnalytics({ businessId }: Props) {
  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api
      .get<BusinessAnalytics>(`/api/business/${businessId}/analytics`)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-xs text-muted-foreground/60 py-4 text-center">
        Analytics unavailable
      </p>
    );
  }

  const daily = fillDailyGaps(data.dailyCheckins);
  const hourly = fillHourGaps(data.peakHours);
  const peakHour = hourly.reduce((best, h) => (h.count > best.count ? h : best), hourly[0]!);

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Check-ins (30d)</p>
            <p className="text-xl font-bold text-foreground">{data.totalCheckins.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <Users className="w-4 h-4 text-chart-2 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Unique visitors</p>
            <p className="text-xl font-bold text-foreground">{data.uniqueVisitors.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" />
          30-day check-in trend
        </p>
        <div className="h-[90px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${businessId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--card-border, var(--border)))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                itemStyle={{ color: "hsl(var(--primary))" }}
                formatter={(v: number) => [v, "check-ins"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill={`url(#grad-${businessId})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Peak hours
          {data.totalCheckins > 0 && (
            <span className="ml-auto text-primary font-semibold">
              Busiest: {peakHour.label}
            </span>
          )}
        </p>
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly} margin={{ top: 4, right: 4, left: -30, bottom: 0 }} barSize={6}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--card-border, var(--border)))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                itemStyle={{ color: "hsl(var(--chart-2))" }}
                formatter={(v: number) => [v, "check-ins"]}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--chart-2))"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
