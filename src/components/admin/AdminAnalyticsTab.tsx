import React from 'react';
import { TrendingUp, LayoutGrid } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

interface AdminAnalyticsTabProps {
  analyticsPeriod: 'day' | 'week' | 'month';
  setAnalyticsPeriod: (period: 'day' | 'week' | 'month') => void;
  isLoadingAnalytics: boolean;
  analytics: any;
}

export const AdminAnalyticsTab: React.FC<AdminAnalyticsTabProps> = ({
  analyticsPeriod,
  setAnalyticsPeriod,
  isLoadingAnalytics,
  analytics
}) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center bg-surface-container/80 p-4 rounded-2xl border border-white/5">
        <h2 className="text-xl font-black text-on-primary-container">Platforma Analitikasi</h2>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setAnalyticsPeriod(p)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
                analyticsPeriod === p ? 'bg-secondary text-black' : 'bg-white/5 text-on-primary-container hover:bg-white/10'
              }`}
            >
              {p === 'day' ? 'Bugun' : p === 'week' ? 'Haftalik' : 'Oylik'}
            </button>
          ))}
        </div>
      </div>

      {isLoadingAnalytics ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-secondary"></div>
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Chart */}
          <div className="bg-surface-container/80 p-6 rounded-2xl border border-white/5 shadow-2xl">
            <h3 className="text-sm font-bold text-on-primary-container mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Daromad Grafigi ($)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyRevenue.map((d: any) => ({
                  date: new Date(d.date).toLocaleDateString(),
                  amount: d.amount || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-on-primary-container)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-on-primary-container)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-background)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: 'var(--color-success)', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="var(--color-success)" strokeWidth={3} dot={{ fill: 'var(--color-success)', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categories Pie Chart */}
          <div className="bg-surface-container/80 p-6 rounded-2xl border border-white/5 shadow-2xl">
            <h3 className="text-sm font-bold text-on-primary-container mb-6 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-secondary" />
              Kategoriyalar Bo'yicha Startaplar
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.topCategories.map((c: any) => ({ name: c.category, value: c._count }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analytics.topCategories.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f3ba2f', '#ef4444', '#8b5cf6'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-background)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
