import React, { useEffect, useState } from "react";
import { RefreshCw, Play } from "lucide-react";
import { apiFetch as fetch } from "../../lib/api";
import { LoadingState } from "../LoadingState";

type BotSetting = {
  key: string;
  value: string;
  masked?: string | null;
};

export const AdminBotTab: React.FC<{ onActionToast: (msg: string) => void; token?: string | null }> = ({ onActionToast, token }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, BotSetting>>({});
  const [posted, setPosted] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/bot", { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
      if (!res.ok) {
        onActionToast("Bot sozlamalarini yuklashda xatolik.");
        return;
      }
      const data = await res.json();
      const s: Record<string, BotSetting> = {};
      const nextEditing: Record<string, string> = {};
      for (const k of Object.keys(data.settings || {})) {
        const entry = data.settings[k];
        s[k] = { key: k, value: entry.value || "", masked: entry.masked || null };
        nextEditing[k] = entry.value || "";
      }
      setSettings(s);
      setEditing(nextEditing);
      setPosted(data.posted || []);
    } catch (err) {
      console.error(err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (key: string, value: string) => {
    setEditing((prev) => ({ ...prev, [key]: value }));
  };

  const saveKey = async (key: string) => {
    const value = editing[key];
    setIsSavingKey(key);
    try {
      const res = await fetch(`/api/admin/bot/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : undefined },
        body: JSON.stringify({ value })
      });
      if (!res.ok) {
        const err = await res.json();
        onActionToast(err.error || "Saqlash xatosi");
      } else {
        onActionToast("Saqlandi");
        await fetchData();
      }
    } catch (err) {
      console.error(err);
      onActionToast("Saqlashda tarmoq xatosi.");
    } finally {
      setIsSavingKey(null);
    }
  };

  const runNow = async () => {
    try {
      const res = await fetch("/api/admin/bot/run", {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : undefined }
      });
      if (!res.ok) {
        const err = await res.json();
        onActionToast(err.error || "Run so'rovida xatolik.");
      } else {
        const data = await res.json();
        onActionToast(`Run so‘rovi yuborildi: ${data.requestedAt || ""}`);
      }
    } catch (err) {
      console.error(err);
      onActionToast("Run so'rovida tarmoq xatosi.");
    }
  };

  if (isLoading) return <LoadingState variant="block" text="Bot sozlamalari yuklanmoqda..." />;

  return (
    <div className="space-y-6">
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Automatik Tech-News Bot sozlamalari</h2>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="px-3 py-1 rounded-xl bg-secondary-container/10 text-secondary-container flex items-center gap-2"
              title="Yangilash"
            >
              <RefreshCw className="w-4 h-4" />
              Yangilash
            </button>
            <button
              onClick={runNow}
              className="px-3 py-1 rounded-xl bg-accent-container text-on-accent-container flex items-center gap-2"
              title="Run now"
            >
              <Play className="w-4 h-4" />
              Run now
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.values(settings).map((s) => {
            const isSecret = ["TELEGRAM_BOT_TOKEN", "GOOGLE_AI_STUDIO_KEY"].includes(s.key);
            const displayValue = isSecret && (!editing[s.key] || editing[s.key] === s.masked) ? s.masked || "" : editing[s.key] ?? s.value;
            return (
              <div key={s.key} className="space-y-2">
                <label className="text-xs font-bold text-on-primary-container uppercase tracking-wider">{s.key}</label>
                <div className="flex gap-2">
                  <input
                    type={isSecret ? "password" : "text"}
                    value={displayValue}
                    onChange={(e) => handleChange(s.key, e.target.value)}
                    placeholder={isSecret ? "••••••••" : ""}
                    className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-white text-xs"
                  />
                  <button
                    onClick={() => saveKey(s.key)}
                    className="px-3 py-2 bg-secondary-container/10 rounded-xl text-secondary-container text-sm"
                    disabled={isSavingKey !== null}
                  >
                    Saqlash
                  </button>
                </div>
                {s.key === "RSS_URL" && (
                  <p className="text-xs text-on-primary-container/70">Hozirgi: {s.value || "—"}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold text-white mb-2">Yuborilgan yangiliklar (posted.json)</h3>
          <div className="max-h-48 overflow-auto bg-surface-container border border-white/5 rounded-lg p-3 text-xs text-gray-300">
            {posted.length === 0 ? <div className="text-sm">Hech narsa topilmadi.</div> : (
              <ul className="list-disc pl-4 space-y-1">
                {posted.map((u, i) => <li key={i}><a className="underline text-secondary-container" href={u} target="_blank" rel="noreferrer">{u}</a></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
