import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
    return (
      <div className="bg-slate-900/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs">
        <p className="font-bold text-slate-200 mb-1.5 font-mono">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-300">{entry.name}:</span>
              </div>
              <span className="font-mono font-bold text-white">
                {Number(entry.value).toFixed(2)} GB
              </span>
            </div>
          ))}
          <div className="pt-1.5 mt-1 border-t border-white/10 flex justify-between gap-4 font-bold">
            <span className="text-slate-200">Total Día:</span>
            <span className="text-emerald-400 font-mono">{total.toFixed(2)} GB</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function FleetChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center text-slate-400 text-sm">
        No hay registros históricos de consumo disponibles.
      </div>
    );
  }

  // Format date labels (e.g. "15 Sep")
  const chartData = data.map(item => {
    const parts = item.date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
    return {
      ...item,
      displayDate: formattedDate
    };
  });

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Tendencia de Consumo Global de la Flota (Últimos 30 Días)
            </h2>
            <p className="text-xs text-slate-400">
              Desglose acumulado de tráfico Priority, Standard y Opt-In de todos los enlaces
            </p>
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priorityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="optInGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="standardGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="displayDate"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              unit=" GB"
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
            />

            <Area
              type="monotone"
              dataKey="priority_gb"
              name="Priority Data"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#priorityGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="opt_in_priority_gb"
              name="Opt-In Overage"
              stroke="#f59e0b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#optInGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="standard_gb"
              name="Standard Data"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#standardGrad)"
              stackId="1"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
