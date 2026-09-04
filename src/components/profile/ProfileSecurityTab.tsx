import React from 'react';
import { ShieldCheck, Smartphone, Monitor } from 'lucide-react';

interface ProfileSecurityTabProps {
  sessions: any[];
  revokeAllSessions: () => void;
  revokeSession: (id: number) => void;
}

export const ProfileSecurityTab: React.FC<ProfileSecurityTabProps> = ({
  sessions,
  revokeAllSessions,
  revokeSession,
}) => {
  return (
    <section className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-on-primary-container flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-secondary-container" />
          Faol sessiyalar
        </h3>
        {sessions.length > 1 && (
          <button
            onClick={revokeAllSessions}
            className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            Barcha sessiyalarni yakunlash
          </button>
        )}
      </div>

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <p className="text-center py-8 text-on-primary-container text-sm italic">Sessiyalar topilmadi.</p>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="bg-background border border-outline-variant/10 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-secondary-container">
                  {session.userAgent?.toLowerCase().includes('mobile')
                    ? <Smartphone className="w-6 h-6" />
                    : <Monitor className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-on-primary-container">
                    {session.userAgent || "Noma'lum qurilma"}
                  </p>
                  <p className="text-xs text-on-primary-container mt-0.5">
                    IP: {session.ip} • Oxirgi faollik: {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => revokeSession(session.id)}
                className="px-4 py-2 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                Sessiyani yakunlash
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
