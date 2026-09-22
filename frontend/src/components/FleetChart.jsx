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
      <div className="bg-[#141B22] border border-[#2D3742] rounded-lg p-3 shadow-xl text-xs backdrop-blur-md">
        <p className="font-bold text-[#F1F5F9] mb-1.5 font-mono">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[#CBD5E1]">{entry.name}:</span>
              </div>
              <span className="font-mono font-bold text-[#F1F5F9]">
                {Number(entry.value).toFixed(2)} GB
              </span>
            </div>
          ))}
          <div className="pt-1.5 mt-1 border-t border-[#242D36] flex justify-between gap-4 font-bold">
            <span className="text-[#94A3B8]">Total Día:</span>
            <span className="text-[#F39200] font-mono">{total.toFixed(2)} GB</span>
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
      <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg p-6 text-center text-[#94A3B8] text-sm">
        No hay registros históricos de consumo disponibles.
      </div>
    );
  }

  const chartData = data.map(item => {
    const parts = item.date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
    return {
      ...item,
      displayDate: formattedDate
    };
  });

  return (
    <div className="bg-[#1A222B] border border-[#2D3742] rounded-lg p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-[rgba(243,146,0,0.16)] text-[#F39200] border border-[rgba(243,146,0,0.3)]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm lg:text-base font-bold text-[#F1F5F9] tracking-tight">
              Tendencia de Consumo Global de la Flota (Últimos 30 Días)
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Desglose acumulado de tráfico Priority, Opt-In y Standard de todos los enlaces
            </p>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              {/* Priority - Verde corporativo #38A169 */}
              <linearGradient id="priorityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38A169" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#38A169" stopOpacity={0.0}/>
              </linearGradient>
              {/* Opt-In - Naranja Milicic #F39200 */}
              <linearGradient id="optInGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F39200" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#F39200" stopOpacity={0.0}/>
              </linearGradient>
              {/* Standard - Azul Informativo #3182CE */}
              <linearGradient id="standardGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3182CE" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#3182CE" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#242D36" vertical={false} />

            <XAxis
              dataKey="displayDate"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={65}
              unit=" GB"
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', color: '#94A3B8' }}
            />

            <Area
              type="monotone"
              dataKey="priority_gb"
              name="Priority Data"
              stroke="#38A169"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#priorityGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="opt_in_priority_gb"
              name="Opt-In Overage"
              stroke="#F39200"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#optInGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="standard_gb"
              name="Standard Data"
              stroke="#3182CE"
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
