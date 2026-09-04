import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  Shield, 
  AlertTriangle, 
  LayoutDashboard, 
  TrendingUp, 
  ClipboardList, 
  Users, 
  FolderTree, 
  Gavel, 
  Flag, 
  Megaphone, 
  History, 
  Headphones, 
  Receipt, 
  Briefcase, 
  Settings, 
  Repeat,
} from 'lucide-react';
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
import { AdminExchangeTab } from './admin/AdminExchangeTab';
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
  // TUZATILDI: bu yerda native confirm() ishlatilardi — sahifadagi
  // boshqa o'chirish/tasdiqlash amallari (report, startup) ConfirmDialog
  // ishlatgani uchun izchillik yo'q edi.
  const [refundConfirmPaymentId, setRefundConfirmPaymentId] = useState<string | null>(null);
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
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

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
  const ADMIN_TABS = ['dashboard', 'analytics', 'listings', 'users', 'categories', 'disputes', 'reports', 'sponsors', 'exchange', 'audit', 'settings', 'support', 'refunds', 'b2b'] as const;
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

  // Settings tab state moved into AdminSettingsTab itself (self-contained,
  // matching the AdminB2BTab/AdminCategoriesTab pattern already used
  // elsewhere in this file) — see src/components/admin/AdminSettingsTab.tsx

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

  const handleCompleteRefund = (paymentId: string) => {
    setRefundConfirmPaymentId(paymentId);
  };

  const executeCompleteRefund = async () => {
    const paymentId = refundConfirmPaymentId;
    setRefundConfirmPaymentId(null);
    if (!paymentId) return;
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
          className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-on-primary-container rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 block" />
        </button>
        <span className="text-xs text-on-primary-container font-medium px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-on-primary-container rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 block" />
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

  // fetchSettings / handleSaveSetting moved into AdminSettingsTab.tsx

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
      <div className="max-w-2xl mx-auto p-8 bg-red-500/10 border border-red-500/30 rounded-2xl text-center space-y-4 animate-fade-in text-left">
        <ShieldAlert className="text-red-500 w-12 h-12 mx-auto" />
        <h2 className="text-xl font-black text-on-primary-container">Kirish taqiqlangan</h2>
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
        <h1 className="text-2xl md:text-3xl font-extrabold text-on-primary-container mb-2 flex items-center gap-2">
          <Shield className="text-secondary w-8 h-8" />
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
            <AlertTriangle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
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

      {/* Tabs selectors — ixchamlashtirish: 14 ta tab endi mazmuniga ko'ra
          guruhlarga bo'lingan (Umumiy / Kontent / Foydalanuvchilar va nazorat /
          Marketing / Tizim), har bir guruh o'z qatorida, kichik sarlavha bilan.
          Bu yerda faqat "diqqat talab qiladigan" tablarda son-belgi (badge)
          ko'rsatiladi — shu bilan admin bir qarashda qayerga e'tibor berish
          kerakligini ko'radi, boshqa tablar esa ortiqcha shovqin qilmaydi. */}
      {(() => {
        const TAB_GROUPS: { label: string; tabs: { id: AdminTab; label: string; icon: any; count?: number }[] }[] = [
          {
            label: 'Umumiy',
            tabs: [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            ],
          },
          {
            label: 'Kontent',
            tabs: [
              { id: 'listings', label: "E'lonlar", icon: ClipboardList, count: pendingStartups.length },
              { id: 'categories', label: 'Kategoriyalar', icon: FolderTree },
            ],
          },
          {
            label: 'Foydalanuvchilar va nazorat',
            tabs: [
              { id: 'users', label: 'Foydalanuvchilar', icon: Users },
              { id: 'disputes', label: 'Nizolar', icon: Gavel, count: disputes.filter(d => d.status === 'open').length + escrowDisputes.length },
              { id: 'reports', label: 'Shikoyatlar', icon: Flag, count: reports.filter(r => r.status === 'pending').length },
              { id: 'refunds', label: 'Qaytarishlar', icon: Receipt, count: escrowRefunds.length },
            ],
          },
          {
            label: 'Marketing va hamkorlik',
            tabs: [
              { id: 'sponsors', label: 'Sponsorlar', icon: Megaphone, count: sponsorChannels.length },
              { id: 'exchange', label: 'Obuna almashish', icon: Repeat },
              { id: 'b2b', label: "B2B so'rovlar", icon: Briefcase },
            ],
          },
          {
            label: 'Tizim',
            tabs: [
              { id: 'audit', label: 'Audit', icon: History },
              { id: 'support', label: 'Murojaatlar', icon: Headphones },
              { id: 'settings', label: 'Sozlamalar', icon: Settings },
            ],
          },
        ];
        return (
          <div className="space-y-2.5 p-3 bg-surface-container-low border border-white/5 rounded-2xl">
            {TAB_GROUPS.map(group => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-on-primary-container/40 w-full sm:w-auto sm:min-w-[128px] shrink-0">
                  {group.label}
                </span>
                {group.tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-secondary text-on-secondary shadow-md'
                          : 'bg-surface-container text-on-primary-container hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {!!tab.count && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${isActive ? 'bg-on-secondary/20' : 'bg-secondary/20 text-secondary'}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}

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

      {activeTab === 'exchange' && (
        <AdminExchangeTab />
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
          onActionToast={onActionToast}
          onSettingSaved={fetchAuditLogs}
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
      <ConfirmDialog
        isOpen={!!refundConfirmPaymentId}
        title="Pul qaytarishni tasdiqlash"
        message="Haqiqatan ham CoinGate orqali pul qaytarilganini tasdiqlaysizmi?"
        variant="danger"
        confirmText="Ha, tasdiqlash"
        cancelText="Bekor qilish"
        onConfirm={executeCompleteRefund}
        onCancel={() => setRefundConfirmPaymentId(null)}
      />
    </div>
  );
}
