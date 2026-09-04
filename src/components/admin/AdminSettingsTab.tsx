import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, EyeOff, Eye, Download, Upload, Database, Hammer, RefreshCw, Cloud, CloudDownload, Bot, Repeat, CreditCard, Mail, HardDrive, Globe, AlertTriangle } from 'lucide-react';
import { apiFetch as fetch } from '../../lib/api';
import { ConfirmDialog } from '../ConfirmDialog';

interface AdminSettingsTabProps {
  onActionToast: (message: string) => void;
  // Saving a setting can affect other tabs' data (e.g. it's audit-logged).
  // Rather than reaching into the parent's other tab state directly, the
  // parent passes down whatever it wants refreshed after a successful save.
  onSettingSaved?: () => void;
}

// YANGI (admin talabi — "Sozlamalar bo'limini to'liq o'zbek tilida va
// tushunarli qil"): avval har bir sozlama faqat xom .env kalit nomi
// (masalan "EXCHANGE_SUBSCRIBER_MULTIPLIER") bilan ko'rsatilardi — buni
// admin bo'lmagan odam tushunishi qiyin edi. Endi har bir kalit uchun
// odam tiliga o'girilgan sarlavha, qisqa tushuntirish matni va guruh
// (bo'lim) shu ro'yxatda beriladi. Xom kalit nomi baribir kichik
// monospace matn sifatida qoladi (backend/DEPLOY.md bilan solishtirish
// uchun foydali), lekin endi u ASOSIY emas, YORDAMCHI ma'lumot.
//
// MUHIM: bu ro'yxat faqat KO'RSATISH (label/description) uchun — qaysi
// kalitlar mavjudligini backend (`ALL_KEYS`, admin-settings.ts) belgilaydi.
// Bu yerda tavsifi yo'q kalit chiqib qolsa, pastdagi kod xom kalit nomini
// sarlavha sifatida ko'rsatadi (eski xulq-atvor — hech narsa buzilmaydi).
interface SettingMeta {
  label: string;
  description: string;
  group: string;
  placeholder?: string;
  suffix?: string;
}

const SETTINGS_META: Record<string, SettingMeta> = {
  // ── Telegram botlar ──────────────────────────────────────────────
  TELEGRAM_BOT_TOKEN: {
    label: "Asosiy bot tokeni",
    description: "Sizning ASOSIY savdo botingiz (@BotFather'dan olinadi). Mahsulotlar, buyurtmalar, to'lovlar shu bot orqali ishlaydi.",
    group: "Telegram botlar"
  },
  TELEGRAM_BOT_API_TOKEN: {
    label: "Asosiy bot tokeni (zaxira/muqobil)",
    description: "Ba'zi joylashuvlarda ishlatiladigan qo'shimcha/zaxira bot tokeni. Odatda TELEGRAM_BOT_TOKEN bilan bir xil bo'ladi.",
    group: "Telegram botlar"
  },
  TELEGRAM_SUBSCRIBER_BOT_TOKEN: {
    label: "\"Obunachi yig'ish\" boti tokeni",
    description: "Asosiy botdan BUTUNLAY ALOHIDA, mustaqil Telegram bot. Foydalanuvchilar sponsor kanallarga majburiy obuna bo'lishini va \"kanal almashish\" (bir-birlarining kanallariga obuna bo'lib, obunachi yig'ish) tizimini shu bot boshqaradi. Bu bot sponsor va exchange kanallariga ALOHIDA admin qilib qo'shilishi shart.",
    group: "Telegram botlar"
  },
  MAIN_BOT_USERNAME: {
    label: "Asosiy botning @username'i",
    description: "Masalan: mybot (@ belgisisiz). \"Obunachi yig'ish\" boti obuna tasdiqlangach, foydalanuvchini shu username'dagi botga o'tish tugmasi bilan yo'naltiradi.",
    group: "Telegram botlar",
    placeholder: "masalan: savdo24_bot"
  },
  TELEGRAM_STORAGE_CHANNEL_ID: {
    label: "Fayl saqlash kanali ID'si",
    description: "Bot yuklangan rasm/fayllarni vaqtincha saqlash uchun ishlatadigan xususiy Telegram kanal ID'si (-100 bilan boshlanadi).",
    group: "Telegram botlar"
  },
  TELEGRAM_BACKUP_CHAT_ID: {
    label: "Zaxira nusxa yuboriladigan chat ID",
    description: "Kunlik avtomatik ma'lumotlar bazasi zaxirasi shu Telegram chat/kanalga yuboriladi.",
    group: "Telegram botlar"
  },
  TELEGRAM_ADMIN_CHAT_ID: {
    label: "Admin bildirishnomalari chat ID'si",
    description: "Yangi buyurtma, murojaat va boshqa muhim hodisalar haqidagi bildirishnomalar shu Telegram chatga yuboriladi.",
    group: "Telegram botlar"
  },

  // ── Obuna almashish ("Obunachi yig'ish") qoidalari ──────────────
  EXCHANGE_SUBSCRIBER_MULTIPLIER: {
    label: "1 ta obuna uchun necha obunachi qo'shiladi",
    description: "Foydalanuvchi boshqa birovning kanaliga HAQIQATDA obuna bo'lganda, o'zining kanaliga shuncha marta ko'p obunachi qo'shib beriladi. Masalan bu yerga 100 yozilsa — 1 marta chinakam obuna bo'lish kanalga 100 ta obunachi qo'shadi. Standart: 2.",
    group: "Obuna almashish (\"Obunachi yig'ish\") qoidalari",
    placeholder: "masalan: 2",
    suffix: "obunachi / 1 obuna"
  },
  EXCHANGE_REFERRAL_BONUS: {
    label: "Do'st taklif qilish bonusi",
    description: "Foydalanuvchi do'stini botga taklif qilsa va o'sha do'sti o'z kanalini ulab, tasdiqlansa — taklif qilgan odamga shuncha bonus obunachi beriladi. Standart: 5.",
    group: "Obuna almashish (\"Obunachi yig'ish\") qoidalari",
    placeholder: "masalan: 5",
    suffix: "obunachi"
  },
  EXCHANGE_WELCOME_BONUS: {
    label: "\"Xush kelibsiz\" bonusi",
    description: "Foydalanuvchi botga ILK MARTA o'z kanalini ulaganda, unga bir martalik sovg'a sifatida shuncha bonus obunachi (kredit) beriladi. Standart: 20.",
    group: "Obuna almashish (\"Obunachi yig'ish\") qoidalari",
    placeholder: "masalan: 20",
    suffix: "obunachi"
  },
  EXCHANGE_MAX_CHANNELS_PER_USER: {
    label: "Bir foydalanuvchi nechta kanal qo'sha oladi",
    description: "Bitta Telegram akkaunt (bitta odam) bir vaqtning o'zida obuna almashish tizimiga ko'pi bilan nechta O'Z kanalini qo'sha olishi. Standart: 1.",
    group: "Obuna almashish (\"Obunachi yig'ish\") qoidalari",
    placeholder: "masalan: 1",
    suffix: "ta kanal"
  },
  EXCHANGE_MAX_NEW_SUBS_PER_DAY: {
    label: "Kunlik yangi obuna chegarasi",
    description: "Bitta Telegram akkaunt bir kunda ko'pi bilan nechta YANGI kanalga \"obuna bo'ldim\" deb belgilay olishi. Bu ko'plab soxta akkaunt bilan \"farm\" qilishning oldini olish uchun. Standart: 30.",
    group: "Obuna almashish (\"Obunachi yig'ish\") qoidalari",
    placeholder: "masalan: 30",
    suffix: "ta / kuniga"
  },

  // ── TOP va VIP narxlari ──────────────────────────────────────────
  TOP_BASE_PRICE_PER_DAY: {
    label: "TOP'ga chiqarish — 1 kunlik narx",
    description: "E'lonni TOP (yuqori) qatorga chiqarish uchun 1 kunlik bazaviy narx.",
    group: "TOP va VIP narxlari"
  },
  TOP_MAX_CONCURRENT_SLOTS: {
    label: "TOP'da bir vaqtda nechta e'lon turishi mumkin",
    description: "TOP qatorida bir vaqtning o'zida ko'rsatiladigan e'lonlarning maksimal soni (o'rinlar soni).",
    group: "TOP va VIP narxlari",
    suffix: "ta o'rin"
  },
  VIP_PRICE_PER_DAY: {
    label: "VIP status — 1 kunlik narx",
    description: "Foydalanuvchi profiliga VIP status berish uchun 1 kunlik narx.",
    group: "TOP va VIP narxlari"
  },
  VIP_DISCOUNT_PERCENT: {
    label: "VIP foydalanuvchilar uchun chegirma",
    description: "VIP statusli foydalanuvchilarga boshqa xizmatlarda (masalan TOP'ga chiqarish) beriladigan chegirma foizi.",
    group: "TOP va VIP narxlari",
    suffix: "%"
  },

  // ── To'lov tizimlari ─────────────────────────────────────────────
  COINGATE_API_TOKEN: {
    label: "CoinGate API kaliti",
    description: "Kriptovalyuta orqali to'lovlarni qabul qilish uchun CoinGate xizmatining API kaliti.",
    group: "To'lov tizimlari"
  },
  STRIPE_SECRET_KEY: {
    label: "Stripe maxfiy kaliti",
    description: "Stripe orqali karta to'lovlarini qabul qilish uchun maxfiy (secret) API kaliti.",
    group: "To'lov tizimlari"
  },
  STRIPE_WEBHOOK_SECRET: {
    label: "Stripe webhook kaliti",
    description: "Stripe'dan keladigan to'lov hodisalarini (webhook) tekshirish/tasdiqlash uchun maxfiy kalit.",
    group: "To'lov tizimlari"
  },

  // ── Email (SMTP) ─────────────────────────────────────────────────
  SMTP_HOST: {
    label: "SMTP server manzili",
    description: "Email xabarlar (parolni tiklash, bildirishnomalar va h.k.) yuboriladigan pochta serverining manzili.",
    group: "Email (SMTP)",
    placeholder: "masalan: smtp.gmail.com"
  },
  SMTP_PORT: {
    label: "SMTP port raqami",
    description: "Pochta serveriga ulanish uchun port raqami. Odatda 465 (SSL) yoki 587 (TLS).",
    group: "Email (SMTP)",
    placeholder: "masalan: 587"
  },
  SMTP_USER: {
    label: "SMTP foydalanuvchi nomi (email)",
    description: "Email yuborish uchun ishlatiladigan pochta akkauntining login/email manzili.",
    group: "Email (SMTP)"
  },
  SMTP_PASS: {
    label: "SMTP paroli",
    description: "Yuqoridagi pochta akkauntining paroli (yoki ilova paroli — App Password).",
    group: "Email (SMTP)"
  },
  SMTP_SERVICE: {
    label: "SMTP xizmat turi",
    description: "Pochta yuboruvchi xizmat nomi (masalan gmail), ba'zi email kutubxonalarida host/port o'rniga ishlatiladi.",
    group: "Email (SMTP)"
  },
  GOOGLE_CLIENT_ID: {
    label: "Google Client ID",
    description: "\"Google orqali kirish\" (Google login) funksiyasi uchun Google Cloud'dan olingan Client ID.",
    group: "Email (SMTP)"
  },

  // ── Fayl saqlash va bulutli zaxira ───────────────────────────────
  CONTABO_S3_ENDPOINT: {
    label: "Contabo S3 manzili (endpoint)",
    description: "Yuklangan rasm/fayllar saqlanadigan Contabo Object Storage (S3-uyg'un) xizmatining manzili.",
    group: "Fayl saqlash va bulutli zaxira"
  },
  CONTABO_ACCESS_KEY: {
    label: "Contabo Access Key",
    description: "Contabo Object Storage'ga ulanish uchun kirish kaliti (Access Key).",
    group: "Fayl saqlash va bulutli zaxira"
  },
  CONTABO_SECRET_KEY: {
    label: "Contabo Secret Key",
    description: "Contabo Object Storage'ga ulanish uchun maxfiy kalit (Secret Key).",
    group: "Fayl saqlash va bulutli zaxira"
  },
  CONTABO_BUCKET_NAME: {
    label: "Contabo bucket nomi",
    description: "Fayllar saqlanadigan Object Storage \"bucket\" (papka)ning nomi.",
    group: "Fayl saqlash va bulutli zaxira"
  },
  CDN_DOMAIN: {
    label: "CDN domeni",
    description: "Saqlangan rasm/fayllar shu domen orqali (tezroq yuklanishi uchun) ko'rsatiladi. Bo'sh qoldirilsa, standart manzil ishlatiladi.",
    group: "Fayl saqlash va bulutli zaxira"
  },
  GOOGLE_DRIVE_CLIENT_EMAIL: {
    label: "Google Drive xizmat email'i",
    description: "Bulutli zaxirani Google Drive'ga yuborish uchun ishlatiladigan xizmat hisobi (service account) email manzili.",
    group: "Fayl saqlash va bulutli zaxira"
  },
  GOOGLE_DRIVE_PRIVATE_KEY: {
    label: "Google Drive maxfiy kaliti",
    description: "Yuqoridagi xizmat hisobining maxfiy (private) kaliti — Google Drive'ga zaxira yuborish uchun.",
    group: "Fayl saqlash va bulutli zaxira"
  },
  GOOGLE_DRIVE_FOLDER_ID: {
    label: "Google Drive papka ID'si",
    description: "Bulutli zaxira fayllari yuboriladigan Google Drive papkasining ID'si.",
    group: "Fayl saqlash va bulutli zaxira"
  },
  BACKUP_GITHUB_TOKEN: {
    label: "GitHub token (zaxira uchun)",
    description: "Loyiha kodini/zaxirasini GitHub'ga avtomatik saqlash uchun ishlatiladigan shaxsiy kirish tokeni (Personal Access Token).",
    group: "Fayl saqlash va bulutli zaxira"
  },
  BACKUP_GITHUB_REPO: {
    label: "GitHub repozitoriysi",
    description: "Zaxira/kod yuboriladigan GitHub repozitoriysi manzili (masalan: username/repo-nomi).",
    group: "Fayl saqlash va bulutli zaxira"
  },
  BACKUP_GITHUB_EMAIL: {
    label: "GitHub commit email'i",
    description: "Avtomatik GitHub'ga yozishda ishlatiladigan email manzil (commit muallifi sifatida ko'rinadi).",
    group: "Fayl saqlash va bulutli zaxira"
  },
  BACKUP_GITHUB_NAME: {
    label: "GitHub commit ismi",
    description: "Avtomatik GitHub'ga yozishda ishlatiladigan ism (commit muallifi sifatida ko'rinadi).",
    group: "Fayl saqlash va bulutli zaxira"
  },

  // ── Boshqa ────────────────────────────────────────────────────────
  APP_URL: {
    label: "Saytning to'liq manzili (URL)",
    description: "Saytingizning to'liq internet manzili (masalan: https://savdo24.uz). Bot va boshqa xizmatlar shu manzil orqali serverga murojaat qiladi.",
    group: "Boshqa",
    placeholder: "https://sizning-domeningiz.uz"
  }
};

const GROUP_ORDER = [
  "Telegram botlar",
  "Obuna almashish (\"Obunachi yig'ish\") qoidalari",
  "TOP va VIP narxlari",
  "To'lov tizimlari",
  "Email (SMTP)",
  "Fayl saqlash va bulutli zaxira",
  "Boshqa"
];

const GROUP_ICONS: Record<string, React.ElementType> = {
  "Telegram botlar": Bot,
  "Obuna almashish (\"Obunachi yig'ish\") qoidalari": Repeat,
  "TOP va VIP narxlari": CreditCard,
  "To'lov tizimlari": CreditCard,
  "Email (SMTP)": Mail,
  "Fayl saqlash va bulutli zaxira": HardDrive,
  "Boshqa": Globe
};

const FALLBACK_GROUP = "Boshqa";

// YANGI (admin talabi — "sozlamalar sahifasi bo'yicha fikring"): uzun
// sozlamalar sahifasida bo'limlar orasida tez o'tish uchun har bir
// guruh nomidan barqaror HTML id yasaydi (masalan
// "TOP va VIP narxlari" → "settings-group-top-va-vip-narxlari").
function groupSlug(group: string): string {
  return `settings-group-${group.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '')}`;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  onActionToast,
  onSettingSaved,
}) => {
  const [settings, setSettings] = useState<any[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsValues, setSettingsValues] = useState<{ [key: string]: string }>({});
  const [visibleSecrets, setVisibleSecrets] = useState<{ [key: string]: boolean }>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<{ [key: string]: string }>({});
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  // TUZATILDI: bu bo'limdagi 3 ta xavfli amal (zaxiradan tiklash, bulutdan
  // tiklash, serverni qayta ishga tushirish) native window.confirm()
  // ishlatardi — sahifadagi boshqa joylarda ConfirmDialog ishlatilgani
  // uchun izchillik yo'q edi. Endi bittasi tanlanganda shu umumiy
  // state orqali ConfirmDialog ochiladi.
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [confirmAction, setConfirmAction] = useState<'restore' | 'cloudRestore' | 'restart' | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const [cloudStatus, setCloudStatus] = useState<{
    telegramConfigured: boolean;
    s3Configured: boolean;
    googleDriveConfigured: boolean;
    lastBackupDate: string | null;
    hasTelegramFileId: boolean;
  } | null>(null);
  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const [isCloudRestoring, setIsCloudRestoring] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [buildOutput, setBuildOutput] = useState<string | null>(null);

  // YANGI (admin talabi — "sozlamalar sahifasi bo'yicha fikring"):
  // guruhlash mantig'i avval faqat JSX ichidagi IIFE'da hisoblanardi —
  // shu sabab uni tez-navigatsiya paneli va xato-banneri uchun QAYTA
  // ishlatib bo'lmasdi. Endi bitta joyda (useMemo) hisoblanadi va uch
  // joyda ham (banner, tez-navigatsiya, asosiy ro'yxat) shu natija
  // ishlatiladi — ikki xil joyda ikki xil guruhlash mantig'i bo'lib
  // qolish xavfi yo'q.
  const { orderedGroups, byGroup, decryptFailedSettings } = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    const failed: any[] = [];
    for (const s of settings) {
      const key = typeof s === 'string' ? s : s.key;
      const meta = SETTINGS_META[key];
      const group = meta?.group || FALLBACK_GROUP;
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(s);
      if (typeof s === 'object' && s.decryptFailed) failed.push({ ...s, group });
    }
    const ordered = [
      ...GROUP_ORDER.filter((g) => grouped[g]?.length),
      ...Object.keys(grouped).filter((g) => !GROUP_ORDER.includes(g))
    ];
    return { orderedGroups: ordered, byGroup: grouped, decryptFailedSettings: failed };
  }, [settings]);

  const scrollToGroup = (group: string) => {
    document.getElementById(groupSlug(group))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        const vals: { [key: string]: string } = {};
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

  const fetchCloudStatus = async () => {
    try {
      const res = await fetch('/api/admin/backup/cloud-status');
      if (res.ok) {
        setCloudStatus(await res.json());
      }
    } catch (err) {
      console.error("Fetch cloud backup status error:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCloudStatus();
  }, []);

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
        // TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_API_TOKEN saqlanganda backend
        // bot jarayonini (PM2: telegram-bot) qayta ishga tushirishga
        // harakat qiladi va natija haqida (muvaffaqiyatli yoki qo'lda
        // restart kerakligi) shu `warning` maydonida xabar beradi —
        // buni admin ko'rishi shart, shuning uchun alohida toast.
        if (data.warning) {
          onActionToast(data.warning);
        }
        onSettingSaved?.();
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

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      const res = await fetch('/api/admin/backup/export');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onActionToast(data.error || "Zaxira yaratishda xatolik yuz berdi.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `savdo24-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onActionToast("Zaxira nusxasi yuklab olindi.");
    } catch (err) {
      console.error("Backup download error:", err);
      onActionToast("Zaxira yaratishda xatolik yuz berdi.");
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingRestoreFile(file);
    setConfirmAction('restore');
  };

  const runRestore = async (file: File) => {
    setIsRestoring(true);
    try {
      const formData = new FormData();
      formData.append('backup', file);
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onActionToast(data.message || "Ma'lumotlar tiklandi.");
      } else {
        onActionToast(data.error || "Tiklashda xatolik yuz berdi.");
      }
    } catch (err) {
      console.error("Backup restore error:", err);
      onActionToast("Tiklashda xatolik yuz berdi.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCloudBackup = async () => {
    setIsCloudBackingUp(true);
    try {
      const res = await fetch('/api/admin/backup/cloud-backup', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      onActionToast(data.message || data.error || "Amal bajarildi.");
      fetchCloudStatus();
    } catch (err) {
      console.error("Cloud backup error:", err);
      onActionToast("Bulutga zaxira yuborishda xatolik yuz berdi.");
    } finally {
      setIsCloudBackingUp(false);
    }
  };

  const handleCloudRestore = () => {
    setConfirmAction('cloudRestore');
  };

  const runCloudRestore = async () => {
    setIsCloudRestoring(true);
    try {
      const res = await fetch('/api/admin/backup/cloud-restore', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      onActionToast(data.message || data.error || "Amal bajarildi.");
    } catch (err) {
      console.error("Cloud restore error:", err);
      onActionToast("Bulutdan tiklashda xatolik yuz berdi.");
    } finally {
      setIsCloudRestoring(false);
    }
  };

  const handleRebuild = async () => {
    setIsBuilding(true);
    setBuildOutput(null);
    try {
      const res = await fetch('/api/admin/rebuild', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setBuildOutput(data.output || '');
      if (res.ok) {
        onActionToast(data.message || "Build muvaffaqiyatli yakunlandi.");
      } else {
        onActionToast(data.error || "Build muvaffaqiyatsiz tugadi.");
      }
    } catch (err) {
      console.error("Rebuild error:", err);
      onActionToast("Build ishga tushirishda xatolik yuz berdi.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleRestart = () => {
    setConfirmAction('restart');
  };

  const runRestart = async () => {
    setIsRestarting(true);
    try {
      const res = await fetch('/api/admin/rebuild/restart', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      onActionToast(data.message || data.error || "Amal bajarildi.");
    } catch (err) {
      console.error("Restart error:", err);
      onActionToast("Serverni qayta ishga tushirishda xatolik yuz berdi.");
    } finally {
      setIsRestarting(false);
    }
  };

  // Umumiy ConfirmDialog uchta xavfli amalning barchasini boshqaradi —
  // qaysi biri tanlangani confirmAction'da saqlanadi.
  const handleConfirmDialogConfirm = () => {
    const action = confirmAction;
    const file = pendingRestoreFile;
    setConfirmAction(null);
    setPendingRestoreFile(null);
    if (action === 'restore' && file) runRestore(file);
    else if (action === 'cloudRestore') runCloudRestore();
    else if (action === 'restart') runRestart();
  };

  const handleConfirmDialogCancel = () => {
    setConfirmAction(null);
    setPendingRestoreFile(null);
  };

  const confirmDialogConfig: Record<'restore' | 'cloudRestore' | 'restart', { title: string; message: string }> = {
    restore: {
      title: "Zaxiradan tiklash",
      message: "DIQQAT: bu joriy ma'lumotlar bazasini va barcha rasmlarni tanlangan zaxira fayli bilan TO'LIQ ALMASHTIRADI. Bu amalni ORQAGA QAYTARIB BO'LMAYDI. Davom etasizmi?"
    },
    cloudRestore: {
      title: "Bulutdan tiklash",
      message: "DIQQAT: bu joriy ma'lumotlar bazasini Telegram/S3/Google Drive'dagi ENG SO'NGGI bulutli zaxira bilan TO'LIQ ALMASHTIRADI. Bu amalni ORQAGA QAYTARIB BO'LMAYDI. Davom etasizmi?"
    },
    restart: {
      title: "Serverni qayta ishga tushirish",
      message: "DIQQAT: server (va, agar PM2'da topilsa, telegram-bot jarayoni ham) bir necha soniyaga qayta ishga tushadi va shu vaqt ichida sayt/bot vaqtincha javob bermaydi. Faqat build muvaffaqiyatli yakunlangandan keyin bosing. Davom etasizmi?"
    }
  };

  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2">
          <Settings className="text-secondary w-5 h-5" />
          Tizim sozlamalari
        </h2>
        <p className="text-xs text-on-primary-container mt-1">
          Telegram botlar, obuna almashish qoidalari, to'lov xizmatlari va boshqa API kalitlarini shu yerdan boshqarasiz. Har bir maydon ostida uning nima uchun kerakligi tushuntirilgan.
        </p>
      </div>

      {/* YANGI (admin talabi — "sozlamalar sahifasi bo'yicha fikring"):
          shifrlash xatosi bo'lgan sozlamalar avval faqat kichik ⚠️
          matn bilan, sahifa ichida ko'rinmasdan qolib ketishi mumkin
          edi. Endi bunday holat bo'lsa, sahifa TEPASIDA, e'tiborni
          tortadigan qizil banner ko'rsatiladi va bosilganda birinchi
          shunday sozlama turgan bo'limga o'tkazadi. */}
      {decryptFailedSettings.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="text-red-400 w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-400">
              {decryptFailedSettings.length} ta sozlamani shifrdan ochib bo'lmadi
            </p>
            <p className="text-xs text-red-400/80 mt-0.5">
              {decryptFailedSettings.map((s) => SETTINGS_META[s.key]?.label || s.key).join(', ')} — qiymatni qayta kiritib saqlang, yoki serverni qayta ishga tushiring (standart sozlamalar avtomatik tuzatiladi).
            </p>
          </div>
          <button
            type="button"
            onClick={() => scrollToGroup(decryptFailedSettings[0].group)}
            className="shrink-0 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            Bo'limga o'tish
          </button>
        </div>
      )}

      {/* YANGI (admin talabi): uzun sozlamalar sahifasida bo'limlar
          orasida tez o'tish uchun "pill" ko'rinishidagi navigatsiya. */}
      {!isLoadingSettings && orderedGroups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {orderedGroups.map((group) => {
            const GroupIcon = GROUP_ICONS[group] || Globe;
            const hasFailure = decryptFailedSettings.some((s) => s.group === group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => scrollToGroup(group)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  hasFailure
                    ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                    : 'bg-surface-container border-white/10 text-on-primary-container/80 hover:bg-white/10'
                }`}
              >
                <GroupIcon className="w-3.5 h-3.5" />
                {group}
                {hasFailure && <AlertTriangle className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-surface-container border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-on-primary-container flex items-center gap-2">
          <Database className="text-secondary w-4 h-4" />
          Ma'lumotlar zaxirasi
        </h3>
        <p className="text-xs text-on-primary-container/70">
          Butun sayt ma'lumotlarini (baza + yuklangan rasmlar) bitta .zip fayl qilib yuklab oling, yoki avval olingan zaxiradan tiklang.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={isDownloadingBackup}
            onClick={handleDownloadBackup}
            className="px-4 py-2.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isDownloadingBackup ? 'Tayyorlanmoqda...' : "Zaxira nusxasini yuklab olish"}
          </button>

          <input
            ref={restoreFileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleRestoreFileSelected}
          />
          <button
            type="button"
            disabled={isRestoring}
            onClick={() => restoreFileInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-on-primary-container font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
          >
            <Upload className="w-4 h-4" />
            {isRestoring ? 'Tiklanmoqda...' : "Zaxiradan tiklash"}
          </button>
        </div>
      </div>

      <div className="bg-surface-container border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-on-primary-container flex items-center gap-2">
          <Cloud className="text-secondary w-4 h-4" />
          Bulutli zaxira (Telegram / S3 / Google Drive)
        </h3>
        <p className="text-xs text-on-primary-container/70">
          Har kuni soat 04:00'da avtomatik ishga tushadigan zaxira tizimi — yuqoridagi .zip tugmalaridan mustaqil. Bu yerdan hozir zaxira yuborish yoki bulutdagi eng so'nggi nusxadan tiklashni qo'lda ishga tushirishingiz mumkin.
        </p>
        {cloudStatus && (
          <div className="text-xs text-on-primary-container/70 space-y-1">
            <div>
              Telegram: {cloudStatus.telegramConfigured ? '✅ sozlangan' : '❌ sozlanmagan'} ·{' '}
              S3: {cloudStatus.s3Configured ? '✅ sozlangan' : '❌ sozlanmagan'} ·{' '}
              Google Drive: {cloudStatus.googleDriveConfigured ? '✅ sozlangan' : '❌ sozlanmagan'}
            </div>
            <div>
              Oxirgi bulutli zaxira: {cloudStatus.lastBackupDate ? new Date(cloudStatus.lastBackupDate).toLocaleString() : "Hali yo'q"}
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={isCloudBackingUp}
            onClick={handleCloudBackup}
            className="px-4 py-2.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Cloud className="w-4 h-4" />
            {isCloudBackingUp ? 'Yuborilmoqda...' : "Hozir bulutga zaxira yuborish"}
          </button>
          <button
            type="button"
            disabled={isCloudRestoring}
            onClick={handleCloudRestore}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-on-primary-container font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
          >
            <CloudDownload className="w-4 h-4" />
            {isCloudRestoring ? 'Tiklanmoqda...' : "Bulutdagi eng so'nggi zaxiradan tiklash"}
          </button>
        </div>
      </div>

      <div className="bg-surface-container border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-on-primary-container flex items-center gap-2">
          <Hammer className="text-secondary w-4 h-4" />
          Build va Deploy
        </h3>
        <p className="text-xs text-on-primary-container/70">
          Kodni qayta build qiling (frontend o'zgarishlari darhol jonli bo'ladi). Backend (server) kodidagi o'zgarishlar kuchga kirishi uchun buni serverni qayta ishga tushirish bilan birga bajaring.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={isBuilding}
            onClick={handleRebuild}
            className="px-4 py-2.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Hammer className="w-4 h-4" />
            {isBuilding ? 'Build qilinmoqda...' : "Qayta build qilish"}
          </button>

          <button
            type="button"
            disabled={isRestarting}
            onClick={handleRestart}
            className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            {isRestarting ? 'Qayta ishga tushirilmoqda...' : "Serverni qayta ishga tushirish"}
          </button>
        </div>
        {buildOutput !== null && (
          <pre className="max-h-64 overflow-y-auto bg-black/40 text-[10px] text-on-primary-container/80 font-mono p-3 rounded-xl whitespace-pre-wrap break-words">
            {buildOutput || 'Build tugadi (chiqish bo\'sh).'}
          </pre>
        )}
      </div>

      {isLoadingSettings ? (
        <div className="py-12 text-center text-on-primary-container">
          <span className="animate-spin inline-block w-8 h-8 border-4 border-success border-t-transparent rounded-full mb-2"></span>
          <p className="text-sm font-bold">Sozlamalar yuklanmoqda...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(() => {
            // YANGI: guruhlash endi yuqoridagi useMemo'da bir marta
            // hisoblanadi (orderedGroups/byGroup) — bu yerda faqat
            // chizish qoladi, tez-navigatsiya paneli bilan bir xil
            // manbadan foydalaniladi.
            return orderedGroups.map((group) => {
              const GroupIcon = GROUP_ICONS[group] || Globe;
              return (
                <div key={group} id={groupSlug(group)} className="space-y-3 scroll-mt-4">
                  <h3 className="text-sm font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-2">
                    <GroupIcon className="text-secondary w-4 h-4 shrink-0" />
                    {group}
                  </h3>
                  <div className="space-y-4">
                    {byGroup[group].map((s) => {
                      const key = typeof s === 'string' ? s : s.key;
                      const meta = SETTINGS_META[key];
                      // TUZATISH: bu yerda avval isSecret nomdagi so'zlarga qarab
                      // (TOKEN/SECRET/KEY) mahalliy taxmin qilinardi — backend'ning
                      // haqiqiy SECRET_KEYS ro'yxatidan farq qilardi (masalan SMTP_PASS
                      // va GOOGLE_DRIVE_FOLDER_ID backend tomonidan sir deb belgilangan
                      // bo'lsa-da, bu heuristika ularni oddiy matn maydoni sifatida —
                      // parol niqobisiz va ko'z tugmasisiz — ko'rsatardi). Endi
                      // backend qaytargan haqiqiy s.isSecret bayrog'idan foydalaniladi.
                      const isSecret = typeof s === 'object' ? !!s.isSecret : (key.includes('TOKEN') || key.includes('SECRET') || key.includes('KEY'));
                      const isVisible = visibleSecrets[key];
                      const currentVal = settingsValues[key] !== undefined ? settingsValues[key] : (typeof s === 'object' ? s.value || '' : '');

                      return (
                        <div key={key} className="bg-surface-container border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1 md:w-2/5">
                            <p className="text-sm font-bold text-on-primary-container leading-snug">
                              {meta?.label || key}
                            </p>
                            <p className="text-[10px] font-mono text-on-primary-container/40 leading-snug">
                              {key}
                            </p>
                            {meta?.description && (
                              <p className="text-[11px] text-on-primary-container/70 leading-snug">
                                {meta.description}
                              </p>
                            )}
                            {(key === 'TELEGRAM_BOT_TOKEN' || key === 'TELEGRAM_BOT_API_TOKEN') && (
                              <p className="text-[11px] text-warning/90 leading-snug">
                                ⚠️ Saqlanganda bot jarayoni (telegram-bot) avtomatik qayta ishga tushadi — bir necha soniya kuchga kirishi kerak.
                              </p>
                            )}
                            {key === 'TELEGRAM_SUBSCRIBER_BOT_TOKEN' && (
                              <p className="text-[11px] text-warning/90 leading-snug">
                                ⚠️ Saqlanganda faqat shu bot jarayoni (telegram-subscriber-bot) qayta ishga tushadi. Bu bot sponsor/exchange kanallarga admin qilib qo'shilgan bo'lishi shart.
                              </p>
                            )}
                            {settingsStatus[key] && (
                              <p className={`text-xs font-semibold ${settingsStatus[key] === 'success' ? 'text-success' : 'text-red-400'}`}>
                                {settingsStatus[key] === 'success' ? '✅ Saqlandi' : '❌ Saqlanmadi, qayta urinib ko\'ring'}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1">
                              <input
                                type={isSecret && !isVisible ? 'password' : 'text'}
                                value={currentVal}
                                onChange={(e) => setSettingsValues({ ...settingsValues, [key]: e.target.value })}
                                className="w-full p-2.5 bg-surface-container-low border border-white/10 rounded-xl text-on-primary-container font-mono text-xs focus:outline-none focus:ring-2 focus:ring-secondary"
                                placeholder={meta?.placeholder || "Qiymatni kiriting..."}
                              />
                              {meta?.suffix && (
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-on-primary-container/40 font-mono">
                                  {meta.suffix}
                                </span>
                              )}
                            </div>
                            {isSecret && (
                              <button
                                type="button"
                                onClick={() => setVisibleSecrets({ ...visibleSecrets, [key]: !isVisible })}
                                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-on-primary-container transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container flex items-center justify-center"
                                aria-label={isVisible ? 'Sozlamani berkitish' : 'Sozlamani ko\'rsatish'}
                              >
                                {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              disabled={savingKey === key}
                              onClick={() => handleSaveSetting(key)}
                              className="px-4 py-2.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-extrabold text-xs rounded-xl transition-all whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary"
                            >
                              {savingKey === key ? 'Saqlanmoqda...' : 'Saqlash'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction ? confirmDialogConfig[confirmAction].title : ''}
        message={confirmAction ? confirmDialogConfig[confirmAction].message : ''}
        confirmText="Ha, davom etish"
        cancelText="Bekor qilish"
        variant="danger"
        onConfirm={handleConfirmDialogConfirm}
        onCancel={handleConfirmDialogCancel}
      />
    </div>
  );
};
