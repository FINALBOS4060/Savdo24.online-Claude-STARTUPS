import React from 'react';
import { History } from 'lucide-react';

interface ProfileEarningsTabProps {
  earningsData: {
    totalEarnings: number;
    sales: any[];
  };
}

export const ProfileEarningsTab: React.FC<ProfileEarningsTabProps> = ({ earningsData }) => {
  return (
    <section className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6">
      <div className="mb-8 text-center md:text-left">
        <h3 className="text-sm font-bold text-on-primary-container uppercase tracking-wider mb-2">Jami daromad</h3>
        <p className="text-4xl font-extrabold text-on-primary-container">${earningsData.totalEarnings.toLocaleString()}</p>
      </div>

      <h3 className="text-lg font-bold text-on-primary-container border-b border-outline-variant/15 pb-4 mb-6 flex items-center gap-2">
        <History className="w-6 h-6 text-secondary-container" />
        Yakunlangan savdolar ro'yxati
      </h3>
      
      {earningsData.sales.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-outline-variant/20 rounded-2xl">
          <p className="text-on-primary-container font-medium">Hozircha daromadlar yo'q</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Sana</th>
                <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Loyiha nomi</th>
                <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Savdo summasi</th>
                <th className="py-4 px-4 text-xs font-bold text-on-primary-container uppercase">Sof daromad</th>
              </tr>
            </thead>
            <tbody>
              {earningsData.sales.map((sale: any) => (
                <tr key={sale.id} className="border-b border-outline-variant/5 hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4 text-sm text-on-primary-container">{new Date(sale.date).toLocaleDateString()}</td>
                  <td className="py-4 px-4 text-sm font-bold text-on-primary-container">{sale.projectName}</td>
                  <td className="py-4 px-4 text-sm text-on-primary-container">${sale.amount.toLocaleString()}</td>
                  <td className="py-4 px-4 text-sm font-bold text-emerald-400">+${sale.payout.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
