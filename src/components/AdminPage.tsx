import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Startup, UserProfileData, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import { AdminB2BTab } from './admin/AdminB2BTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminCategoriesTab } from './admin/AdminCategoriesTab';
import { AdminDashboardTab } from './admin/AdminDashboardTab';
import { AdminAnalyticsTab } from './admin/AdminAnalyticsTab';
import { AdminListingsTab } from './admin/AdminListingsTab';
import { AdminDisputesTab } from './admin/AdminDisputesTab';
import { AdminReportsTab } from './admin/AdminReportsTab';
import { AdminSponsorsTab } from './admin/AdminSponsorsTab';
import { AdminAuditTab } from './admin/AdminAuditTab';
import { AdminSupportTab } from './admin/AdminSupportTab';
import { AdminRefundsTab } from './admin/AdminRefundsTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';

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

  const [reportDeleteConfirm, setReportDeleteConfirm] = useState<{ reportId: number; targetType: string; targetId: string } | null>(null);
  const [startupDeleteConfirm, setStartupDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

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

  // Users management state
  const [usersSearch, setUsersSearch] = useState('');

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

  // Support tickets management state

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

  const handleDeleteReportedItem = (reportId: number, targetType: string, targetId: string) => {
    if (targetType === 'user') return;
    setReportDeleteConfirm({ reportId, targetType, targetId });
  };

  const executeDeleteReportedItem = async () => {
    if (!reportDeleteConfirm) return;
    const { reportId, targetType, targetId } = reportDeleteConfirm;
    setReportDeleteConfirm(null);
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

  const handleDeleteStartup = (id: string, name: string) => {
    setStartupDeleteConfirm({ id, name });
  };

  const executeDeleteStartup = async () => {
    if (!startupDeleteConfirm) return;
    const { id, name } = startupDeleteConfirm;
    setStartupDeleteConfirm(null);
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
      {activeTab === 'dashboard' && (
        <AdminDashboardTab stats={stats} setActiveTab={setActiveTab} />
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <AdminUsersTab
          usersSearch={usersSearch}
          setUsersSearch={setUsersSearch}
          onActionToast={onActionToast}
          fetchAuditLogs={fetchAuditLogs}
        />
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
        <AdminCategoriesTab 
          categories={categories} 
          fetchCategories={fetchCategories} 
          onActionToast={onActionToast}
        />
      )}

      {activeTab === 'analytics' && (
        <AdminAnalyticsTab
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
          isLoadingAnalytics={isLoadingAnalytics}
          analytics={analytics}
        />
      )}

      {activeTab === 'listings' && (
        <AdminListingsTab
          listingsView={listingsView}
          setListingsView={setListingsView}
          listingsSearch={listingsSearch}
          setListingsSearch={setListingsSearch}
          listingsSearchDebounceRef={listingsSearchDebounceRef}
          fetchAllListingsAdmin={fetchAllListingsAdmin}
          pendingStartups={pendingStartups}
          isLoadingPending={isLoadingPending}
          totalAllListings={totalAllListings}
          isUpdating={isUpdating}
          handleStatusChange={handleStatusChange}
          isLoadingAllListings={isLoadingAllListings}
          allListings={allListings}
          isDeletingStartupId={isDeletingStartupId}
          handleDeleteStartup={handleDeleteStartup}
          allListingsPage={allListingsPage}
          allListingsTotalPages={allListingsTotalPages}
          renderPagination={renderPagination}
        />
      )}

      {activeTab === 'disputes' && (
        <AdminDisputesTab
          disputes={disputes}
          escrowDisputes={escrowDisputes}
          isLoadingEscrowDisputes={isLoadingEscrowDisputes}
          adminNotes={adminNotes}
          setAdminNotes={setAdminNotes}
          updatingDisputeId={updatingDisputeId}
          handleDisputeUpdate={handleDisputeUpdate}
          escrowAdminNotes={escrowAdminNotes}
          setEscrowAdminNotes={setEscrowAdminNotes}
          updatingEscrowDisputeId={updatingEscrowDisputeId}
          handleEscrowDisputeUpdate={handleEscrowDisputeUpdate}
          disputesPage={disputesPage}
          disputesTotalPages={disputesTotalPages}
          fetchDisputes={fetchDisputes}
          renderPagination={renderPagination}
        />
      )}

      {activeTab === 'refunds' && (
        <AdminRefundsTab
          escrowRefunds={escrowRefunds}
          isLoadingEscrowRefunds={isLoadingEscrowRefunds}
          fetchEscrowRefunds={fetchEscrowRefunds}
          handleCompleteRefund={handleCompleteRefund}
        />
      )}

      {activeTab === 'reports' && (
        <AdminReportsTab
          reports={reports}
          startups={startups}
          handleReportStatusChange={handleReportStatusChange}
          updatingReportId={updatingReportId}
          isDeletingReportedItem={isDeletingReportedItem}
          handleDeleteReportedItem={handleDeleteReportedItem}
          setActiveTab={setActiveTab}
          setUsersSearch={setUsersSearch}
          reportsPage={reportsPage}
          reportsTotalPages={reportsTotalPages}
          fetchReports={fetchReports}
          renderPagination={renderPagination}
        />
      )}

      {activeTab === 'sponsors' && (
        <AdminSponsorsTab
          newSponsor={newSponsor}
          setNewSponsor={setNewSponsor}
          handleAddSponsor={handleAddSponsor}
          isAddingSponsor={isAddingSponsor}
          sponsorChannels={sponsorChannels}
          isLoadingSponsors={isLoadingSponsors}
          handleSponsorAction={handleSponsorAction}
        />
      )}

      {activeTab === 'audit' && (
        <AdminAuditTab
          auditLogs={auditLogs}
          isLoadingAudit={isLoadingAudit}
          auditLogsPage={auditLogsPage}
          auditLogsTotalPages={auditLogsTotalPages}
          fetchAuditLogs={fetchAuditLogs}
          renderPagination={renderPagination}
        />
      )}

      {activeTab === 'support' && (
        <AdminSupportTab
          supportTickets={supportTickets}
          isLoadingSupport={isLoadingSupport}
          updatingTicketId={updatingTicketId}
          setUpdatingTicketId={setUpdatingTicketId}
          setSupportTickets={setSupportTickets}
          onActionToast={onActionToast}
        />
      )}

      {activeTab === 'settings' && (
        <AdminSettingsTab
          settings={settings}
          isLoadingSettings={isLoadingSettings}
          settingsValues={settingsValues}
          setSettingsValues={setSettingsValues}
          visibleSecrets={visibleSecrets}
          setVisibleSecrets={setVisibleSecrets}
          savingKey={savingKey}
          settingsStatus={settingsStatus}
          handleSaveSetting={handleSaveSetting}
        />
      )}

      {activeTab === 'b2b' && (
        <AdminB2BTab onActionToast={onActionToast} />
      )}

      <ConfirmDialog
        isOpen={!!reportDeleteConfirm}
        title="O'chirishni tasdiqlang"
        message="Haqiqatan ham ushbu e'lon yoki izohni butunlay o'chirmoqchimisiz? Bu amal qaytarilmas!"
        variant="danger"
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        onConfirm={executeDeleteReportedItem}
        onCancel={() => setReportDeleteConfirm(null)}
      />

      <ConfirmDialog
        isOpen={!!startupDeleteConfirm}
        title="E'lonni butunlay o'chirish"
        message={startupDeleteConfirm ? `"${startupDeleteConfirm.name}" e'lonini BUTUNLAY o'chirmoqchimisiz? Bu amal qaytarilmas — unga bog'liq barcha to'lov, g'oya, sharh va suhbat ma'lumotlari ham o'chib ketadi.` : ""}
        variant="danger"
        confirmText="Butunlay o'chirish"
        cancelText="Bekor qilish"
        onConfirm={executeDeleteStartup}
        onCancel={() => setStartupDeleteConfirm(null)}
      />
    </div>
  );
}
