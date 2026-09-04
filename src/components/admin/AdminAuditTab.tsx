import React from 'react';
import { History } from 'lucide-react';
import { LoadingState } from '../LoadingState';
import { formatDateTime } from '../../lib/formatDate';

interface AdminAuditTabProps {
  auditLogs: any[];
  isLoadingAudit: boolean;
  auditLogsPage: number;
  auditLogsTotalPages: number;
  fetchAuditLogs: (page?: number) => void;
  renderPagination: (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => React.ReactNode;
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({
  auditLogs,
  isLoadingAudit,
  auditLogsPage,
  auditLogsTotalPages,
  fetchAuditLogs,
  renderPagination,
}) => {
  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4">
        <History className="text-secondary w-5 h-5" />
        Tizim faoliyat tarixi ({auditLogs.length})
      </h2>

      {isLoadingAudit ? (
        <LoadingState variant="block" text="Yuklanmoqda..." />
      ) : auditLogs.length === 0 ? (
        <div className="py-12 text-center text-on-primary-container space-y-2">
          <History className="w-10 h-10 mx-auto opacity-40 text-on-primary-container" />
          <p className="text-sm font-bold">Faoliyat tarixi bo'sh</p>
          <p className="text-xs">Hozircha adminlar tomonidan hech qanday amal bajarilmagan.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-xs text-left">
            <thead>
              <tr className="text-on-primary-container font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4">Sana</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Amal</th>
                <th className="py-3 px-4">Nishon ID</th>
                <th className="py-3 px-4">Batafsil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-on-primary-container">
                    {log.admin?.name || `Admin (ID: ${log.adminId})`}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${
                      log.action.toUpperCase().includes('APPROVE') || log.action.toUpperCase().includes('RESOLVE')
                        ? 'bg-success-container/10 text-success border-success/20'
                        : log.action.toUpperCase().includes('REJECT') || log.action.toUpperCase().includes('DELETE')
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{log.targetId || '-'}</td>
                  <td className="py-3.5 px-4 italic max-w-xs truncate" title={log.details}>
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination(auditLogsPage, auditLogsTotalPages, fetchAuditLogs)}
        </div>
      )}
    </div>
  );
};
