import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Startup, UserProfileData, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { AdminB2BTab } from './admin/AdminB2BTab';

interface AdminPageProps {
  user: UserProfileData;
  startups: Startup[];
  fetchStartups: () => void;
  onActionToast: (message: string) => void;
  setView: (view: string) => void;
  categories: Category[];
  fetchCategories: () => void;
}

export default function AdminPage({
  user,
  startups,
  fetchStartups,
  onActionToast,
  setView,
  categories,
  fetchCategories,
}: AdminPageProps) {
  const [pendingStartups, setPendingStartups] = useState<Startup[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // MUHIM: Admin panelidagi "E'lonlar" bo'limi avval FAQAT moderatsiya
  // kutayotgan ("pending") e'lonlarni ko'rsatardi — allaqachon FAOL
  // (active) status bilan bazaga kiritilgan e'lonlarni (masalan, avvalgi
  // bosqichda topilgan soxta demo e'lonlar) ko'rish yoki o'chirish uchun
  // panelda UMUMAN hech qanday joy yo'q edi. Shu sabab ular hech qachon
  // o'chirilmasdi — admin ularni panelda topa olmasdi. Endi "Barcha
  // e'lonlar" rejimi qo'shildi, u orqali istalgan holatdagi (faol,
  // sotilgan va h.k.) e'lonni qidirib, to'g'ridan-to'g'ri o'chirish mumkin.
  const [listingsView, setListingsView] = useState<'pending' | 'all'>('pending');
  const [listingsSearch, setListingsSearch] = useState('');
  const [isDeletingStartupId, setIsDeletingStartupId] = useState<string | null>(null);

  // 88-band: "Barcha e'lonlar" ilgari App.tsx'ning umumiy `startups`
  // prop'idan (standart limit=50, max=100) ko'rsatilardi — 100+ e'lon
  // bo'lsa, admin qolganlarini hech qachon ko'ra/qidira/o'chira olmasdi,
  // haqiqiy sahifalash yo'q edi. Endi bu bo'lim server.ts'ning mavjud
  // page/limit/search'ini o'z holicha (alohida) so'raydi, xuddi
  // foydalanuvchilar ro'yxati kabi.
  const [allListings, setAllListings] = useState<Startup[]>([]);
  const [totalAllListings, setTotalAllListings] = useState(0);
  const [allListingsPage, setAllListingsPage] = useState(1);
  const [allListingsTotalPages, setAllListingsTotalPages] = useState(1);
  const [isLoadingAllListings, setIsLoadingAllListings] = useState(false);
  const listingsSearchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAllListingsRequestIdRef = React.useRef(0);

  const fetchAllListingsAdmin = async (page = 1, search = '') => {
    const requestId = ++latestAllListingsRequestIdRef.current;
    setIsLoadingAllListings(true);
    try {
      const res = await fetch(`/api/startups?page=${page}&limit=50&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        if (requestId !== latestAllListingsRequestIdRef.current) return;
        setAllListings(data.startups || []);
        setTotalAllListings(data.totalCount || 0);
        setAllListingsTotalPages(data.totalPages || 1);
        setAllListingsPage(page);
      }
    } catch (err) {
      console.error("Fetch all listings error:", err);
    } finally {
      if (requestId === latestAllListingsRequestIdRef.current) setIsLoadingAllListings(false);
    }
  };

  useEffect(() => {
    if (listingsView === 'all' && isAdmin) {
      fetchAllListingsAdmin(1, listingsSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingsView]);

  // Statistics and Disputes state
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingDisputes, setIsLoadingDisputes] = useState(true);
  const [updatingDisputeId, setUpdatingDisputeId] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [escrowDisputes, setEscrowDisputes] = useState<any[]>([]);
  const [isLoadingEscrowDisputes, setIsLoadingEscrowDisputes] = useState(true);
  const [updatingEscrowDisputeId, setUpdatingEscrowDisputeId] = useState<string | null>(null);
  const [escrowAdminNotes, setEscrowAdminNotes] = useState<Record<string, string>>({});

  // Reports (Shikoyatlar) state
  
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);

  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  // 85-band: Shikoyatlar (reports) va Murojaatlar (support tickets)
  // amal tugmalarida boshqa bo'limlar (disputes/escrow/users)dagi kabi
  // loading/disabled himoyasi yo'q edi — tez-tez bosilsa bir xil amal
  // bir necha marta yuborilishi mumkin edi.
  const [updatingReportId, setUpdatingReportId] = useState<number | null>(null);
  const [isDeletingReportedItem, setIsDeletingReportedItem] = useState<number | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<number | null>(null);

  // Sponsor channels state
  const [sponsorChannels, setSponsorChannels] = useState<any[]>([]);
  const [isLoadingSponsors, setIsLoadingSponsors] = useState(true);
  const [newSponsor, setNewSponsor] = useState({
    channelId: '',
    channelUsername: '',
    displayName: '',
    advertiserContact: '',
    pricePerMonth: '',
    startDate: '',
    endDate: ''
  });
  const [isAddingSponsor, setIsAddingSponsor] = useState(false);

  // Active view tab state & Audit Logs state
  const ADMIN_TABS = ['dashboard', 'analytics', 'listings', 'users', 'categories', 'disputes', 'reports', 'sponsors', 'audit', 'settings', 'support', 'refunds', 'b2b'] as const;
  type AdminTab = typeof ADMIN_TABS[number];
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [escrowRefunds, setEscrowRefunds] = useState<any[]>([]);
  const [isLoadingEscrowRefunds, setIsLoadingEscrowRefunds] = useState(false);
  const location = useLocation();
  // 93-band: bildirishnomalardagi "/admin?tab=disputes" kabi havolalar avval
  // hech qanday tabga o'tkazmasdi (AdminPage URL query'ni o'qimasdi) —
  // ProfilePage'dagi profileTab mexanizmiga o'xshash, lekin bu yerda alohida
  // App.tsx state kerak emas, to'g'ridan-to'g'ri URL'dan o'qiladi.
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && (ADMIN_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab as AdminTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);

  // Categories management state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ id: '', name: '', icon: '' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Users management state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [totalAdminUsers, setTotalAdminUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const usersSearchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isBanningId, setIsBanningId] = useState<number | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pagination states for disputes, reports, and audit logs
  const [disputesPage, setDisputesPage] = useState(1);
  const [disputesTotalPages, setDisputesTotalPages] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsTotalPages, setReportsTotalPages] = useState(1);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [auditLogsTotalPages, setAuditLogsTotalPages] = useState(1);

  // Settings tab states
  const [settings, setSettings] = useState<any[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsValues, setSettingsValues] = useState<{[key: string]: string}>({});
  const [visibleSecrets, setVisibleSecrets] = useState<{[key: string]: boolean}>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<{[key: string]: string}>({});

  // 46-MUAMMO: "Kutilayotganlar" navbati App.tsx'ning umumiy `startups`
  // ro'yxatidan (standart limit=50, isTop/id bo'yicha eng yangilari)
  // filtrlanardi — agar saytda 50 tadan ko'p e'lon bo'lsa (statusidan
  // qat'i nazar), eski kutilayotgan arizalar bu ro'yxatga UMUMAN
  // kirmasdi va admin ularni hech qachon ko'rmasdi/tasdiqlamasdi. Endi
  // Admin sahifasi "pending" statusini to'g'ridan-to'g'ri, alohida va
  // katta limit bilan so'raydi.
  const fetchPendingStartups = async () => {
    setIsLoadingPending(true);
    try {
      const res = await fetch('/api/startups?status=pending&limit=100');
      if (res.ok) {
        const data = await res.json();
        setPendingStartups(data.startups || []);
      }
    } catch (err) {
      console.error("Fetch pending startups error:", err);
    } finally {
      setIsLoadingPending(false);
    }
  };

  useEffect(() => {
    fetchPendingStartups();
  }, []);

  // Authorization check
  const isAdmin = user && user.role === 'Admin';

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Fetch stats error:", err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchDisputes = async (page = 1) => {
    try {
      setIsLoadingDisputes(true);
      const res = await fetch(`/api/disputes?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.data) {
          setDisputes(data.data);
          setDisputesTotalPages(data.totalPages || 1);
          setDisputesPage(data.page || 1);
        } else {
          setDisputes(data);
        }
      }
    } catch (err) {
      console.error("Fetch disputes error:", err);
    } finally {
      setIsLoadingDisputes(false);
    }
  };

  // Escrow (kafolatlangan to'lov) nizolari — /api/admin/escrow-disputes
  // endpointi mavjud edi, lekin uni chaqiradigan UI umuman yo'q edi.
  const fetchEscrowDisputes = async () => {
    try {
      setIsLoadingEscrowDisputes(true);
      const res = await fetch('/api/admin/escrow-disputes');
      if (res.ok) {
        const data = await res.json();
        setEscrowDisputes(data);
      }
    } catch (err) {
      console.error("Fetch escrow disputes error:", err);
    } finally {
      setIsLoadingEscrowDisputes(false);
    }
  };

  const fetchEscrowRefunds = async () => {
    try {
      setIsLoadingEscrowRefunds(true);
      const res = await fetch('/api/admin/escrow-refunds');
      if (res.ok) {
        const data = await res.json();
        setEscrowRefunds(data);
      }
    } catch (err) {
      console.error("Fetch escrow refunds error:", err);
    } finally {
      setIsLoadingEscrowRefunds(false);
    }
  };

  const handleCompleteRefund = async (paymentId: string) => {
    if (!confirm("Haqiqatan ham CoinGate orqali pul qaytarilganini tasdiqlaysizmi?")) return;
    try {
      const res = await fetch(`/api/admin/escrow-refunds/${paymentId}/complete`, {
        method: "POST"
      });
      if (res.ok) {
        onActionToast("Pul qaytarish muvaffaqiyatli yakunlandi deb belgilandi.");
        fetchEscrowRefunds();
        fetchAuditLogs();
      } else {
        const errData = await res.json();
        onActionToast(errData.error || "Xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("Complete refund error:", err);
      onActionToast("Tarmoq xatoligi.");
    }
  };

  const fetchReports = async (page = 1) => {
    try {
      setIsLoadingReports(true);
      const res = await fetch(`/api/reports?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.data) {
          setReports(data.data);
          setReportsTotalPages(data.totalPages || 1);
          setReportsPage(data.page || 1);
        } else {
          setReports(data);
        }
      }
    } catch (err) {
      console.error("Fetch reports error:", err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchAuditLogs = async (page = 1) => {
    try {
      setIsLoadingAudit(true);
      const res = await fetch(`/api/admin/audit-logs?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.data) {
          setAuditLogs(data.data);
          setAuditLogsTotalPages(data.totalPages || 1);
          setAuditLogsPage(data.page || 1);
        } else {
          setAuditLogs(data);
        }
      }
    } catch (err) {
      console.error("Fetch audit logs error:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-6 border-t border-white/5">
        <button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-sm block">chevron_left</span>
        </button>
        <span className="text-xs text-on-primary-container font-medium px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-sm block">chevron_right</span>
        </button>
      </div>
    );
  };

  const fetchSponsorChannels = async () => {
    try {
      const res = await fetch('/api/admin/sponsor-channels');
      if (res.ok) {
        const data = await res.json();
        setSponsorChannels(data);
      }
    } catch (err) {
      console.error("Fetch sponsor channels error:", err);
    } finally {
      setIsLoadingSponsors(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        const vals: {[key: string]: string} = {};
        data.forEach((s: any) => {
          vals[s.key] = s.isSecret ? '' : (s.value || '');
        });
        setSettingsValues(vals);
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSaveSetting = async (key: string) => {
    const val = settingsValues[key] || '';
    const existing = settings.find(s => s.key === key);
    if (!val && existing?.hasValue && existing?.isSecret) {
      setSettingsStatus(prev => ({ ...prev, [key]: 'error' }));
      onActionToast("Avval yangi qiymat kiriting — bo'sh maydon saqlanmadi (mavjud qiymat o'zgarishsiz qoldi).");
      setTimeout(() => {
        setSettingsStatus(prev => ({ ...prev, [key]: '' }));
      }, 3000);
      return;
    }
    setSavingKey(key);
    setSettingsStatus(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: val })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value: data.value, hasValue: !!val } : s));
        if (existing?.isSecret) {
          setSettingsValues(prev => ({ ...prev, [key]: '' }));
        }
        setSettingsStatus(prev => ({ ...prev, [key]: 'success' }));
        fetchAuditLogs();
        setTimeout(() => {
          setSettingsStatus(prev => ({ ...prev, [key]: '' }));
        }, 3000);
      } else {
        setSettingsStatus(prev => ({ ...prev, [key]: 'error' }));
      }
    } catch (err) {
      console.error("Save setting error:", err);
      setSettingsStatus(prev => ({ ...prev, [key]: 'error' }));
    } finally {
      setSavingKey(null);
    }
  };

  // 66-band: usersSearch har bir harf kiritilganda to'g'ridan-to'g'ri
  // fetchAdminUsers'ni chaqirardi (debounce yo'q) — bu ham ortiqcha so'rovlar,
  // ham BrowsePage'dagi kabi poyga sharoiti (eski javob yangisini bosib
  // ketishi) xavfini keltirib chiqarardi. Shu sabab bu yerda ham eng so'nggi
  // so'rov himoyasi qo'shildi, qidiruv esa pastda debounce bilan chaqiriladi.
  const latestUsersRequestIdRef = React.useRef(0);

  const fetchAdminUsers = async (page = 1, search = '') => {
    const requestId = ++latestUsersRequestIdRef.current;
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        if (requestId !== latestUsersRequestIdRef.current) return;
        setAdminUsers(data.users);
        setTotalAdminUsers(data.total);
        setUsersTotalPages(data.pages || 1);
        setUsersPage(page);
      }
    } catch (err) {
      console.error("Fetch admin users error:", err);
    } finally {
      if (requestId === latestUsersRequestIdRef.current) setIsLoadingUsers(false);
    }
  };

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
        // MUHIM: agar amal aynan "Batafsil" modali ichidan bajarilgan bo'lsa,
        // modal o'zining ma'lumotini avtomatik yangilamasdi (VIP/rol funksiyalari
        // fetchUserDetails'ni chaqiradi, lekin bu funksiya chaqirmasdi) — natijada
        // admin blokdan keyin ham modalda eski (bloklanmagan) holatni ko'rardi.
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

  const fetchSupportTickets = async () => {
    setIsLoadingSupport(true);
    try {
      const res = await fetch('/api/admin/support-tickets');
      if (res.ok) {
        const data = await res.json();
        setSupportTickets(data);
      }
    } catch (err) {
      console.error("Fetch support tickets error:", err);
    } finally {
      setIsLoadingSupport(false);
    }
  };

  const fetchAnalytics = async (period: string) => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Fetch analytics error:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
      fetchDisputes();
      fetchEscrowDisputes();
      fetchEscrowRefunds();
      fetchReports();
      fetchAuditLogs();
      fetchSettings();
      fetchSponsorChannels();
      fetchAdminUsers(1, '');
      fetchAnalytics(analyticsPeriod);
      fetchSupportTickets();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics(analyticsPeriod);
    }
    if (activeTab === 'refunds') {
      fetchEscrowRefunds();
    }
  }, [activeTab, analyticsPeriod]);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setIsSavingCategory(true);
    try {
      const res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingCategory.name,
          icon: editingCategory.icon
        })
      });
      if (res.ok) {
        onActionToast("Kategoriya yangilandi.");
        setEditingCategory(null);
        fetchCategories();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Kategoriyani saqlashda xatolik yuz berdi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.id || !newCategory.name) {
      onActionToast("ID va Nom majburiy.");
      return;
    }
    setIsSavingCategory(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCategory)
      });
      if (res.ok) {
        onActionToast("Yangi kategoriya qo'shildi.");
        setIsAddingCategory(false);
        setNewCategory({ id: '', name: '', icon: '' });
        fetchCategories();
      } else {
        const data = await res.json();
        onActionToast(data.error || "Kategoriya qo'shishda xatolik.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Kategoriyani o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onActionToast("Kategoriya o'chirildi.");
        fetchCategories();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Kategoriyani o'chirishda xatolik yuz berdi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi yuz berdi.");
    }
  };
  const handleSponsorAction = async (id: number, action: 'toggle' | 'delete', currentIsActive?: boolean) => {
    try {
      const res = await fetch(`/api/admin/sponsor-channels/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: action === 'toggle' ? JSON.stringify({ isActive: !currentIsActive }) : undefined
      });

      if (res.ok) {
        onActionToast(action === 'delete' ? "Sponsor kanal o'chirildi" : "Kanal holati yangilandi");
        fetchSponsorChannels();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Amalni bajarib bo'lmadi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    }
  };

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingSponsor(true);
    try {
      const res = await fetch('/api/admin/sponsor-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSponsor)
      });

      if (res.ok) {
        onActionToast("Yangi sponsor kanal qo'shildi!");
        setNewSponsor({
          channelId: '',
          channelUsername: '',
          displayName: '',
          advertiserContact: '',
          pricePerMonth: '',
          startDate: '',
          endDate: ''
        });
        fetchSponsorChannels();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Kanalni qo'shib bo'lmadi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    } finally {
      setIsAddingSponsor(false);
    }
  };

  const handleReportStatusChange = async (id: number, status: 'reviewed' | 'dismissed') => {
    setUpdatingReportId(id);
    try {
      const res = await fetch(`/api/reports/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        onActionToast(`Shikoyat statusi o'zgartirildi: ${status === 'reviewed' ? "Ko'rib chiqildi" : "Rad etildi"}`);
        fetchReports();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Shikoyatni yangilab bo'lmadi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    } finally {
      setUpdatingReportId(null);
    }
  };

  const handleDeleteReportedItem = async (reportId: number, targetType: string, targetId: string) => {
    // 97-band: 'user' nishon turi endi DetailPage'dan haqiqiy shikoyat sifatida
    // kelishi mumkin — bu funksiya avval faqat 'startup'/boshqa (idea deb
    // faraz qilingan) uchun yozilgan edi, 'user' kelsa targetId (foydalanuvchi
    // ID) tasodifan mos keladigan boshqa bir g'oyani (Idea) o'chirib
    // yuborishi mumkin edi. Endi 'user' uchun o'chirish tugmasi umuman
    // chaqirilmaydi (pastdagi render qismida bloklangan), shu yerda ham
    // ehtiyot chorasi sifatida qaytariladi.
    if (targetType === 'user') return;
    if (!window.confirm(`Haqiqatan ham ushbu ${targetType === 'startup' ? "startap e'lonini" : "izoh/g'oyani"} butunlay o'chirmoqchimisiz? Bu amal qaytarilmas!`)) {
      return;
    }
    setIsDeletingReportedItem(reportId);
    try {
      const endpoint = targetType === 'startup' 
        ? `/api/admin/startups/${targetId}` 
        : `/api/admin/ideas/${targetId}`;

      const res = await fetch(endpoint, {
        method: 'DELETE'
      });

      if (res.ok) {
        onActionToast("O'chirish muvaffaqiyatli amalga oshirildi!");
        // Auto mark report as reviewed
        await handleReportStatusChange(reportId, 'reviewed');
        fetchReports();
        fetchStartups(); // Refresh main list
        fetchPendingStartups();
      } else {
        const err = await res.json();
        onActionToast(err.error || "O'chirishda xatolik yuz berdi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    } finally {
      setIsDeletingReportedItem(null);
    }
  };

  const handleDisputeUpdate = async (id: number, status: 'resolved' | 'rejected') => {
    setUpdatingDisputeId(id);
    try {
      const res = await fetch(`/api/disputes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          adminNote: adminNotes[id] || ""
        })
      });

      if (res.ok) {
        onActionToast(`Nizo muvaffaqiyatli ${status === 'resolved' ? "yopildi" : "rad etildi"}!`);
        fetchDisputes();
        fetchAdminStats();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Nizoni yangilab bo'lmadi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    } finally {
      setUpdatingDisputeId(null);
    }
  };

  const handleEscrowDisputeUpdate = async (id: string, resolution: 'released' | 'refunded') => {
    setUpdatingEscrowDisputeId(id);
    try {
      const res = await fetch(`/api/admin/escrow-disputes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resolution,
          adminNote: escrowAdminNotes[id] || ""
        })
      });

      if (res.ok) {
        onActionToast(`Escrow nizosi muvaffaqiyatli ${resolution === 'released' ? "ozod qilindi" : "qaytarildi"}!`);
        fetchEscrowDisputes();
        fetchAdminStats();
      } else {
        const err = await res.json();
        onActionToast(err.error || "Escrow nizosini yangilab bo'lmadi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    } finally {
      setUpdatingEscrowDisputeId(null);
    }
  };

  const handleDeleteStartup = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" e'lonini BUTUNLAY o'chirmoqchimisiz? Bu amal qaytarilmas — unga bog'liq barcha to'lov, g'oya, sharh va suhbat ma'lumotlari ham o'chib ketadi.`)) {
      return;
    }
    setIsDeletingStartupId(id);
    try {
      const res = await fetch(`/api/admin/startups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onActionToast(`"${name}" muvaffaqiyatli o'chirildi.`);
        fetchStartups();
        fetchPendingStartups();
        fetchAdminStats();
        if (listingsView === 'all') fetchAllListingsAdmin(allListingsPage, listingsSearch);
      } else {
        const err = await res.json().catch(() => ({}));
        onActionToast(err.error || "E'lonni o'chirib bo'lmadi.");
      }
    } catch (err) {
      console.error("Delete startup error:", err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsDeletingStartupId(null);
    }
  };


  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-red-500/10 border border-red-500/30 rounded-3xl text-center space-y-4 animate-fade-in text-left">
        <span className="material-symbols-outlined text-red-500 text-5xl">gpp_bad</span>
        <h2 className="text-xl font-black text-white">Kirish taqiqlangan</h2>
        <p className="text-sm text-on-primary-container leading-relaxed">
          Kechirasiz, ushbu sahifaga kirish faqat adminlar uchun ruxsat etilgan. Tizimga admin hisobi orqali kiring.
        </p>
        <button
          onClick={() => setView('browse')}
          className="px-6 py-2.5 bg-secondary-container hover:brightness-110 text-on-secondary-fixed font-bold text-xs rounded-xl transition-all"
        >
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  const handleStatusChange = async (id: string, newStatus: 'active' | 'rejected') => {
    setIsUpdating(id);
    try {
      const res = await fetch(`/api/startups/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        onActionToast(`Startap muvaffaqiyatli ${newStatus === 'active' ? 'tasdiqlandi' : 'rad etildi'}.`);
        fetchStartups(); // Refresh the main startup array
        fetchPendingStartups(); // Kutilayotganlar navbati endi alohida so'raladi — uni ham yangilash kerak
      } else {
        const err = await res.json();
        onActionToast(err.error || "Statusni yangilab bo'lmadi.");
      }
    } catch (err) {
      console.error(err);
      onActionToast("Tarmoq xatosi yuz berdi.");
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f0b90b] text-3xl">admin_panel_settings</span>
          Admin boshqaruv paneli
        </h1>
        <p className="text-xs md:text-sm text-on-primary-container leading-relaxed">
          Platformada chop etish uchun yuborilgan startaplar arizalarini tasdiqlash, sotuvlar statistikasini ko'rish va nizolarni hal qilish.
        </p>
      </div>

      {/* System Status Warnings */}
      {stats?.systemStatus?.envWarnings?.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl animate-pulse">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500">warning</span>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-400">Tizim xavfsizligi va sozlamalari bo'yicha ogohlantirishlar:</h4>
              <ul className="list-disc list-inside text-xs text-red-300/80">
                {stats.systemStatus.envWarnings.map((warning: string, i: number) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Platform Statistics */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-primary-container uppercase">Foydalanuvchilar</span>
                <span className="material-symbols-outlined text-blue-400">group</span>
              </div>
              <div className="text-2xl font-black font-mono text-white">{stats.totalUsers}</div>
              <p className="text-[10px] text-[#8892b0]">Jami ro'yxatdan o'tganlar</p>
            </div>

            <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-primary-container uppercase">Faol e'lonlar</span>
                <span className="material-symbols-outlined text-green-400">rocket_launch</span>
              </div>
              <div className="text-2xl font-black font-mono text-white">{stats.totalActiveStartups}</div>
              <p className="text-[10px] text-[#8892b0]">Hozirda sotuvdagilar</p>
            </div>

            <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-primary-container uppercase">Yakunlangan savdolar</span>
                <span className="material-symbols-outlined text-[#f3ba2f]">handshake</span>
              </div>
              <div className="text-2xl font-black font-mono text-white">{stats.totalCompletedSales}</div>
              <p className="text-[10px] text-green-500 font-bold">Muvaffaqiyatli bitimlar</p>
            </div>

            <div className="p-6 bg-[#0e1726]/80 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-primary-container uppercase">Platforma daromadi</span>
                <span className="material-symbols-outlined text-emerald-400">toll</span>
              </div>
              <div className="text-2xl font-black font-mono text-[#f3ba2f]">${stats.totalCommission.toLocaleString()}</div>
              <p className="text-[10px] text-emerald-500 font-bold">Joriy oy: +${stats.monthlyCommission.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Oxirgi Nizolar */}
            <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-400">gavel</span>
                  Oxirgi 5 ta nizo
                </span>
                <button onClick={() => setActiveTab('disputes')} className="text-xs text-[#f0b90b] hover:underline bg-transparent border-none cursor-pointer font-bold">Barchasini ko'rish</button>
              </h3>
              <div className="space-y-4">
                {stats.lastDisputes?.length > 0 ? stats.lastDisputes.map((d: any) => (
                  <div key={d.id} className="bg-[#0b1426] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-white">{d.reason}</p>
                      <p className="text-[10px] text-on-primary-container">{d.buyer} • {new Date(d.date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${d.status === 'open' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {d.status === 'open' ? 'Ochiq' : 'Yopilgan'}
                    </span>
                  </div>
                )) : <p className="text-xs text-on-primary-container italic py-4">Nizolar mavjud emas</p>}
              </div>
            </div>

            {/* Oxirgi Shikoyatlar */}
            <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-500">flag</span>
                  Oxirgi 5 ta shikoyat
                </span>
                <button onClick={() => setActiveTab('reports')} className="text-xs text-[#f0b90b] hover:underline bg-transparent border-none cursor-pointer font-bold">Barchasini ko'rish</button>
              </h3>
              <div className="space-y-4">
                {stats.lastReports?.length > 0 ? stats.lastReports.map((r: any) => (
                  <div key={r.id} className="bg-[#0b1426] p-4 rounded-xl border border-white/5 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-white">{r.reason}</p>
                      <p className="text-[10px] text-on-primary-container">{r.targetType} • {new Date(r.date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${r.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-400'}`}>
                      {r.status === 'pending' ? 'Kutilmoqda' : 'Ko\'rildi'}
                    </span>
                  </div>
                )) : <p className="text-xs text-on-primary-container italic py-4">Shikoyatlar mavjud emas</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container">group</span>
              Foydalanuvchilar ({totalAdminUsers})
            </h2>
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-primary-container text-sm">search</span>
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
                className="w-full pl-9 pr-4 py-2 bg-[#0b1426] border border-white/10 rounded-xl text-xs text-white focus:border-[#f0b90b] outline-none"
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
                  <tr><td colSpan={5} className="py-8 text-center text-on-primary-container">Yuklanmoqda...</td></tr>
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
                          <div className="font-bold text-white group-hover:text-secondary-container transition-colors flex items-center gap-1.5">
                            {u.name}
                            {u.isVip && <span className="text-yellow-400 text-[10px]">👑</span>}
                          </div>
                          <div className="text-[10px] text-on-primary-container">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${u.role === 'Admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-on-primary-container">{u.joinDate}</td>
                    <td className="py-4 px-4 text-center text-white font-mono font-bold">{u.totalPayments}</td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBanUser(u.id, !u.isBanned);
                        }}
                        disabled={isBanningId === u.id}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all active:scale-95 cursor-pointer ${
                          u.isBanned 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        }`}
                      >
                        {u.isBanned ? 'Blokdan ochish' : 'Bloklash'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination(usersPage, usersTotalPages, (page) => fetchAdminUsers(page, usersSearch))}
        </div>
      )}

      {/* Tabs selectors */}
      <div className="flex border-b border-white/10 gap-2 md:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-0.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'dashboard'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">dashboard</span>
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'analytics'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">analytics</span>
          Analytics
        </button>
        <button
          onClick={() => setActiveTab('listings')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'listings'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">pending_actions</span>
          Elonlar ({pendingStartups.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'users'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">group</span>
          Foydalanuvchilar
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'categories'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">category</span>
          Kategoriyalar
        </button>
        <button
          onClick={() => setActiveTab('disputes')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'disputes'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">gavel</span>
          Nizolar ({disputes.filter(d => d.status === 'open').length + escrowDisputes.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'reports'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">flag</span>
          Shikoyatlar ({reports.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('sponsors')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'sponsors'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">campaign</span>
          Sponsorlar ({sponsorChannels.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'audit'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">history</span>
          Audit
        </button>
        
        <button
          onClick={() => setActiveTab('support')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'support'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">support_agent</span>
          Murojaatlar
        </button>

        <button
          onClick={() => setActiveTab('refunds')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'refunds'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">payments</span>
          Qaytarishlar ({escrowRefunds.length})
        </button>

        <button
          onClick={() => setActiveTab('b2b')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'b2b'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">business_center</span>
          B2B So'rovlar
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer bg-transparent border-none whitespace-nowrap px-2 ${
            activeTab === 'settings'
              ? 'text-[#f0b90b] border-[#f0b90b]'
              : 'text-[#8892b0] border-transparent hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-sm">settings</span>
          Sozlamalar
        </button>
      </div>

      {activeTab === 'categories' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container">category</span>
              Kategoriyalarni boshqarish
            </h2>
            <button
              onClick={() => setIsAddingCategory(true)}
              className="px-4 py-2 bg-secondary-container text-[#12161c] rounded-xl font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Yangi qo'shish
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-[#0b1426] border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-secondary-container">
                    <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">{cat.name}</h3>
                    <p className="text-[10px] text-on-primary-container">ID: {cat.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setEditingCategory(cat)}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-[10px] transition-all"
                  >
                    Tahrirlash
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-bold text-[10px] transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {(isAddingCategory || editingCategory) && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-primary-container border border-outline-variant/30 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary-container">
                      {isAddingCategory ? 'add_circle' : 'edit_square'}
                    </span>
                    {isAddingCategory ? "Yangi kategoriya qo'shish" : "Kategoriyani tahrirlash"}
                  </h3>
                  <button 
                    onClick={() => { setIsAddingCategory(false); setEditingCategory(null); }}
                    className="text-on-primary-container hover:text-white"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={isAddingCategory ? handleAddCategory : handleSaveCategory} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-on-primary-container">Kategoriya ID (faqat ingichka harflar va chiziqlar)</label>
                    <input
                      type="text"
                      disabled={!isAddingCategory}
                      value={isAddingCategory ? newCategory.id : editingCategory?.id}
                      onChange={(e) => isAddingCategory ? setNewCategory({...newCategory, id: e.target.value}) : null}
                      className="w-full bg-[#0b1426] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-secondary-container outline-none disabled:opacity-50"
                      placeholder="masalan: startaplar"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-on-primary-container">Kategoriya nomi</label>
                    <input
                      type="text"
                      value={isAddingCategory ? newCategory.name : editingCategory?.name}
                      onChange={(e) => isAddingCategory ? setNewCategory({...newCategory, name: e.target.value}) : setEditingCategory(prev => prev ? {...prev, name: e.target.value} : null)}
                      className="w-full bg-[#0b1426] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-secondary-container outline-none"
                      placeholder="masalan: Startaplar"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-on-primary-container">Ikonka (Material Icon nomi)</label>
                    <input
                      type="text"
                      value={isAddingCategory ? newCategory.icon : editingCategory?.icon}
                      onChange={(e) => isAddingCategory ? setNewCategory({...newCategory, icon: e.target.value}) : setEditingCategory(prev => prev ? {...prev, icon: e.target.value} : null)}
                      className="w-full bg-[#0b1426] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-secondary-container outline-none"
                      placeholder="masalan: rocket_launch"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="w-full py-3 bg-secondary-container text-[#12161c] rounded-xl font-bold text-sm shadow-lg shadow-secondary-container/10 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isSavingCategory && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
                    {isAddingCategory ? "Qo'shish" : "Saqlash"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Admin User Detail Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-10 rounded-3xl border-white/5 shadow-2xl relative custom-scrollbar">
            <button 
              onClick={() => setSelectedUserDetail(null)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-white border border-white/10"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Card */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-[#0b1426] border border-white/5 rounded-3xl p-6 text-center space-y-4">
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
                      <div className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-black border-4 border-[#0b1426]">
                        <span className="material-symbols-outlined text-lg">workspace_premium</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{selectedUserDetail.user.name}</h3>
                    <p className="text-xs text-on-primary-container">{selectedUserDetail.user.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      selectedUserDetail.user.role === 'Admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {selectedUserDetail.user.role}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      selectedUserDetail.user.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {selectedUserDetail.user.isBanned ? 'Bloklangan' : 'Faol'}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-primary-container font-medium pt-2">
                    A'zo bo'lgan sana: <br/> {new Date(selectedUserDetail.user.joinDate).toLocaleDateString("uz-UZ", { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="bg-secondary-container/5 border border-secondary-container/10 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">Statistika</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-on-primary-container uppercase">Elonlar</span>
                      <p className="text-xl font-black text-white">{selectedUserDetail.user.totalStartups}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-on-primary-container uppercase">Xaridlar</span>
                      <p className="text-xl font-black text-white">{selectedUserDetail.user.totalPurchases}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-on-primary-container uppercase">Sotuv summasi</span>
                      <p className="text-xl font-black text-secondary-container">${selectedUserDetail.user.totalSoldAmount}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-on-primary-container uppercase">Reyting</span>
                      <p className="text-xl font-black text-yellow-400 flex items-center gap-1">
                        {selectedUserDetail.user.averageRating.toFixed(1)}
                        <span className="material-symbols-outlined text-sm">star</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Management Tabs */}
              <div className="lg:col-span-2 space-y-8">
                <div className="space-y-6">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary-container">settings_suggest</span>
                    Boshqaruv amallari
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* VIP Management */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-yellow-400 text-sm">workspace_premium</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">VIP Holati</span>
                      </div>
                      {selectedUserDetail.user.isVip ? (
                        <div className="space-y-3">
                          <p className="text-[11px] text-green-400 font-bold">
                            VIP faol (tugash: {new Date(selectedUserDetail.user.vipExpiresAt).toLocaleDateString()})
                          </p>
                          <button 
                            disabled={isUpdatingUser}
                            onClick={() => handleUpdateUserVip(selectedUserDetail.user.id, false, 0)}
                            className="w-full py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold border border-red-500/20 hover:bg-red-500/20 transition-all"
                          >
                            VIPni bekor qilish
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <select className="w-full bg-[#0b1426] border border-white/10 text-white rounded-lg p-2 text-xs font-bold outline-none" id="vipDays">
                            <option value="30">30 kun (Sovg'a)</option>
                            <option value="90">90 kun (Sovg'a)</option>
                            <option value="365">1 yil (Sovg'a)</option>
                          </select>
                          <button 
                            disabled={isUpdatingUser}
                            onClick={() => {
                              const days = parseInt((document.getElementById('vipDays') as HTMLSelectElement).value);
                              handleUpdateUserVip(selectedUserDetail.user.id, true, days);
                            }}
                            className="w-full py-2 bg-yellow-400 text-black rounded-lg text-xs font-black hover:brightness-110 transition-all"
                          >
                            VIP berish
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Role Management */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-blue-400 text-sm">badge</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Foydalanuvchi roli</span>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {['Xaridor', 'Sotuvchi', 'Admin'].map(role => (
                            <button
                              key={role}
                              disabled={isUpdatingUser}
                              onClick={() => handleUpdateUserRole(selectedUserDetail.user.id, role)}
                              className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                                selectedUserDetail.user.role === role 
                                  ? 'bg-blue-500 text-white border-blue-500' 
                                  : 'bg-white/5 border-white/10 text-[#8892b0] hover:text-white'
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Security & Account */}
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-red-400 text-sm">security</span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Xavfsizlik</span>
                      </div>
                      <div className="space-y-2">
                        <button 
                          disabled={isUpdatingUser}
                          onClick={() => handleSendResetLink(selectedUserDetail.user.email)}
                          className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">key</span>
                          Parolni tiklash havolasi
                        </button>
                        <button 
                          disabled={isUpdatingUser}
                          onClick={() => handleBanUser(selectedUserDetail.user.id, !selectedUserDetail.user.isBanned)}
                          className={`w-full py-2 rounded-lg text-xs font-bold transition-all border ${
                            selectedUserDetail.user.isBanned 
                              ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {selectedUserDetail.user.isBanned ? "Blokdan ochish" : "Foydalanuvchini bloklash"}
                        </button>
                      </div>
                    </div>

                    {/* Dangerous Actions */}
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-red-500 text-sm">delete_forever</span>
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Xavfli amallar</span>
                      </div>
                      {!showDeleteConfirm ? (
                        <button 
                          disabled={isUpdatingUser}
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full py-2 bg-red-500 text-white rounded-lg text-xs font-black hover:bg-red-600 transition-all shadow-lg shadow-red-500/10"
                        >
                          Hisobni butunlay o'chirish
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-red-400 font-bold text-center">Ishonchingiz komilmi?</p>
                          <div className="flex gap-2">
                            <button 
                              disabled={isUpdatingUser}
                              onClick={() => handleDeleteUser(selectedUserDetail.user.id)}
                              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black disabled:opacity-50"
                            >
                              HA, O'CHIRISH
                            </button>
                            <button 
                              onClick={() => setShowDeleteConfirm(false)}
                              className="flex-1 py-2 bg-white/10 text-white rounded-lg text-[10px] font-bold"
                            >
                              YO'Q
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Logs */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary-container">history</span>
                    Oxirgi AuditLog yozuvlari
                  </h4>
                  <div className="bg-[#0b1426] border border-white/5 rounded-2xl overflow-hidden">
                    {selectedUserDetail.auditLogs.length === 0 ? (
                      <p className="p-8 text-center text-on-primary-container text-xs italic">Audit yozuvlari topilmadi.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {selectedUserDetail.auditLogs.map((log: any) => (
                          <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[10px] font-black text-secondary-container uppercase tracking-widest">{log.action}</span>
                              <span className="text-[9px] text-on-primary-container font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-[11px] text-white font-medium leading-relaxed mb-1">{log.details}</p>
                            <p className="text-[9px] text-[#8892b0]">Admin: <span className="text-white font-bold">{log.admin?.name || "Tizim"}</span></p>
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

      {activeTab === 'analytics' && (
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
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* General Stats summary in Analytics */}
              <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary-container/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-on-primary-container uppercase font-black mb-1">Jami Loyihalar</p>
                  <p className="text-2xl font-mono font-black text-white">{analytics.totalListings}</p>
                </div>
                <div className="bg-primary-container/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-on-primary-container uppercase font-black mb-1">Yangi Foydalanuvchilar</p>
                  <p className="text-2xl font-mono font-black text-white">{analytics.newUsers}</p>
                </div>
                <div className="bg-primary-container/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-on-primary-container uppercase font-black mb-1">Muvaffaqiyatli Savdolar</p>
                  <p className="text-2xl font-mono font-black text-white">{analytics.totalSales}</p>
                </div>
                <div className="bg-primary-container/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-on-primary-container uppercase font-black mb-1">Jami Daromad</p>
                  <p className="text-2xl font-mono font-black text-[#f3ba2f]">${analytics.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-20 text-center text-[#8892b0] italic">Analitika ma'lumotlari mavjud emas.</div>
          )}
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">

          {/* Kutilayotgan / Barcha e'lonlar almashtirgichi */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
            <div className="flex gap-2">
              <button
                onClick={() => setListingsView('pending')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  listingsView === 'pending'
                    ? 'bg-secondary-container text-on-secondary-fixed'
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Kutilayotganlar ({pendingStartups.length})
              </button>
              <button
                onClick={() => setListingsView('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  listingsView === 'all'
                    ? 'bg-secondary-container text-on-secondary-fixed'
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                }`}
              >
                Barcha e'lonlar ({totalAllListings})
              </button>
            </div>
            {listingsView === 'all' && (
              <input
                type="text"
                value={listingsSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setListingsSearch(val);
                  if (listingsSearchDebounceRef.current) clearTimeout(listingsSearchDebounceRef.current);
                  listingsSearchDebounceRef.current = setTimeout(() => {
                    fetchAllListingsAdmin(1, val);
                  }, 500);
                }}
                placeholder="Nomi yoki ID bo'yicha qidirish..."
                className="w-full sm:w-64 bg-[#0b1426] border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-secondary-container"
              />
            )}
          </div>

          {listingsView === 'pending' ? (
            pendingStartups.length === 0 ? (
              <div className="py-12 text-center text-on-primary-container space-y-2">
                <span className="material-symbols-outlined text-4xl opacity-40">assignment_turned_in</span>
                <p className="text-sm font-bold">Kutilayotgan yangi arizalar mavjud emas</p>
                <p className="text-xs">Barcha yuborilgan loyihalar ko'rib chiqilgan.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingStartups.map((startup) => (
                  <div
                    key={startup.id}
                    className="bg-[#0b1426] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={startup.image}
                        alt={`${startup.name} - kutilayotgan loyiha muqovasi`}
                        className="w-16 h-16 rounded-xl object-cover border border-white/5 flex-shrink-0"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        width={64}
                        height={64}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-extrabold text-base">{startup.name}</h3>
                          <span className="bg-yellow-500/10 text-yellow-500 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border border-yellow-500/20">
                            {startup.category}
                          </span>
                        </div>
                        <p className="text-xs text-[#f3ba2f] font-mono font-bold">
                          Sotish narxi: ${startup.price ? startup.price.toLocaleString() : "0"} • Turi: {startup.listingType}
                        </p>
                        <p className="text-xs text-on-primary-container leading-relaxed line-clamp-1">
                          {startup.slogan}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full md:w-auto">
                      <button
                        disabled={isUpdating !== null}
                        onClick={() => handleStatusChange(startup.id, 'active')}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-[#12161c] font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 shadow-lg shadow-green-500/10 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                        Tasdiqlash
                      </button>
                      <button
                        disabled={isUpdating !== null}
                        onClick={() => handleStatusChange(startup.id, 'rejected')}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Rad etish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : isLoadingAllListings ? (
            <div className="py-12 text-center text-on-primary-container">
              <span className="material-symbols-outlined text-4xl opacity-40 animate-spin">progress_activity</span>
            </div>
          ) : (
            (() => {
              const filtered = allListings;
              return filtered.length === 0 ? (
                <div className="py-12 text-center text-on-primary-container space-y-2">
                  <span className="material-symbols-outlined text-4xl opacity-40">search_off</span>
                  <p className="text-sm font-bold">Hech qanday e'lon topilmadi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((startup) => (
                    <div
                      key={startup.id}
                      className="bg-[#0b1426] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <img
                          src={startup.image}
                          alt={`${startup.name} - loyiha muqovasi`}
                          className="w-12 h-12 rounded-xl object-cover border border-white/5 flex-shrink-0"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          width={48}
                          height={48}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-white font-extrabold text-sm truncate">{startup.name}</h3>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                              startup.status === 'active'
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : startup.status === 'pending'
                                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {startup.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-on-primary-container font-mono truncate">ID: {startup.id}</p>
                        </div>
                      </div>

                      <button
                        disabled={isDeletingStartupId !== null}
                        onClick={() => handleDeleteStartup(startup.id, startup.name)}
                        className="w-full md:w-auto px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white disabled:opacity-50 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                        {isDeletingStartupId === startup.id ? "O'chirilmoqda..." : "Butunlay o'chirish"}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
          {listingsView === 'all' && !isLoadingAllListings &&
            renderPagination(allListingsPage, allListingsTotalPages, (page) => fetchAllListingsAdmin(page, listingsSearch))}
        </div>
      )}


      {activeTab === 'disputes' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-red-400">gavel</span>
            Sotib oluvchilar arizalari va Nizolar ({disputes.length})
          </h2>

          {disputes.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">gavel</span>
              <p className="text-sm font-bold">Hech qanday nizo arizalari mavjud emas</p>
              <p className="text-xs">Platformada barcha xaridlar muammosiz davom etmoqda.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {disputes.map((disp) => (
                <div
                  key={disp.id}
                  className="bg-[#0b1426] border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8892b0] block">Buyurtma va Loyiha</span>
                      <span className="text-white font-black text-sm">{disp.payment?.startup?.name || "Noma'lum loyiha"}</span>
                      <span className="text-xs text-on-primary-container block mt-0.5">ID: {disp.paymentId} • Narxi: ${disp.payment?.startup?.price?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border ${
                        disp.status === 'open'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : disp.status === 'resolved'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}>
                        {disp.status === 'open' ? 'Ochiq nizo' : disp.status === 'resolved' ? 'Yopilgan' : 'Rad etilgan'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                      <span className="text-yellow-500/80 font-bold uppercase text-[9px] tracking-wider block">Nizo ochuvchi xaridor</span>
                      <p className="text-white font-extrabold">{disp.buyer?.name}</p>
                      <p className="text-on-primary-container text-[11px]">{disp.buyer?.email}</p>
                      <p className="text-[#8892b0] text-[10px] mt-1.5">{new Date(disp.createdAt).toLocaleString("uz-UZ")}</p>
                    </div>

                    <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                      <span className="text-red-400/80 font-bold uppercase text-[9px] tracking-wider block">Muammo va Sababi</span>
                      <p className="text-white font-extrabold">"{disp.reason}"</p>
                      <p className="text-on-primary-container text-[11px] leading-relaxed mt-1">"{disp.description}"</p>
                    </div>
                  </div>

                  {disp.status === 'open' ? (
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-[#8892b0]">Admin qarori / Izohi (adminNote):</label>
                        <input
                          type="text"
                          placeholder="Nizoni yopish yoki rad etish sababini batafsil yozing..."
                          value={adminNotes[disp.id] || ""}
                          onChange={(e) => setAdminNotes({ ...adminNotes, [disp.id]: e.target.value })}
                          className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs placeholder-[#8892b0]/50 focus:border-secondary-container focus:outline-none transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          disabled={updatingDisputeId !== null}
                          onClick={() => handleDisputeUpdate(disp.id, 'resolved')}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-[#12161c] font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-md shadow-green-500/10"
                        >
                          <span className="material-symbols-outlined text-xs">gavel</span>
                          Nizoni hal etish (Yopish)
                        </button>
                        <button
                          disabled={updatingDisputeId !== null}
                          onClick={() => handleDisputeUpdate(disp.id, 'rejected')}
                          className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">cancel</span>
                          Rad etish
                        </button>
                      </div>
                    </div>
                  ) : (
                    disp.adminNote && (
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs">
                        <span className="text-[#8892b0] font-bold block uppercase text-[9px]">Admin qarori izohi:</span>
                        <p className="text-gray-300 italic mt-0.5">"{disp.adminNote}"</p>
                      </div>
                    )
                  )}
                </div>
              ))}
              {renderPagination(disputesPage, disputesTotalPages, fetchDisputes)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'disputes' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-red-400">account_balance</span>
            Escrow (kafolatlangan to'lov) nizolari ({escrowDisputes.length})
          </h2>

          {isLoadingEscrowDisputes ? (
            <div className="py-12 text-center text-on-primary-container text-sm">Yuklanmoqda...</div>
          ) : escrowDisputes.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">account_balance</span>
              <p className="text-sm font-bold">Hech qanday escrow nizosi mavjud emas</p>
              <p className="text-xs">Barcha kafolatlangan to'lovlar muammosiz davom etmoqda.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {escrowDisputes.map((ed) => (
                <div
                  key={ed.id}
                  className="bg-[#0b1426] border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8892b0] block">Loyiha</span>
                      <span className="text-white font-black text-sm">{ed.escrow?.payment?.startup?.name || "Noma'lum loyiha"}</span>
                      <span className="text-xs text-on-primary-container block mt-0.5">To'lov ID: {ed.escrow?.paymentId} • Narxi: ${ed.escrow?.payment?.startup?.price?.toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                      Hal qilinmagan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                      <span className="text-yellow-500/80 font-bold uppercase text-[9px] tracking-wider block">Nizo ochuvchi xaridor</span>
                      <p className="text-white font-extrabold">{ed.escrow?.payment?.user?.name}</p>
                      <p className="text-on-primary-container text-[11px]">{ed.escrow?.payment?.user?.email}</p>
                      <p className="text-[#8892b0] text-[10px] mt-1.5">{new Date(ed.createdAt).toLocaleString("uz-UZ")}</p>
                    </div>

                    <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                      <span className="text-red-400/80 font-bold uppercase text-[9px] tracking-wider block">Nizo sababi</span>
                      <p className="text-white font-extrabold">"{ed.reason}"</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-[#8892b0]">Admin qarori / Izohi (adminNote):</label>
                      <input
                        type="text"
                        placeholder="Qarorni asoslab yozing (masalan: dalillar tekshirildi, xaridorning haqi ...)"
                        value={escrowAdminNotes[ed.id] || ""}
                        onChange={(e) => setEscrowAdminNotes({ ...escrowAdminNotes, [ed.id]: e.target.value })}
                        className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs placeholder-[#8892b0]/50 focus:border-secondary-container focus:outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        disabled={updatingEscrowDisputeId !== null}
                        onClick={() => handleEscrowDisputeUpdate(ed.id, 'released')}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-[#12161c] font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-md shadow-green-500/10"
                      >
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        Sotuvchiga ozod qilish
                      </button>
                      <button
                        disabled={updatingEscrowDisputeId !== null}
                        onClick={() => handleEscrowDisputeUpdate(ed.id, 'refunded')}
                        className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xs">undo</span>
                        Xaridorga qaytarish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'refunds' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">payments</span>
              Qaytarish talab qilinadigan to'lovlar (Refund Required) ({escrowRefunds.length})
            </h2>
            <button
              onClick={fetchEscrowRefunds}
              className="px-4 py-2 bg-secondary-container/10 text-secondary-container rounded-xl font-bold text-xs hover:bg-secondary-container/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Yangilash
            </button>
          </div>

          {isLoadingEscrowRefunds ? (
            <div className="py-12 text-center text-on-primary-container text-sm">Yuklanmoqda...</div>
          ) : escrowRefunds.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">task_alt</span>
              <p className="text-sm font-bold">Kutilayotgan qaytarishlar mavjud emas</p>
              <p className="text-xs">Barcha moliyaviy amaliyotlar joyida.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {escrowRefunds.map((payment) => (
                <div key={payment.id} className="bg-[#0b1426] border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-bold">Qaytarish kutilmoqda</span>
                      <span className="text-xs text-on-primary-container font-mono">ID: {payment.id}</span>
                    </div>
                    <h4 className="font-bold text-white text-base">{payment.startup?.name || 'Noma\'lum loyiha'}</h4>
                    <p className="text-sm text-on-primary-container">
                      Xaridor: <span className="text-white font-medium">{payment.user?.name || payment.user?.email || `User #${payment.userId}`}</span> ({payment.user?.email})
                    </p>
                    <div className="flex items-center gap-4 text-xs text-on-primary-container mt-1">
                      <span>Summa: <strong className="text-white">{payment.amount} {payment.currency}</strong></span>
                      <span>Sana: {new Date(payment.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleCompleteRefund(payment.id)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-md"
                    >
                      <span className="material-symbols-outlined text-xs">done_all</span>
                      Qaytarish bajarildi (CoinGate)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-red-500">flag</span>
            Foydalanuvchilar shikoyatlari (Shikoyatlar) ({reports.length})
          </h2>

          {reports.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">flag</span>
              <p className="text-sm font-bold">Hech qanday shikoyatlar mavjud emas</p>
              <p className="text-xs">Barcha e'lonlar va kontent toza holatda.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reports.map((report) => {
                const reportedStartup = report.targetType === 'startup' 
                  ? startups.find((s) => s.id === report.targetId) 
                  : null;

                return (
                  <div
                    key={report.id}
                    className="bg-[#0b1426] border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                            {report.targetType === 'startup' ? "E'lon" : report.targetType === 'user' ? "Foydalanuvchi" : "Izoh / G'oya"}
                          </span>
                          <span className="text-[#8892b0] text-[10px]">ID: {report.targetId}</span>
                        </div>
                        <h4 className="text-white font-black text-sm">
                          {report.targetType === 'startup' 
                            ? (reportedStartup ? `Loyiha: ${reportedStartup.name}` : `Noma'lum Loyiha (ID: ${report.targetId})`)
                            : report.targetType === 'user'
                            ? `Foydalanuvchi (ID: ${report.targetId})`
                            : `Izoh (ID: ${report.targetId})`
                          }
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border ${
                          report.status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                            : report.status === 'reviewed'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {report.status === 'pending' ? 'Kutilmoqda' : report.status === 'reviewed' ? 'Ko\'rib chiqildi' : 'Rad etildi'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                        <span className="text-[#f3ba2f] font-bold uppercase text-[9px] tracking-wider block">Shikoyat sababi</span>
                        <p className="text-white font-extrabold">"{report.reason}"</p>
                        <p className="text-[#8892b0] text-[10px] mt-1.5">{new Date(report.createdAt).toLocaleString("uz-UZ")}</p>
                      </div>

                      <div className="space-y-1 bg-[#0e1726] p-3.5 rounded-xl border border-white/5">
                        <span className="text-red-400/80 font-bold uppercase text-[9px] tracking-wider block">Tavsif / Izoh</span>
                        <p className="text-on-primary-container text-[11px] leading-relaxed italic">
                          {report.description ? `"${report.description}"` : "Izoh qoldirilmagan"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        {report.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleReportStatusChange(report.id, 'reviewed')}
                              disabled={updatingReportId === report.id || isDeletingReportedItem === report.id}
                              className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-[#12161c] font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-xs">check</span>
                              Tasdiqlash (Ko'rib chiqildi)
                            </button>
                            <button
                              onClick={() => handleReportStatusChange(report.id, 'dismissed')}
                              disabled={updatingReportId === report.id || isDeletingReportedItem === report.id}
                              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 disabled:opacity-50 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                              Inkor etish (Rad etish)
                            </button>
                          </>
                        )}
                      </div>

                      {report.targetType === 'user' ? (
                        <button
                          onClick={() => {
                            setActiveTab('users');
                            setUsersSearch(report.targetId);
                            fetchAdminUsers(1, report.targetId);
                          }}
                          className="px-3 py-2 bg-white/5 text-white border border-white/10 hover:bg-white/10 font-black text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">person_search</span>
                          Foydalanuvchini ko'rish
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeleteReportedItem(report.id, report.targetType, report.targetId)}
                          disabled={updatingReportId === report.id || isDeletingReportedItem === report.id}
                          className="px-3 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white disabled:opacity-50 font-black text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                          {isDeletingReportedItem === report.id ? "O'chirilmoqda..." : (report.targetType === 'startup' ? "E'lonni o'chirish" : "Izohni o'chirish")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {renderPagination(reportsPage, reportsTotalPages, fetchReports)}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sponsors' && (
        <div className="space-y-6">
          <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
              <span className="material-symbols-outlined text-[#f0b90b]">campaign</span>
              Yangi sponsor kanal qo'shish
            </h2>
            <form onSubmit={handleAddSponsor} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Kanal ID</label>
                <input
                  required
                  type="text"
                  placeholder="-100..."
                  value={newSponsor.channelId}
                  onChange={e => setNewSponsor({...newSponsor, channelId: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Kanal Username</label>
                <input
                  required
                  type="text"
                  placeholder="savdo24_uz"
                  value={newSponsor.channelUsername}
                  onChange={e => setNewSponsor({...newSponsor, channelUsername: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Ko'rinadigan nom</label>
                <input
                  required
                  type="text"
                  placeholder="Savdo24 Rasmiy"
                  value={newSponsor.displayName}
                  onChange={e => setNewSponsor({...newSponsor, displayName: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Reklamaberuvchi kontakti</label>
                <input
                  type="text"
                  placeholder="@user_admin"
                  value={newSponsor.advertiserContact}
                  onChange={e => setNewSponsor({...newSponsor, advertiserContact: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Narxi (oyiga $)</label>
                <input
                  type="number"
                  placeholder="10"
                  value={newSponsor.pricePerMonth}
                  onChange={e => setNewSponsor({...newSponsor, pricePerMonth: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Boshlanish sanasi</label>
                <input
                  type="date"
                  value={newSponsor.startDate}
                  onChange={e => setNewSponsor({...newSponsor, startDate: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8892b0] uppercase">Tugash sanasi</label>
                <input
                  type="date"
                  value={newSponsor.endDate}
                  onChange={e => setNewSponsor({...newSponsor, endDate: e.target.value})}
                  className="w-full p-2.5 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs focus:border-[#f0b90b] outline-none"
                />
              </div>
              <div className="flex gap-2 items-end">
                <button
                  type="submit"
                  disabled={isAddingSponsor}
                  className="w-full px-6 py-2.5 bg-[#f0b90b] hover:bg-[#d4a009] disabled:opacity-50 text-[#12161c] font-black text-xs rounded-xl transition-all h-[42px] cursor-pointer"
                >
                  {isAddingSponsor ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
              <span className="material-symbols-outlined text-[#f0b90b]">list</span>
              Mavjud sponsor kanallar ({sponsorChannels.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/5 text-xs text-left">
                <thead>
                  <tr className="text-[#8892b0] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Kanal</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Holat</th>
                    <th className="py-3 px-4">Kontakt</th>
                    <th className="py-3 px-4">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {sponsorChannels.map((chan) => (
                    <tr key={chan.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">{chan.displayName}</td>
                      <td className="py-3.5 px-4 text-[#8892b0]">@{chan.channelUsername}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${chan.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {chan.isActive ? 'Faol' : 'Nofaol'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">{chan.advertiserContact || '-'}</td>
                      <td className="py-3.5 px-4 flex items-center gap-2">
                        <button
                          onClick={() => handleSponsorAction(chan.id, 'toggle', chan.isActive)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          title={chan.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                        >
                          <span className="material-symbols-outlined text-sm">{chan.isActive ? 'visibility_off' : 'visibility'}</span>
                        </button>
                        <button
                          onClick={() => {
                            if(window.confirm("Haqiqatan ham o'chirmoqchimisiz?")) handleSponsorAction(chan.id, 'delete');
                          }}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="O'chirish"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sponsorChannels.length === 0 && !isLoadingSponsors && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#8892b0]">Kanallar topilmadi</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs tab render */}
      {activeTab === 'audit' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-[#f0b90b]">history</span>
            Tizim faoliyat tarixi ({auditLogs.length})
          </h2>

          {isLoadingAudit ? (
            <div className="py-12 text-center text-on-primary-container">
              <span className="animate-spin inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mb-2"></span>
              <p className="text-sm font-bold">Yuklanmoqda...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">history</span>
              <p className="text-sm font-bold">Faoliyat tarixi bo'sh</p>
              <p className="text-xs">Hozircha adminlar tomonidan hech qanday amal bajarilmagan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/5 text-xs text-left">
                <thead>
                  <tr className="text-[#8892b0] font-bold uppercase tracking-wider text-[10px]">
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
                      <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("uz-UZ")}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {log.admin?.name || `Admin (ID: ${log.adminId})`}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          log.action.toUpperCase().includes('APPROVE') || log.action.toUpperCase().includes('RESOLVE')
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
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
      )}

      {/* Settings tab render */}
      
      {activeTab === 'support' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-[#f0b90b]">support_agent</span>
            Murojaatlar ({supportTickets.length})
          </h2>
          {isLoadingSupport ? (
            <div className="py-12 text-center text-on-primary-container">
              <span className="animate-spin inline-block w-8 h-8 border-4 border-[#f0b90b] border-t-transparent rounded-full mb-2"></span>
              <p className="text-sm font-bold">Yuklanmoqda...</p>
            </div>
          ) : supportTickets.length === 0 ? (
            <div className="py-12 text-center text-on-primary-container space-y-2">
              <span className="material-symbols-outlined text-4xl opacity-40">done_all</span>
              <p className="text-sm font-bold">Yangi murojaatlar yo'q</p>
            </div>
          ) : (
            <div className="space-y-4">
              {supportTickets.map(ticket => (
                <div key={ticket.id} className="bg-[#12161c] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{ticket.subject}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        ticket.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                        ticket.status === 'reviewing' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        'bg-green-500/10 text-green-500 border border-green-500/20'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#8892b0]">Mijoz: {ticket.email} | Sana: {new Date(ticket.createdAt).toLocaleString()}</p>
                    <p className="text-sm text-on-primary-container mt-2 bg-white/5 p-3 rounded-lg border border-white/5">{ticket.message}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    {ticket.status === 'pending' && (
                      <button
                        disabled={updatingTicketId === ticket.id}
                        onClick={() => {
                          setUpdatingTicketId(ticket.id);
                          fetch(`/api/admin/support-tickets/${ticket.id}/status`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ status: 'reviewing' })
                          }).then(async (res) => {
                            if (res.ok) {
                              setSupportTickets(supportTickets.map(t => t.id === ticket.id ? { ...t, status: 'reviewing' } : t));
                              onActionToast('Holat o\'zgartirildi');
                            } else {
                              const err = await res.json().catch(() => ({}));
                              onActionToast(err.error || 'Holatni o\'zgartirib bo\'lmadi.');
                            }
                          }).catch(() => onActionToast('Tarmoq xatosi yuz berdi.'))
                            .finally(() => setUpdatingTicketId(null));
                        }}
                        className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-xl font-bold text-xs hover:bg-blue-500/30 transition-all disabled:opacity-50"
                      >
                        Ko'rib chiqilmoqda
                      </button>
                    )}
                    {(ticket.status === 'pending' || ticket.status === 'reviewing') && (
                      <button
                        disabled={updatingTicketId === ticket.id}
                        onClick={() => {
                          setUpdatingTicketId(ticket.id);
                          fetch(`/api/admin/support-tickets/${ticket.id}/status`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ status: 'resolved' })
                          }).then(async (res) => {
                            if (res.ok) {
                              setSupportTickets(supportTickets.map(t => t.id === ticket.id ? { ...t, status: 'resolved' } : t));
                              onActionToast('Holat o\'zgartirildi');
                            } else {
                              const err = await res.json().catch(() => ({}));
                              onActionToast(err.error || 'Holatni o\'zgartirib bo\'lmadi.');
                            }
                          }).catch(() => onActionToast('Tarmoq xatosi yuz berdi.'))
                            .finally(() => setUpdatingTicketId(null));
                        }}
                        className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/40 rounded-xl font-bold text-xs hover:bg-green-500/30 transition-all disabled:opacity-50"
                      >
                        Hal qilindi
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="material-symbols-outlined text-[#f0b90b]">settings</span>
            Tizim konfiguratsiyasi
          </h2>

          {isLoadingSettings ? (
            <div className="py-12 text-center text-on-primary-container">
              <span className="animate-spin inline-block w-8 h-8 border-4 border-[#f0b90b] border-t-transparent rounded-full mb-2"></span>
              <p className="text-sm font-bold">Yuklanmoqda...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settings.map((s) => (
                <div key={s.key} className="bg-[#0b1426] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[#8892b0] uppercase tracking-wider">{s.key.replace(/_/g, ' ')}</label>
                    {s.hasValue && (
                      <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 uppercase font-black">Sozlangan</span>
                    )}
                  </div>
                  <div className="relative group">
                    <input
                      type={s.isSecret ? (visibleSecrets[s.key] ? "text" : "password") : "text"}
                      value={settingsValues[s.key] || ''}
                      onChange={(e) => setSettingsValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                      placeholder={s.hasValue && s.isSecret ? "••••••••••••" : "Qiymat kiritilmagan"}
                      className="w-full p-3 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs pr-10 focus:border-[#f0b90b] outline-none transition-all font-mono"
                    />
                    {s.isSecret && (
                      <button
                        type="button"
                        onClick={() => setVisibleSecrets(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892b0] hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {visibleSecrets[s.key] ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] text-[#8892b0] italic leading-tight">
                      Ushbu qiymat serverda shifrlangan holda saqlanadi.
                    </p>
                    <button
                      onClick={() => handleSaveSetting(s.key)}
                      disabled={savingKey === s.key}
                      className={`px-4 py-2 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                        settingsStatus[s.key] === 'success' 
                          ? 'bg-green-500 text-[#12161c]' 
                          : settingsStatus[s.key] === 'error'
                          ? 'bg-red-500 text-white'
                          : 'bg-[#f0b90b] hover:bg-[#d4a009] text-[#12161c]'
                      }`}
                    >
                      {savingKey === s.key ? (
                        <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full"></span>
                      ) : (
                        <span className="material-symbols-outlined text-xs">
                          {settingsStatus[s.key] === 'success' ? 'check' : settingsStatus[s.key] === 'error' ? 'priority_high' : 'save'}
                        </span>
                      )}
                      {settingsStatus[s.key] === 'success' ? 'Saqlandi' : settingsStatus[s.key] === 'error' ? 'Xato' : 'Saqlash'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'b2b' && (
        <AdminB2BTab onActionToast={onActionToast} />
      )}
    </div>
  );
}
