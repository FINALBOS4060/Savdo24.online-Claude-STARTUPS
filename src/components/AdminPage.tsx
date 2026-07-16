import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Startup, UserProfileData, Category } from '../types';
import { apiFetch as fetch } from '../lib/api';

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
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

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

  // Reports (Shikoyatlar) state
  const [reports, setReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'listings' | 'users' | 'categories' | 'disputes' | 'reports' | 'sponsors' | 'audit' | 'settings'>('dashboard');
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
  const [usersSearch, setUsersSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isBanningId, setIsBanningId] = useState<number | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Settings tab states
  const [settings, setSettings] = useState<any[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsValues, setSettingsValues] = useState<{[key: string]: string}>({});
  const [visibleSecrets, setVisibleSecrets] = useState<{[key: string]: boolean}>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<{[key: string]: string}>({});

  // Filter pending startups
  useEffect(() => {
    setPendingStartups(startups.filter((s) => s.status === 'pending'));
  }, [startups]);

  // Authorization check
  const isAdmin = user && user.role === 'Admin';

  const fetchAdminStats = async () => {
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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

  const fetchDisputes = async () => {
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/disputes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDisputes(data);
      }
    } catch (err) {
      console.error("Fetch disputes error:", err);
    } finally {
      setIsLoadingDisputes(false);
    }
  };

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error("Fetch reports error:", err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Fetch audit logs error:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const fetchSponsorChannels = async () => {
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/admin/sponsor-channels', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        const vals: {[key: string]: string} = {};
        data.forEach((s: any) => {
          vals[s.key] = s.value;
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
    setSavingKey(key);
    setSettingsStatus(prev => ({ ...prev, [key]: '' }));
    try {
      const token = localStorage.getItem('savdo24_token');
      const val = settingsValues[key] || '';
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ value: val })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value: data.value, hasValue: !!val } : s));
        setSettingsValues(prev => ({ ...prev, [key]: data.value }));
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

  const fetchAdminUsers = async (page = 1, search = '') => {
    setIsLoadingUsers(true);
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/admin/users?page=${page}&search=${search}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data.users);
        setTotalAdminUsers(data.total);
      }
    } catch (err) {
      console.error("Fetch admin users error:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleBanUser = async (userId: number, isBanned: boolean) => {
    setIsBanningId(userId);
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isBanned })
      });
      if (res.ok) {
        onActionToast(isBanned ? "Foydalanuvchi bloklandi" : "Foydalanuvchi blokdan chiqarildi");
        fetchAdminUsers(usersPage, usersSearch);
        fetchAuditLogs();
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
      }
    } catch (err) {
      console.error("Update VIP error:", err);
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
      }
    } catch (err) {
      console.error("Update role error:", err);
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
      }
    } catch (err) {
      console.error("Delete user error:", err);
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
        alert("Parolni tiklash havolasi yuborildi.");
      }
    } catch (err) {
      console.error("Send reset link error:", err);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const fetchAnalytics = async (period: string) => {
    setIsLoadingAnalytics(true);
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/admin/analytics?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      fetchReports();
      fetchAuditLogs();
      fetchSettings();
      fetchSponsorChannels();
      fetchAdminUsers(1, '');
      fetchAnalytics(analyticsPeriod);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics(analyticsPeriod);
    }
  }, [activeTab, analyticsPeriod]);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setIsSavingCategory(true);
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      }
    } catch (err) {
      onActionToast("Xatolik yuz berdi.");
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
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
        onActionToast(data.error || "Xatolik.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Kategoriyani o'chirmoqchimisiz?")) return;
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onActionToast("Kategoriya o'chirildi.");
        fetchCategories();
      }
    } catch (err) {
      onActionToast("Xatolik.");
    }
  };
  const handleSponsorAction = async (id: number, action: 'toggle' | 'delete', currentIsActive?: boolean) => {
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/admin/sponsor-channels/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch('/api/admin/sponsor-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/reports/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    }
  };

  const handleDeleteReportedItem = async (reportId: number, targetType: string, targetId: string) => {
    if (!window.confirm(`Haqiqatan ham ushbu ${targetType === 'startup' ? "startap e'lonini" : "izoh/g'oyani"} butunlay o'chirmoqchimisiz? Bu amal qaytarilmas!`)) {
      return;
    }

    try {
      const token = localStorage.getItem('savdo24_token');
      const endpoint = targetType === 'startup' 
        ? `/api/admin/startups/${targetId}` 
        : `/api/admin/ideas/${targetId}`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        onActionToast("O'chirish muvaffaqiyatli amalga oshirildi!");
        // Auto mark report as reviewed
        await handleReportStatusChange(reportId, 'reviewed');
        fetchReports();
        fetchStartups(); // Refresh main list
      } else {
        const err = await res.json();
        onActionToast(err.error || "O'chirishda xatolik yuz berdi.");
      }
    } catch (err) {
      onActionToast("Tarmoq xatosi.");
    }
  };

  const handleDisputeUpdate = async (id: number, status: 'resolved' | 'rejected') => {
    setUpdatingDisputeId(id);
    try {
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/disputes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const token = localStorage.getItem('savdo24_token');
      const res = await fetch(`/api/startups/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        onActionToast(`Startap muvaffaqiyatli ${newStatus === 'active' ? 'tasdiqlandi' : 'rad etildi'}.`);
        fetchStartups(); // Refresh the main startup array
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
                  setUsersSearch(e.target.value);
                  fetchAdminUsers(1, e.target.value);
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
                          src={u.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`} 
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
          Nizolar ({disputes.filter(d => d.status === 'open').length})
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
                      src={selectedUserDetail.user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUserDetail.user.name)}&background=random`} 
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
                          {['Buyer', 'Seller', 'Admin'].map(role => (
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
                              onClick={() => handleDeleteUser(selectedUserDetail.user.id)}
                              className="flex-1 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black"
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

          {pendingStartups.length === 0 ? (
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
          )}
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
                            {report.targetType === 'startup' ? "E'lon" : "Izoh / G'oya"}
                          </span>
                          <span className="text-[#8892b0] text-[10px]">ID: {report.targetId}</span>
                        </div>
                        <h4 className="text-white font-black text-sm">
                          {report.targetType === 'startup' 
                            ? (reportedStartup ? `Loyiha: ${reportedStartup.name}` : `Noma'lum Loyiha (ID: ${report.targetId})`)
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
                              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-[#12161c] font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-xs">check</span>
                              Tasdiqlash (Ko'rib chiqildi)
                            </button>
                            <button
                              onClick={() => handleReportStatusChange(report.id, 'dismissed')}
                              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-xs">close</span>
                              Inkor etish (Rad etish)
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteReportedItem(report.id, report.targetType, report.targetId)}
                        className="px-3 py-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white font-black text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        {report.targetType === 'startup' ? "E'lonni o'chirish" : "Izohni o'chirish"}
                      </button>
                    </div>
                  </div>
                );
              })}
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
                          log.action.includes('APPROVE') || log.action.includes('RESOLVE')
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : log.action.includes('REJECT') || log.action.includes('DELETE')
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
            </div>
          )}
        </div>
      )}

      {/* Settings tab render */}
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
                      type={visibleSecrets[s.key] ? "text" : "password"}
                      value={settingsValues[s.key] || ''}
                      onChange={(e) => setSettingsValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                      placeholder={s.hasValue ? "••••••••••••" : "Qiymat kiritilmagan"}
                      className="w-full p-3 bg-[#0e1726] border border-white/10 rounded-xl text-white text-xs pr-10 focus:border-[#f0b90b] outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setVisibleSecrets(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892b0] hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {visibleSecrets[s.key] ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
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
    </div>
  );
}
