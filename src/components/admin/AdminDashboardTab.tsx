import React, { useEffect, useState } from 'react';
import { Users, Rocket, Handshake, DollarSign, Gavel, Flag, Bot, Send, Activity, Server, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../lib/formatDate';

interface AdminDashboardTabProps {
  stats: any;
  setActiveTab: (tab: any) => void;
}

interface TelegramStats {
  linkedUsersCount: number;
  actionsToday: number;
  topFeatures: { event: string; count: number }[];
  dailySeries: { day: string; count: number }[];
  subscriberBotFunnel?: { starts: number; gatePassed: number; conversionRate: number };
}

// 4-so'rov: "Bot faolligi statistikasi". O'z holicha /api/admin/telegram-stats'ni
// yuklaydi — asosiy dashboard `stats` prop'idan mustaqil, chunki alohida
// endpoint (aks holda /api/admin/stats juda og'irlashib ketardi).
const FEATURE_LABELS: Record<string, string> = {
  bot_menu_new_listings: "Yangi e'lonlar",
  bot_menu_top_deals: "TOP takliflar",
  bot_menu_profile: "Profil",
  bot_menu_exchange: "Obunachi yig'ish",
  bot_menu_search: "Qidiruv tugmasi",
  bot_search: "Botda qidiruv",
  bot_buy_initiated: "Xarid boshlash",
  bot_account_linked: "Hisob ulash",
  bot_inline_search: "Tezkor qidiruv (inline)",
  // TUZATISH: bu ikkisi (obunachi yig'ish botining hodisalari) avval
  // ro'yxatda yo'q edi — topFeatures'da xom event nomi ko'rinardi.
  subscriber_bot_start: "Obunachi boti: /start",
  subscriber_bot_gate_passed: "Obunachi boti: obuna tasdiqlandi"
};

interface ProcessInfo {
  key: 'server' | 'bot';
  name: string;
  found: boolean;
  status: string;
  uptimeMs: number | null;
  restarts: number | null;
  memoryMb: number | null;
  cpuPercent: number | null;
}

function formatUptime(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}k ${hours}s`;
  if (hours > 0) return `${hours}s ${mins}d`;
  return `${mins}d`;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  online: { label: 'Ishlamoqda', className: 'bg-success-container/10 text-success border-success/20' },
  stopped: { label: "To'xtatilgan", className: 'bg-white/5 text-on-primary-container/70 border-white/10' },
  stopping: { label: "To'xtamoqda", className: 'bg-secondary/10 text-secondary border-secondary/20' },
  errored: { label: 'Xato (qulagan)', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  launching: { label: 'Ishga tushmoqda', className: 'bg-secondary/10 text-secondary border-secondary/20' },
  not_found: { label: 'Topilmadi', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  unknown: { label: "Noma'lum", className: 'bg-white/5 text-on-primary-container/70 border-white/10' }
};

// TUZATISH: bu karta YO'Q EDI — dashboardda faqat foydalanuvchi bot
// faolligi statistikasi (TelegramBotStatsCard, pastda) bor edi, bot
// jarayonining O'ZI (PM2: online/errored/to'xtagan) uchun hech qanday
// monitoring yo'q edi. Admin bot ishlamay qolganini faqat botga xabar
// yozib "javob yo'q" deb payqardi. Endi /api/admin/rebuild/process-status
// har 20 soniyada so'raladi va ikkala PM2 jarayonining (asosiy server +
// telegram-bot) haqiqiy holati badge sifatida ko'rsatiladi.
const ProcessStatusCard: React.FC = () => {
  const [data, setData] = useState<{ available: boolean; processes: ProcessInfo[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/admin/rebuild/process-status')
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { if (!cancelled) setData(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const interval = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const labelFor = (p: ProcessInfo) => p.key === 'server' ? 'Asosiy server' : 'Telegram bot';
  const iconFor = (p: ProcessInfo) => p.key === 'server' ? Server : Bot;

  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 shadow-2xl">
      <h3 className="text-lg font-bold text-on-primary-container mb-6 flex items-center gap-2">
        <Activity className="text-secondary w-5 h-5" />
        Jarayonlar holati (PM2)
      </h3>

      {loading ? (
        <p className="text-xs text-on-primary-container italic py-4">Yuklanmoqda...</p>
      ) : !data?.available ? (
        <div className="flex items-start gap-2 text-xs text-on-primary-container/80 bg-surface-container-low border border-white/5 rounded-xl p-4">
          <AlertTriangle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <p>PM2 monitoring bu muhitda mavjud emas (masalan Render yoki dev rejimida). Jarayon holati faqat PM2 ishlatilgan hosting muhitida ko'rinadi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.processes.map((p) => {
            const style = STATUS_STYLES[p.status] || STATUS_STYLES.unknown;
            const Icon = iconFor(p);
            return (
              <div key={p.key} className="p-4 bg-surface-container-low border border-white/5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-secondary" /> {labelFor(p)}
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${style.className}`}>
                    {style.label}
                  </span>
                </div>
                <p className="text-[11px] text-on-primary-container/60 font-mono">{p.name}</p>
                {p.found && (
                  <div className="flex items-center gap-4 text-xs text-on-primary-container/80 pt-1">
                    <span>Uptime: <span className="font-mono font-bold">{formatUptime(p.uptimeMs)}</span></span>
                    <span>Restart: <span className="font-mono font-bold">{p.restarts ?? '—'}</span></span>
                    {p.memoryMb !== null && <span>RAM: <span className="font-mono font-bold">{p.memoryMb}MB</span></span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TelegramBotStatsCard: React.FC = () => {
  const [tgStats, setTgStats] = useState<TelegramStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/telegram-stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setTgStats(data); })
      .catch(() => { if (!cancelled) setTgStats(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const maxDaily = tgStats?.dailySeries?.length
    ? Math.max(1, ...tgStats.dailySeries.map((d) => d.count))
    : 1;

  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 shadow-2xl">
      <h3 className="text-lg font-bold text-on-primary-container mb-6 flex items-center gap-2">
        <Bot className="text-secondary w-5 h-5" />
        Telegram bot faolligi
      </h3>

      {loading ? (
        <p className="text-xs text-on-primary-container italic py-4">Yuklanmoqda...</p>
      ) : !tgStats ? (
        <p className="text-xs text-on-primary-container italic py-4">Statistikani yuklab bo'lmadi.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-container-low border border-white/5 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Ulangan</span>
                <Users className="text-blue-400 w-4 h-4" />
              </div>
              <div className="text-xl font-black font-mono text-on-primary-container">{tgStats.linkedUsersCount}</div>
              <p className="text-xs text-on-primary-container">Telegram bog'langan foydalanuvchi</p>
            </div>
            <div className="p-4 bg-surface-container-low border border-white/5 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Bugun</span>
                <Activity className="text-success w-4 h-4" />
              </div>
              <div className="text-xl font-black font-mono text-on-primary-container">{tgStats.actionsToday}</div>
              <p className="text-xs text-on-primary-container">Bugungi bot harakatlari</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-on-primary-container uppercase tracking-wider mb-3 flex items-center gap-2">
              <Send className="w-4 h-4" /> Oxirgi 7 kunlik faollik
            </p>
            <div className="flex items-end gap-2 h-24">
              {tgStats.dailySeries.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div
                    className="w-full bg-secondary-container rounded-t-md min-h-[2px]"
                    style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    title={`${d.day}: ${d.count}`}
                  />
                  <span className="text-[9px] text-on-primary-container/60">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>

          {tgStats.subscriberBotFunnel && tgStats.subscriberBotFunnel.starts > 0 && (
            <div>
              <p className="text-xs font-bold text-on-primary-container uppercase tracking-wider mb-3">
                Obunachi yig'ish boti (konversiya)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface-container-low border border-white/5 rounded-xl text-center">
                  <div className="text-lg font-black font-mono text-on-primary-container">{tgStats.subscriberBotFunnel.starts}</div>
                  <p className="text-[10px] text-on-primary-container/60">/start bosdi</p>
                </div>
                <div className="p-3 bg-surface-container-low border border-white/5 rounded-xl text-center">
                  <div className="text-lg font-black font-mono text-success">{tgStats.subscriberBotFunnel.gatePassed}</div>
                  <p className="text-[10px] text-on-primary-container/60">Obuna bo'ldi</p>
                </div>
                <div className="p-3 bg-surface-container-low border border-white/5 rounded-xl text-center">
                  <div className="text-lg font-black font-mono text-secondary">{tgStats.subscriberBotFunnel.conversionRate}%</div>
                  <p className="text-[10px] text-on-primary-container/60">Konversiya</p>
                </div>
              </div>
            </div>
          )}

          {tgStats.topFeatures.length > 0 && (
            <div>
              <p className="text-xs font-bold text-on-primary-container uppercase tracking-wider mb-3">Eng faol funksiyalar</p>
              <div className="space-y-2">
                {tgStats.topFeatures.map((f) => (
                  <div key={f.event} className="flex justify-between items-center text-xs">
                    <span className="text-on-primary-container">{FEATURE_LABELS[f.event] || f.event}</span>
                    <span className="font-mono font-bold text-secondary">{f.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ stats, setActiveTab }) => {
  if (!stats) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Foydalanuvchilar</span>
            <Users className="text-blue-400 w-5 h-5" />
          </div>
          <div className="text-2xl font-black font-mono text-on-primary-container">{stats.totalUsers}</div>
          <p className="text-xs text-on-primary-container">Jami ro'yxatdan o'tganlar</p>
        </div>

        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Faol e'lonlar</span>
            <Rocket className="text-success w-5 h-5" />
          </div>
          <div className="text-2xl font-black font-mono text-on-primary-container">{stats.totalActiveStartups}</div>
          <p className="text-xs text-on-primary-container">Hozirda sotuvdagilar</p>
        </div>

        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Yakunlangan savdolar</span>
            <Handshake className="text-secondary w-5 h-5" />
          </div>
          <div className="text-2xl font-black font-mono text-on-primary-container">{stats.totalCompletedSales}</div>
          <p className="text-xs text-success font-bold">Muvaffaqiyatli bitimlar</p>
        </div>

        <div className="p-6 bg-surface-container-low border border-white/5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-primary-container uppercase tracking-wider">Platforma daromadi</span>
            <DollarSign className="text-success w-5 h-5" />
          </div>
          <div className="text-2xl font-black font-mono text-secondary">${stats.totalCommission.toLocaleString()}</div>
          <p className="text-xs text-success font-bold">Joriy oy: +${stats.monthlyCommission.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Oxirgi Nizolar */}
        <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-on-primary-container mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Gavel className="text-red-400 w-5 h-5" />
              Oxirgi 5 ta nizo
            </span>
            <button
              onClick={() => setActiveTab('disputes')}
              className="text-xs text-secondary hover:underline bg-transparent border-none cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-secondary-container rounded-lg px-2 py-1"
              aria-label="Barcha nizolarni ko'rish"
            >
              Barchasini ko'rish
            </button>
          </h3>
          <div className="space-y-4">
            {stats.lastDisputes?.length > 0 ? stats.lastDisputes.map((d: any) => (
              <div key={d.id} className="bg-surface-container-low p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-on-primary-container">{d.reason}</p>
                  <p className="text-xs text-on-primary-container">{d.buyer} • {formatDate(d.date)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.status === 'open' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-success-container/10 text-success border border-success/20'}`}>
                  {d.status === 'open' ? 'Ochiq' : 'Yopilgan'}
                </span>
              </div>
            )) : <p className="text-xs text-on-primary-container italic py-4">Nizolar mavjud emas</p>}
          </div>
        </div>

        {/* Oxirgi Shikoyatlar */}
        <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 shadow-2xl">
          <h3 className="text-lg font-bold text-on-primary-container mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Flag className="text-secondary w-5 h-5" />
              Oxirgi 5 ta shikoyat
            </span>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs text-secondary hover:underline bg-transparent border-none cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-secondary-container rounded-lg px-2 py-1"
              aria-label="Barcha shikoyatlarni ko'rish"
            >
              Barchasini ko'rish
            </button>
          </h3>
          <div className="space-y-4">
            {stats.lastReports?.length > 0 ? stats.lastReports.map((r: any) => (
              <div key={r.id} className="bg-surface-container-low p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-on-primary-container">{r.reason}</p>
                  <p className="text-xs text-on-primary-container">{r.targetType} • {formatDate(r.date)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.status === 'pending' ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-success-container/10 text-success border border-success/20'}`}>
                  {r.status === 'pending' ? 'Kutilmoqda' : 'Ko\'rildi'}
                </span>
              </div>
            )) : <p className="text-xs text-on-primary-container italic py-4">Shikoyatlar mavjud emas</p>}
          </div>
        </div>
      </div>

      <ProcessStatusCard />
      <TelegramBotStatsCard />
    </div>
  );
};
