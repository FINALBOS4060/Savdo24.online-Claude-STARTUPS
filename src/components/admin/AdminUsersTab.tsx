import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Users, Search, X, Crown, UserCog, CheckCircle, AlertTriangle, KeyRound, Trash2, History, Ban } from 'lucide-react';
import { apiFetch as fetch } from '../../lib/api';
import { LoadingState } from '../LoadingState';
import { formatDate, formatDateTime } from '../../lib/formatDate';

interface AdminUsersTabProps {
  usersSearch: string;
  setUsersSearch: (val: string) => void;
  onActionToast: (message: string) => void;
  fetchAuditLogs: () => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  usersSearch,
  setUsersSearch,
  onActionToast,
  fetchAuditLogs
}) => {
  // Users management state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [totalAdminUsers, setTotalAdminUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isBanningId, setIsBanningId] = useState<number | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const usersSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestUsersRequestIdRef = useRef(0);

  const fetchAdminUsers = async (page = 1, search = '') => {
    const requestId = ++latestUsersRequestIdRef.current;
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        if (requestId !== latestUsersRequestIdRef.current) return;
        setAdminUsers(data.users || []);
        setTotalAdminUsers(data.total || 0);
        setUsersTotalPages(data.pages || 1);
        setUsersPage(page);
      }
    } catch (err) {
      console.error("Fetch admin users error:", err);
    } finally {
      if (requestId === latestUsersRequestIdRef.current) setIsLoadingUsers(false);
    }
  };

  // Fetch on mount or when usersSearch is updated from the outside (e.g. from Reports tab)
  useEffect(() => {
    fetchAdminUsers(1, usersSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersSearch]);

  const handleBanUser = async (userId: number, isBanned: boolean) => {
    setIsBanningId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isBanned })
      });
      if (res.ok) {
        onActionToast(isBanned ? "Foydalanuvchi bloklandi" : "Foydalanuvchi blokdan chiqarildi");
        fetchAdminUsers(usersPage, usersSearch);
        fetchAuditLogs();
        if (selectedUserDetail?.user?.id === userId) {
          fetchUserDetails(userId);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "Foydalanuvchi holatini o'zgartirib bo'lmadi.");
      }
    } catch (err) {
      onActionToast("Xatolik yuz berdi.");
    } finally {
      setIsBanningId(null);
    }
  };

  const fetchUserDetails = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUserDetail(data);
      }
    } catch (err) {
      console.error("Fetch user detail error:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateUserVip = async (id: number, isVip: boolean, days: number) => {
    setIsUpdatingUser(true);
    try {
      const expiresAt = isVip ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
      const res = await fetch(`/api/admin/users/${id}/vip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVip, vipExpiresAt: expiresAt })
      });
      if (res.ok) {
        fetchUserDetails(id);
        fetchAdminUsers(usersPage, usersSearch);
        onActionToast("VIP holati yangilandi.");
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "VIP holatini yangilab bo'lmadi.");
      }
    } catch (err) {
      console.error("Update VIP error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleUpdateUserRole = async (id: number, role: string) => {
    setIsUpdatingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        fetchUserDetails(id);
        fetchAdminUsers(usersPage, usersSearch);
        onActionToast("Rol muvaffaqiyatli yangilandi.");
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "Rolni yangilab bo'lmadi.");
      }
    } catch (err) {
      console.error("Update role error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    setIsUpdatingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedUserDetail(null);
        setShowDeleteConfirm(false);
        fetchAdminUsers(usersPage, usersSearch);
        onActionToast("Foydalanuvchi o'chirildi.");
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "Foydalanuvchini o'chirib bo'lmadi.");
      }
    } catch (err) {
      console.error("Delete user error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleSendResetLink = async (email: string) => {
    setIsUpdatingUser(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        onActionToast("Parolni tiklash havolasi yuborildi.");
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "Havolani yuborib bo'lmadi.");
      }
    } catch (err) {
      console.error("Send reset link error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/5">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-secondary-container"
          aria-label="Oldingi sahifa"
        >
          <ChevronLeft className="w-4 h-4 block" />
        </button>
        <span className="text-xs text-on-primary-container font-medium px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-secondary-container"
          aria-label="Keyingi sahifa"
        >
          <ChevronRight className="w-4 h-4 block" />
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-secondary" />
            Foydalanuvchilar ({totalAdminUsers})
          </h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-primary-container w-4 h-4" />
            <input
              type="text"
              placeholder="Qidirish (ism, email)..."
              value={usersSearch}
              onChange={(e) => {
                const val = e.target.value;
                setUsersSearch(val);
                if (usersSearchDebounceRef.current) clearTimeout(usersSearchDebounceRef.current);
                usersSearchDebounceRef.current = setTimeout(() => {
                  fetchAdminUsers(1, val);
                }, 500);
              }}
              className="w-full pl-9 pr-4 py-2 bg-surface-container border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-on-primary-container font-bold uppercase tracking-wider border-b border-white/5">
                <th className="py-3 px-4">Email / Ism</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Sana</th>
                <th className="py-3 px-4 text-center">Savdolar</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-on-primary-container">
                    <LoadingState variant="inline" text="Foydalanuvchilar yuklanmoqda..." />
                  </td>
                </tr>
              ) : adminUsers.map((u: any) => (
                <tr 
                  key={u.id} 
                  className="hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => fetchUserDetails(u.id)}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={u.avatarUrl || '/default-avatar.jpg'} 
                        className="w-8 h-8 rounded-full border border-white/10" 
                        alt={`${u.name || 'Foydalanuvchi'} profil avatari`}
                        loading="lazy"
                        width={32}
                        height={32}
                      />
                      <div>
                        <div className="font-bold text-white group-hover:text-secondary-container transition-colors flex items-center gap-1.5 text-xs">
                          {u.name}
                          {u.isVip && <span className="text-yellow-400 text-xs">👑</span>}
                        </div>
                        <div className="text-xs text-on-primary-container">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === 'Admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-on-primary-container text-xs">{u.joinDate}</td>
                  <td className="py-4 px-4 text-center text-white font-mono font-bold text-xs">{u.totalPayments}</td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBanUser(u.id, !u.isBanned);
                      }}
                      disabled={isBanningId === u.id}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container ${
                        u.isBanned 
                          ? 'bg-success-container/10 text-success border border-success/20 hover:bg-success-container/20' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                      }`}
                    >
                      {u.isBanned ? "Blokdan ochish" : "Bloklash"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderPagination(usersPage, usersTotalPages, (page) => fetchAdminUsers(page, usersSearch))}
      </div>

      {/* Admin User Detail Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-10 rounded-2xl border border-white/5 shadow-2xl relative custom-scrollbar">
            <button 
              onClick={() => setSelectedUserDetail(null)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-secondary-container"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Card */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-surface-container-low border border-white/5 rounded-2xl p-6 text-center space-y-4">
                  <div className="relative inline-block">
                    <img 
                      src={selectedUserDetail.user.avatarUrl || '/default-avatar.jpg'} 
                      className="w-24 h-24 rounded-full border-4 border-secondary-container/20 mx-auto object-cover" 
                      alt={`${selectedUserDetail.user.name || 'Foydalanuvchi'} batafsil profil avatari`} 
                      loading="lazy"
                      width={96}
                      height={96}
                    />
                    {selectedUserDetail.user.isVip && (
                      <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black border-4 border-background">
                        <Crown className="w-4 h-4 fill-current" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{selectedUserDetail.user.name}</h3>
                    <p className="text-xs text-on-primary-container">{selectedUserDetail.user.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      selectedUserDetail.user.role === 'Admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {selectedUserDetail.user.role}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      selectedUserDetail.user.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-success-container/20 text-success'
                    }`}>
                      {selectedUserDetail.user.isBanned ? "Bloklangan" : "Faol"}
                    </span>
                  </div>
                  <p className="text-xs text-on-primary-container font-medium pt-2">
                    A'zo bo'lgan sana: <br/> {formatDate(selectedUserDetail.user.joinDate, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="bg-secondary-container/5 border border-secondary-container/10 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">Statistika</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-on-primary-container font-bold uppercase tracking-wider">E'lonlar</p>
                      <p className="text-xl font-black text-white">{selectedUserDetail.user.totalStartups}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-on-primary-container font-bold uppercase tracking-wider">Xaridlar</p>
                      <p className="text-xl font-black text-white">{selectedUserDetail.user.totalPurchases}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-on-primary-container font-bold uppercase tracking-wider">Sotilgan</p>
                      <p className="text-xl font-black text-secondary-container">${selectedUserDetail.user.totalSoldAmount}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-on-primary-container font-bold uppercase tracking-wider">Reyting</p>
                      <p className="text-xl font-black text-white flex items-center gap-1">
                        ⭐ 
                        {selectedUserDetail.user.averageRating ? (
                          selectedUserDetail.user.averageRating.toFixed(1)
                        ) : (
                          "0.0"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Tabs & Logs */}
              <div className="lg:col-span-2 space-y-8">
                {/* VIP Status Settings */}
                <div className="bg-background border border-white/5 rounded-2xl p-6 md:p-8 space-y-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    VIP A'zolik Sozlamalari
                  </h4>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
                    <div>
                      {selectedUserDetail.user.isVip ? (
                        <div className="space-y-1">
                          <p className="text-xs text-white font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                            VIP faol (tugash: {formatDate(selectedUserDetail.user.vipExpiresAt)})
                          </p>
                          <button
                            onClick={() => handleUpdateUserVip(selectedUserDetail.user.id, false, 0)}
                            disabled={isUpdatingUser}
                            className="text-xs text-red-400 font-bold hover:underline bg-transparent border-none cursor-pointer p-0 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            VIP maqomini bekor qilish
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-on-primary-container italic">Foydalanuvchi hozirda VIP a'zo emas.</p>
                      )}
                    </div>
                    {!selectedUserDetail.user.isVip && (
                      <div className="flex flex-wrap gap-2">
                        {[7, 30, 90, 365].map((days) => (
                          <button
                            key={days}
                            onClick={() => handleUpdateUserVip(selectedUserDetail.user.id, true, days)}
                            disabled={isUpdatingUser}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-secondary-container"
                          >
                            +{days} kun VIP
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Role and Danger Zone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Rol o'zgartirish */}
                  <div className="bg-background border border-white/5 rounded-2xl p-6 md:p-8 space-y-4">
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-blue-400" />
                      Tizimdagi Roli
                    </h4>
                    <div className="flex flex-col gap-2 pt-2">
                      {['Xaridor', 'Sotuvchi', 'Admin'].map((role) => (
                        <button
                          key={role}
                          onClick={() => handleUpdateUserRole(selectedUserDetail.user.id, role)}
                          disabled={isUpdatingUser || selectedUserDetail.user.role === role}
                          className={`w-full px-4 py-2.5 rounded-xl font-bold text-xs flex justify-between items-center transition-all disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container ${
                            selectedUserDetail.user.role === role 
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                              : 'bg-white/5 text-white border border-white/5 hover:bg-white/10'
                          }`}
                        >
                          <span>{role}</span>
                          {selectedUserDetail.user.role === role && (
                            <CheckCircle className="w-4 h-4 text-blue-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Xavfli hudud */}
                  <div className="bg-background border border-red-500/10 rounded-2xl p-6 md:p-8 space-y-4">
                    <h4 className="text-sm font-black text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Xavfli Hudud
                    </h4>
                    <div className="space-y-3 pt-2">
                      <button
                        onClick={() => handleSendResetLink(selectedUserDetail.user.email)}
                        disabled={isUpdatingUser}
                        className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        <KeyRound className="w-4 h-4" />
                        Parolni tiklash havolasi
                      </button>
                      
                      <button
                        onClick={() => handleBanUser(selectedUserDetail.user.id, !selectedUserDetail.user.isBanned)}
                        disabled={isUpdatingUser || isBanningId === selectedUserDetail.user.id}
                        className={`w-full px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-secondary-container ${
                          selectedUserDetail.user.isBanned 
                            ? 'bg-success-container/10 hover:bg-success-container/20 text-success border border-success/20' 
                            : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {selectedUserDetail.user.isBanned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        {selectedUserDetail.user.isBanned ? "Blokdan ochish" : "Foydalanuvchini bloklash"}
                      </button>

                      {showDeleteConfirm ? (
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl space-y-3">
                          <p className="text-xs text-red-400 font-bold text-center leading-relaxed">
                            Diqqat! Ushbu foydalanuvchi bilan bog'liq barcha e'lonlar, xaridlar va ma'lumotlar butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi!
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDeleteUser(selectedUserDetail.user.id)}
                              disabled={isUpdatingUser}
                              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              Ha, o'chirilsin
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(false)}
                              disabled={isUpdatingUser}
                              className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                              Bekor qilish
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isUpdatingUser}
                          className="w-full px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-600/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                          Hisobni butunlay o'chirish
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Logs */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-secondary-container" />
                    Oxirgi AuditLog yozuvlari
                  </h4>
                  <div className="bg-background border border-white/5 rounded-2xl overflow-hidden">
                    {selectedUserDetail.auditLogs.length === 0 ? (
                      <p className="p-8 text-center text-on-primary-container text-xs italic">Audit yozuvlari topilmadi.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {selectedUserDetail.auditLogs.map((log: any) => (
                          <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-black text-secondary-container uppercase tracking-widest">{log.action}</span>
                              <span className="text-xs text-on-primary-container font-mono">{formatDateTime(log.createdAt)}</span>
                            </div>
                            <p className="text-xs text-white font-medium leading-relaxed mb-1">{log.details}</p>
                            <p className="text-xs text-on-primary-container">Admin: <span className="text-white font-bold">{log.admin?.name || "Tizim"}</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
