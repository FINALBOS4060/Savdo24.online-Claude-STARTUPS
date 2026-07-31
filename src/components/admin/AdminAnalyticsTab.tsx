import React from 'react';
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
      <div className="flex justify-between items-center bg-[#0e1726]/80 p-4 rounded-2xl border border-white/5">
        <h2 className="text-xl font-black text-white">Platforma Analitikasi</h2>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setAnalyticsPeriod(p)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all border-none cursor-pointer ${
                analyticsPeriod === p ? 'bg-[#f0b90b] text-black' : 'bg-white/5 text-[#8892b0] hover:bg-white/10'
              }`}
            >
              {p === 'day' ? 'Bugun' : p === 'week' ? 'Haftalik' : 'Oylik'}
            </button>
          ))}
        </div>
      </div>

      {isLoadingAnalytics ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#f0b90b]"></div>
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Chart */}
          <div className="bg-[#0e1726]/80 p-6 rounded-3xl border border-white/5 shadow-2xl">
            <h3 className="text-sm font-bold text-on-primary-container mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">payments</span>
              Daromad Grafigi ($)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyRevenue.map((d: any) => ({
                  date: new Date(d.createdAt).toLocaleDateString(),
                  amount: d._sum.platformFeeAmount || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#8892b0" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#8892b0" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0b1426', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Categories Pie Chart */}
          <div className="bg-[#0e1726]/80 p-6 rounded-3xl border border-white/5 shadow-2xl">
            <h3 className="text-sm font-bold text-on-primary-container mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#f3ba2f]">category</span>
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
                    contentStyle={{ backgroundColor: '#0b1426', border: '1px solid #ffffff10', borderRadius: '12px' }}
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
