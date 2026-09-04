import React, { useEffect, useRef, useState } from 'react';
import { Repeat, ShieldOff, ShieldCheck, Send, BarChart3, Users, PauseCircle, PlayCircle, Search, ChevronLeft, ChevronRight, ArrowUpDown, AlertTriangle, Star, MoreVertical, MessageSquare, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';

// ✉️ YANGI (foydalanuvchi talabi — "admin paneldan 'Obunachi yig'ish'
// botining barcha xabarlarini o'zim qo'lda to'g'irlashni xohlayman"):
// bot yuboradigan har bir matn shabloni (src/lib/botMessageDefaults.ts
// bilan bir xil ro'yxat, backenddan keladi).
interface BotMessageTemplate {
  key: string;
  defaultValue: string;
  // Admin hali tahrirlamagan bo'lsa null (standart matn ishlatiladi).
  value: string | null;
  placeholders: string[];
}

interface ExchangeChannel {
  id: number;
  title: string;
  channelUsername: string | null;
  ownerUsername: string | null;
  ownerTelegramId: string;
  isActive: boolean;
  blockedByAdmin: boolean;
  suspendedDueToLapse: boolean;
  // YANGI: kamida 2 ta turli foydalanuvchi shikoyat qilgani sabab
  // avtomatik (admin hali ko'rib chiqmagan) vaqtincha yashirilgan.
  suspendedDueToReports: boolean;
  suspendedReason: string | null;
  earnedSubscribers: number;
  createdAt: string;
  // YANGI (foydalanuvchi talabi — "sponsor kanal" navbat tizimi): true
  // bo'lsa, bu kanal /browse navbatida doim birinchi chiqadi va hech
  // qanday avtomatik mexanizm (kredit/lapse/shikoyat/health-check) uni
  // endi navbatdan chiqarolmaydi.
  isSponsor?: boolean;
  // Backend fallback so'rovida (Prisma include+where mos kelmasa) bu
  // maydon bo'lmasligi mumkin — shu sabab optional va undefined bo'lishi
  // e'tiborga olinadi.
  _count?: { subscriptions: number; reports?: number };
}

export const AdminExchangeTab: React.FC = () => {
  const [channels, setChannels] = useState<ExchangeChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // TUZATILDI: avval BARCHA kanallar bir martada serverdan olinib, butun
  // jadval DOM'da render qilinardi — kanallar soni ko'p bo'lsa sekinlashadi,
  // va admin holat bo'yicha filtrlay olmasdi. Endi qidiruv, holat filtri,
  // saralash va sahifalash server tomonida bajariladi; frontend faqat
  // joriy sahifani (kamida 20 tadan) yuklab oladi.
  const PAGE_SIZE = 20;
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounce qilingan qiymat
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'blocked' | 'reported' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'earnedSubscribers' | 'title'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, active: 0, suspended: 0, blocked: 0, reported: 0 });

  // Qidiruv inputini 400ms debounce qilamiz — har bir harf bosilganda
  // so'rov yubormaslik uchun.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [blockTarget, setBlockTarget] = useState<ExchangeChannel | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  // TUZATILDI: avval block tasdiq (ConfirmDialog) so'rardi, unblock esa
  // hech qanday tasdiqsiz darhol bajarilardi — izchillik yo'q edi.
  // Endi ikkalasi ham tasdiqlanadi (block — sabab kiritish bilan modal,
  // unblock — ConfirmDialog).
  // TUZATILDI (foydalanuvchi talabi — "bonus bersamham Faol/navbatda
  // bo'lmayapti"): avval bu tasdiq faqat blockedByAdmin/suspendedDueToReports
  // bo'lgan kanallar uchun ko'rinardi. Lekin ko'p kanal aslida bloklanmagan —
  // ular botning kanalda admin huquqini yo'qotgani sabab avtomatik NOFAOL
  // qilingan (deactivate-channel), va bunday holatda admin panelida ULARNI
  // qayta tekshirib chiqadigan HECH QANDAY tugma yo'q edi (Bonus faqat kredit
  // sonini o'zgartiradi, u holatga tegmaydi). Endi shu bitta tasdiq/tugma
  // (haqiqiy Telegram tekshiruvi bilan — checkExchangeChannelStillHasAdminBot)
  // har uch holat uchun ham ishlatiladi: bloklangan, shikoyat sabab
  // yashirilgan, VA oddiy "bot admin emas" sabab nofaol bo'lgan kanallar.
  // To'liq kanal obyekti saqlanadi (nafaqat id) — shunda dialog matnini va
  // tugma yorlig'ini kanalning aniq holatiga qarab moslashtirish mumkin.
  const [unblockTarget, setUnblockTarget] = useState<ExchangeChannel | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  // TUZATILDI: avval bu yerda window.confirm() ishlatilardi — sahifadagi
  // boshqa barcha tasdiqlash amallari (bloklash, kredit o'zgartirish)
  // ConfirmDialog'ga o'tkazilgan bo'lsa-da, broadcast tugmasi eskicha
  // native brauzer dialogida qolib ketgan edi (izchillik yo'q edi).
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  // YANGI (foydalanuvchi talabi): ommaviy xabar kimga yuborilishini
  // tanlash — "all" (hammaga, avvalgidek) yoki "no_channel" (faqat
  // hali "Obunachi yig'ish"ga birorta ham kanal ulamaganlarga —
  // masalan kanal ulash haqida eslatma yuborish uchun).
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'no_channel'>('all');

  // YANGI: har bir qatordagi amal tugmalari (Bonus/Bloklash/Blokdan
  // chiqarish) uchun ALOHIDA loading holati — avval bu tugmalar
  // so'rov davomida disabled bo'lmasdi, tez-tez bosilsa bir nechta
  // so'rov ketib qolishi mumkin edi (race condition xavfi). Endi
  // shu kanal ID'si busyRowIds ichida bo'lsa, o'sha qatordagi barcha
  // amal tugmalari disable qilinadi.
  const [busyRowIds, setBusyRowIds] = useState<Set<number>>(new Set());

  // YANGI (admin talabi — "amallar tugmalarini dropdown'ga yig'ish"):
  // avval har bir qatorda 4-5 tagacha alohida tugma bir vaqtning o'zida
  // ko'rsatilardi — kichik ekranlarda siqilib, tartibsiz ko'rinardi.
  // Endi faqat ENG TEZ-TEZ ishlatiladigan amal ("Bonus") qatorda
  // to'g'ridan-to'g'ri ko'rinadi, qolganlari "⋮" tugmasi ostidagi
  // dropdown menyuga yig'ilgan. Bitta vaqtda faqat BITTA qatorning
  // menyusi ochiq turishi mumkin (openActionsMenuId) — boshqa joyga
  // bosilganda yoki boshqa qator menyusi ochilganda avtomatik yopiladi.
  const [openActionsMenuId, setOpenActionsMenuId] = useState<number | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (openActionsMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setOpenActionsMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionsMenuId]);

  const markBusy = (id: number, busy: boolean) => {
    setBusyRowIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  };

  // TUZATILDI: avval adjustBonus native window.prompt() (son va sabab
  // uchun ikkita alohida prompt) orqali ishlardi — bu stillanmaydi,
  // mobil UX'da noqulay (kichik input, formatlanmagan), va validatsiya
  // xatosi faqat window.alert() bilan ko'rsatilardi. Endi shu maqsadda
  // to'liq boshqariladigan modal ishlatiladi, xato inline ko'rsatiladi.
  const [bonusTarget, setBonusTarget] = useState<ExchangeChannel | null>(null);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [bonusError, setBonusError] = useState<string | null>(null);
  const [isSavingBonus, setIsSavingBonus] = useState(false);

  // YANGI (admin talabi): "odamlarni kanaliga odam chaqirish" — ya'ni
  // botning "📋 Kanallarga obuna bo'lish" oqimi orqali foydalanuvchilarga
  // boshqalarning kanallarini taklif qilish — shu yerdan bir tugma bilan
  // to'liq to'xtatiladi/yoqiladi. O'chirilganda: hech kimga endi hech
  // qanday kanal TAKLIF QILINMAYDI (botda "hozircha yo'q" emas, aynan
  // "admin to'xtatgan" degan aniq xabar chiqadi). Mavjud kanallar, ular
  // to'plagan obunachi soni va "Kanalimni qo'shish" funksiyasi BUZILMAYDI
  // — faqat yangi taklif qilish to'xtaydi, va admin istalgan payt qayta
  // yoqishi mumkin.
  const [invitesEnabled, setInvitesEnabled] = useState<boolean | null>(null);
  const [isTogglingInvites, setIsTogglingInvites] = useState(false);
  // TUZATILDI: bu yerda ham window.confirm() ishlatilardi.
  const [showInvitesToggleConfirm, setShowInvitesToggleConfirm] = useState(false);

  const loadInvitesStatus = async () => {
    try {
      const res = await fetch('/api/admin/exchange-channels/invites-status');
      if (res.ok) {
        const data = await res.json();
        setInvitesEnabled(!!data.enabled);
      }
    } catch {
      // jimgina o'tkazib yuborish — tugma "yuklanmoqda" holatida qoladi
    }
  };

  const toggleInvites = () => {
    if (invitesEnabled === null || isTogglingInvites) return;
    setShowInvitesToggleConfirm(true);
  };

  const confirmToggleInvites = async () => {
    setShowInvitesToggleConfirm(false);
    if (invitesEnabled === null) return;
    const next = !invitesEnabled;
    setIsTogglingInvites(true);
    try {
      const res = await fetch('/api/admin/exchange-channels/invites-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
      if (res.ok) {
        setInvitesEnabled(next);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Xatolik yuz berdi.');
      }
    } catch {
      alert('Tarmoq xatoligi yuz berdi.');
    } finally {
      setIsTogglingInvites(false);
    }
  };

  const load = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: statusFilter,
        sortBy,
        sortDir
      });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/exchange-channels?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setTotal(data.total || 0);
        if (data.counts) setCounts(data.counts);
      }
    } catch {
      // jimgina o'tkazib yuborish — pastdagi bo'sh holat ko'rsatiladi
    } finally {
      setIsLoading(false);
    }
  };

  // ✉️ Bot xabarlari (shablonlar) — "Obunachi yig'ish" botining
  // yuboradigan matnlari, admin panelidan to'g'ridan-to'g'ri tahrirlash
  // uchun.
  const [botMessages, setBotMessages] = useState<BotMessageTemplate[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [messagesOpen, setMessagesOpen] = useState(true);
  const [messageSearch, setMessageSearch] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<BotMessageTemplate | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const loadBotMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch('/api/admin/exchange-channels/messages');
      if (res.ok) {
        const data = await res.json();
        setBotMessages(data.messages || []);
      }
    } catch {
      // jimgina o'tkazib yuborish — bo'lim "yuklanmoqda" holatida qoladi
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const startEditingMessage = (msg: BotMessageTemplate) => {
    setSaveError(null);
    setEditingKey(msg.key);
    setEditDraft(msg.value ?? msg.defaultValue);
  };

  const cancelEditingMessage = () => {
    setEditingKey(null);
    setEditDraft('');
    setSaveError(null);
  };

  const saveBotMessage = async (key: string) => {
    if (!editDraft.trim()) {
      setSaveError("Xabar matni bo'sh bo'lishi mumkin emas.");
      return;
    }
    setSavingKey(key);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/exchange-channels/messages/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editDraft })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBotMessages((prev) => prev.map((m) => (m.key === key ? { ...m, value: editDraft } : m)));
        setEditingKey(null);
        setEditDraft('');
      } else {
        setSaveError(data.error || 'Saqlashda xatolik yuz berdi.');
      }
    } catch {
      setSaveError('Tarmoq xatoligi yuz berdi.');
    } finally {
      setSavingKey(null);
    }
  };

  const confirmResetMessage = async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      const res = await fetch(`/api/admin/exchange-channels/messages/${encodeURIComponent(resetTarget.key)}/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        setBotMessages((prev) => prev.map((m) => (m.key === resetTarget.key ? { ...m, value: null } : m)));
        if (editingKey === resetTarget.key) cancelEditingMessage();
      }
    } catch {
      // jimgina o'tkazib yuborish
    } finally {
      setIsResetting(false);
      setResetTarget(null);
    }
  };

  const filteredBotMessages = botMessages.filter((m) => {
    if (!messageSearch.trim()) return true;
    const q = messageSearch.trim().toLowerCase();
    return (
      m.key.toLowerCase().includes(q) ||
      m.defaultValue.toLowerCase().includes(q) ||
      (m.value || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => { loadBotMessages(); }, []);

  useEffect(() => { loadInvitesStatus(); }, []);
  // Qidiruv, holat filtri, saralash yoki sahifa o'zgarganda qayta yuklaymiz.
  useEffect(() => { load(); }, [page, search, statusFilter, sortBy, sortDir]);

  const toggleSort = (field: 'createdAt' | 'earnedSubscribers' | 'title') => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // TUZATILDI: avval har bir amaldan (block/unblock/adjustBonus) so'ng
  // load() chaqirilib, butun kanallar ro'yxati serverdan qayta olinardi
  // — kanallar ko'p bo'lsa, har bir tugma bosilganda keraksiz to'liq
  // refetch bo'lardi. Endi ro'yxat sahifalangani uchun load() faqat
  // JORIY SAHIFANI (kamida 20 tadan) qayta oladi — bu ham arzon, ham
  // to'g'ri: amaldan keyin kanal joriy filtrga (masalan "Faol") endi
  // mos kelmasligi mumkin, shu sabab shunchaki lokal almashtirish
  // noto'g'ri natija berardi (masalan bloklangan kanal "Faol" filtrida
  // hamon ko'rinib turardi).
  const openBlockDialog = (c: ExchangeChannel) => {
    setBlockTarget(c);
    setBlockReason('');
    setBlockError(null);
  };

  const closeBlockDialog = () => {
    if (isBlocking) return;
    setBlockTarget(null);
  };

  const submitBlock = async () => {
    if (!blockTarget) return;
    const reason = blockReason.trim();
    if (reason.length > 500) {
      setBlockError("Sabab 500 belgidan oshmasligi kerak.");
      return;
    }
    setBlockError(null);
    setIsBlocking(true);
    markBusy(blockTarget.id, true);
    try {
      const res = await fetch(`/api/admin/exchange-channels/${blockTarget.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        setBlockTarget(null);
        load();
      } else {
        setBlockError(data.error || 'Xatolik yuz berdi.');
      }
    } catch {
      setBlockError('Tarmoq xatoligi yuz berdi.');
    } finally {
      setIsBlocking(false);
      markBusy(blockTarget.id, false);
    }
  };

  const doUnblock = async (id: number) => {
    setIsUnblocking(true);
    markBusy(id, true);
    try {
      const res = await fetch(`/api/admin/exchange-channels/${id}/unblock`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        load();
        // YANGI (foydalanuvchi talabi — "kanallardan chiqib ketgan
        // foydalanuvchini admin paneldan navbatga qo'shib qo'ydim" bugi
        // tuzatildi): qoidabuzarlik (lapse) sababli to'xtatilgan kanal
        // uchun server endi bot-admin holatini EMAS, foydalanuvchi
        // haqiqatan qaytadan obuna bo'lganini tekshiradi — hali
        // bo'lmagan bo'lsa, kanal ATAYLAB NOFAOL qoldiriladi (bu
        // "kechirib yuborish" emas).
        if (data.lapseStillActive) {
          const list = (data.stillLapsedChannels || []).join(', ');
          alert(
            list
              ? `Tekshirildi: foydalanuvchi hali ham quyidagi kanal(lar)ga obuna bo'lmagan: ${list}. Shu sabab kanal ATAYLAB NOFAOL holatda qoldirildi — bu qoidabuzarlik uchun jazo, admin uni bekor qila olmaydi. Foydalanuvchi qaytadan obuna bo'lgach, tizim buni o'zi avtomatik aniqlab, kanalni qayta navbatga qo'shadi.`
              : `Tekshirib bo'lmadi (Telegram bilan bog'lanishda vaqtinchalik xatolik) — kanal ehtiyot yuzasidan NOFAOL holatda qoldirildi. Birozdan so'ng qayta urinib ko'ring.`
          );
          return;
        }
        // YANGI: server haqiqiy Telegram tekshiruvini o'tkazgach ham bot
        // hamon admin emasligi tasdiqlansa (botStillAdmin: false), kanal
        // baribir NOFAOL qolaveradi — jadval o'zi buni "Nofaol" yorlig'i
        // bilan ko'rsatadi, lekin admin nega hech narsa o'zgarmaganini
        // tushunmasligi mumkin, shu sabab aniq sabab bilan ogohlantiramiz.
        if (!data.botStillAdmin) {
          alert("Tekshirildi: bot bu kanalda hamon admin emas (yoki kanal topilmadi), shu sabab kanal NOFAOL holatda qoldi. Avval botni kanalga qayta admin qilib qo'shing, keyin shu tugmani qayta bosing.");
        }
      } else if (!res.ok) {
        alert(data.error || 'Xatolik yuz berdi.');
      }
    } catch {
      alert('Tarmoq xatoligi yuz berdi.');
    } finally {
      setIsUnblocking(false);
      markBusy(id, false);
      setUnblockTarget(null);
    }
  };

  // YANGI (foydalanuvchi talabi — "sponsor kanal" navbat tizimi): admin
  // istalgan ODDIY (foydalanuvchi qo'shgan) kanalni bitta tugma bilan
  // sponsor deb belgilaydi (yoki bekor qiladi). Sponsor bo'lgan kanal
  // /browse navbatida doim birinchi chiqadi, kredit maksimal qilinadi va
  // avtomatik chiqarib tashlash mexanizmlaridan butunlay himoyalanadi.
  // TUZATILDI (foydalanuvchi talabi): kredit miqdori endi qattiq
  // kodlangan emas — admin har safar (yangi sponsor belgilaganda YOKI
  // allaqachon sponsor bo'lgan kanalning kreditini keyinroq o'zgartirmoqchi
  // bo'lganda) o'zi xohlagan sonni kiritadi. Bazadagi ustun 32-bitli
  // INTEGER bo'lgani uchun eng ko'pi 2 147 483 647 (INT32_MAX) qabul
  // qilinadi — bundan katta son kiritilsa server aniq xato qaytaradi.
  const SPONSOR_CREDIT_MAX = 2147483647;
  const doToggleSponsor = async (channel: ExchangeChannel) => {
    const makingSponsorNow = !channel.isSponsor;
    let credit: number | undefined;

    if (makingSponsorNow) {
      const input = window.prompt(
        `"${channel.title}" kanali SPONSOR deb belgilanadi — u doim navbatning birinchi o'rnida chiqadi va avtomatik chiqarib tashlanishdan himoyalanadi.\n\nKredit (obunachi soni) qancha bo'lsin? (bo'sh qoldirsangiz — eng katta ruxsat etilgan qiymat, ${SPONSOR_CREDIT_MAX.toLocaleString('en-US')}, qo'yiladi)`,
        String(SPONSOR_CREDIT_MAX)
      );
      if (input === null) return; // bekor qilindi
      if (input.trim() !== '') {
        const parsed = Number(input.trim());
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
          alert("Kredit musbat butun son bo'lishi kerak.");
          return;
        }
        if (parsed > SPONSOR_CREDIT_MAX) {
          alert(`Kredit ${SPONSOR_CREDIT_MAX.toLocaleString('en-US')} dan katta bo'la olmaydi (bazadagi ustunning texnik chegarasi).`);
          return;
        }
        credit = parsed;
      }
    } else if (channel.isSponsor) {
      // Allaqachon sponsor — tugma bosilsa sponsorlikni BEKOR qilamiz
      // (kredit so'ralmaydi, chunki bekor qilishda kredit ahamiyatsiz).
      if (!window.confirm(`"${channel.title}" kanalining SPONSOR holati bekor qilinsinmi? U endi navbatda birinchi turmaydi va oddiy kanal kabi ishlaydi.`)) {
        return;
      }
    }

    markBusy(channel.id, true);
    try {
      const res = await fetch(`/api/admin/exchange-channels/${channel.id}/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSponsor: makingSponsorNow, ...(credit !== undefined ? { credit } : {}) })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        load();
      } else {
        alert(data.error || 'Xatolik yuz berdi.');
      }
    } catch {
      alert('Tarmoq xatoligi yuz berdi.');
    } finally {
      markBusy(channel.id, false);
    }
  };

  // Mavjud sponsor kanalning kreditini (sponsorlikni yoqib-o'chirmasdan)
  // qayta o'zgartirish uchun — "Sponsor ✓" tugmasi endi sponsorlikni
  // bekor qilish o'rniga shu funksiyani chaqiradi (aniqroq va xavfsizroq:
  // tasodifan sponsorlik bekor bo'lib qolmaydi).
  const doEditSponsorCredit = async (channel: ExchangeChannel) => {
    const input = window.prompt(
      `"${channel.title}" — sponsor krediti (obunachi soni) qancha bo'lsin?`,
      String(channel.earnedSubscribers ?? SPONSOR_CREDIT_MAX)
    );
    if (input === null || input.trim() === '') return;
    const parsed = Number(input.trim());
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      alert("Kredit musbat butun son bo'lishi kerak.");
      return;
    }
    if (parsed > SPONSOR_CREDIT_MAX) {
      alert(`Kredit ${SPONSOR_CREDIT_MAX.toLocaleString('en-US')} dan katta bo'la olmaydi (bazadagi ustunning texnik chegarasi).`);
      return;
    }
    markBusy(channel.id, true);
    try {
      const res = await fetch(`/api/admin/exchange-channels/${channel.id}/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSponsor: true, credit: parsed })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        load();
      } else {
        alert(data.error || 'Xatolik yuz berdi.');
      }
    } catch {
      alert('Tarmoq xatoligi yuz berdi.');
    } finally {
      markBusy(channel.id, false);
    }
  };

  // YANGI: eski "xush kelibsiz bonusi" bugi tufayli bonus olmay qolgan
  // foydalanuvchilarga (yoki boshqa istisno holatlarda) qo'lda +/- tuzatish
  // kiritish uchun. Musbat son bonus qo'shadi, manfiy son kamaytiradi.
  // Modal ochish — haqiqiy so'rov submitBonus() da yuboriladi.
  const adjustBonus = (c: ExchangeChannel) => {
    setBonusTarget(c);
    setBonusAmount('');
    setBonusReason('');
    setBonusError(null);
  };

  const closeBonusDialog = () => {
    if (isSavingBonus) return;
    setBonusTarget(null);
  };

  const submitBonus = async () => {
    if (!bonusTarget) return;
    const trimmed = bonusAmount.trim();
    const amount = parseInt(trimmed, 10);
    if (!trimmed || !Number.isFinite(amount) || String(amount) !== trimmed || amount === 0) {
      setBonusError("Iltimos, nolga teng bo'lmagan butun son kiriting (masalan: 5 yoki -5).");
      return;
    }
    // TUZATILDI (admin talabi — "cheklovni olib tashlash kerak"): avval
    // bir martada eng ko'pi bilan 1000 birlik o'zgartirish mumkin edi.
    // Bu cheklov olib tashlandi.
    setBonusError(null);
    setIsSavingBonus(true);
    markBusy(bonusTarget.id, true);
    try {
      const res = await fetch(`/api/admin/exchange-channels/${bonusTarget.id}/adjust-bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: bonusReason.trim() || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        load();
        setBonusTarget(null);
      } else {
        setBonusError(data.error || 'Xatolik yuz berdi.');
      }
    } catch {
      setBonusError('Tarmoq xatoligi yuz berdi.');
    } finally {
      setIsSavingBonus(false);
      markBusy(bonusTarget.id, false);
    }
  };

  // TUZATILDI: avval bu funksiya bitta HTTP so'rov davomida barcha
  // foydalanuvchilarga ketma-ket yuborilishini kutib turardi (5000
  // foydalanuvchida ~250+ soniya) — deploy platformasi yoki brauzer
  // so'rovni timeout qilib yuborishi mumkin edi. Endi backend darhol
  // jobId bilan javob qaytaradi, biz esa progress tugaguncha
  // /broadcast/status/:jobId ni pollaymiz.
  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setShowBroadcastConfirm(true);
  };

  const confirmSendBroadcast = async () => {
    setShowBroadcastConfirm(false);
    setIsSendingBroadcast(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/admin/exchange-channels/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMsg, audience: broadcastAudience })
      });
      const data = await res.json();
      if (!res.ok || !data.jobId) {
        alert(data.error || 'Xatolik yuz berdi.');
        setIsSendingBroadcast(false);
        return;
      }
      setBroadcastMsg('');
      const jobId = data.jobId;
      const poll = async () => {
        try {
          const statusRes = await fetch(`/api/admin/exchange-channels/broadcast/status/${jobId}`);
          const statusData = await statusRes.json().catch(() => ({}));
          if (!statusRes.ok) {
            setIsSendingBroadcast(false);
            return;
          }
          setBroadcastResult({ total: statusData.total, sent: statusData.sent, failed: statusData.failed });
          if (statusData.status === 'running') {
            setTimeout(poll, 1500);
          } else {
            setIsSendingBroadcast(false);
          }
        } catch {
          setIsSendingBroadcast(false);
        }
      };
      poll();
    } catch {
      alert('Tarmoq xatoligi yuz berdi.');
      setIsSendingBroadcast(false);
    }
  };

  // YANGI: earnedSubscribers (boshqa kanallarga obuna bo'lib to'plangan
  // KREDIT) va _count.subscriptions (kanalning O'ZIGA HAQIQIY obuna
  // bo'lgan odamlar soni) ikki xil narsa — bu farq suiiste'mol/firibgarlikni
  // aniqlashning muhim signali (masalan bot/soxta obunachilar bilan
  // "obuna bo'ldim" deb belgilanib, lekin haqiqatda kanaldan chiqib
  // ketilgan holatlar). Backend buni allaqachon _count orqali qaytaradi,
  // shu sabab UI'da ham ko'rsatamiz va katta og'ish bo'lsa ogohlantiramiz.
  const SUSPICIOUS_GAP_MIN = 5;
  const SUSPICIOUS_GAP_RATIO = 3;
  const isSuspicious = (c: ExchangeChannel) => {
    if (c._count === undefined) return false;
    const real = c._count.subscriptions;
    const gap = c.earnedSubscribers - real;
    return gap >= SUSPICIOUS_GAP_MIN && c.earnedSubscribers >= real * SUSPICIOUS_GAP_RATIO;
  };

  const statusBadge = (c: ExchangeChannel) => {
    if (c.blockedByAdmin) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">Admin bloklagan</span>;
    }
    if (c.suspendedDueToReports) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20">Shikoyat tufayli</span>;
    }
    if (c.suspendedDueToLapse) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Qoidabuzarlik (avto)</span>;
    }
    if (c.isActive) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-success-container/10 text-success border border-success/20">Faol / navbatda</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-white/5 text-gray-400 border border-white/10">Nofaol</span>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
        <button
          type="button"
          onClick={() => setMessagesOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 cursor-pointer text-left"
        >
          <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2">
            <MessageSquare className="text-secondary w-5 h-5" />
            Bot xabarlari ({botMessages.length})
          </h2>
          {messagesOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        <p className="text-xs text-gray-400">
          "Obunachi yig'ish" (AktivObunalar) botining yuboradigan barcha matnlari — shu yerdan, kodga tegmasdan tahrirlanadi.
          Matn ichidagi <code className="px-1 py-0.5 bg-surface-container rounded">{'{{shunday}}'}</code> ko'rinishidagi qismlarni o'chirmang — ular yuborilayotganda haqiqiy son/nomga almashtiriladi.
          Tahrir botga 2 daqiqa ichida avtomatik yetib boradi (botni qayta ishga tushirish shart emas).
        </p>

        {messagesOpen && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                placeholder="Kalit yoki matn bo'yicha qidirish..."
                className="w-full pl-9 pr-3 py-2 bg-surface-container border border-white/10 rounded-xl text-on-primary-container text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
              />
            </div>

            {isLoadingMessages ? (
              <p className="text-xs text-gray-400">Yuklanmoqda...</p>
            ) : filteredBotMessages.length === 0 ? (
              <p className="text-xs text-gray-400">Hech narsa topilmadi.</p>
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {filteredBotMessages.map((msg) => {
                  const isEditing = editingKey === msg.key;
                  const isEdited = msg.value !== null;
                  return (
                    <div key={msg.key} className="p-3 bg-surface-container rounded-xl border border-white/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-[11px] text-secondary font-mono break-all">{msg.key}</code>
                            {isEdited && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-success-container/10 text-success border border-success/20">
                                Tahrirlangan
                              </span>
                            )}
                          </div>
                          {msg.placeholders.length > 0 && (
                            <p className="text-[10px] text-gray-500 mt-1">
                              O'zgaruvchilar: {msg.placeholders.map((p) => `{{${p}}}`).join(', ')}
                            </p>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-2 shrink-0">
                            {isEdited && (
                              <button
                                type="button"
                                onClick={() => setResetTarget(msg)}
                                title="Standartga qaytarish"
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 hover:text-on-primary-container transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditingMessage(msg)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors cursor-pointer"
                            >
                              Tahrirlash
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={4}
                            maxLength={4000}
                            className="w-full p-3 bg-surface border border-white/10 rounded-xl text-on-primary-container text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50 font-mono"
                          />
                          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveBotMessage(msg.key)}
                              disabled={savingKey === msg.key}
                              className="px-4 py-1.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-black text-xs rounded-xl transition-all cursor-pointer"
                            >
                              {savingKey === msg.key ? 'Saqlanmoqda...' : 'Saqlash'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingMessage}
                              disabled={savingKey === msg.key}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              Bekor qilish
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-on-primary-container mt-2 whitespace-pre-wrap break-words">
                          {msg.value ?? msg.defaultValue}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!resetTarget}
        title="Standart matnga qaytarish"
        message={resetTarget ? `"${resetTarget.key}" xabarini standart (asl) matniga qaytarasizmi? Sizning tahriringiz o'chib ketadi.` : ''}
        confirmText="Ha, standartga qaytarish"
        cancelText="Bekor qilish"
        onConfirm={confirmResetMessage}
        onCancel={() => setResetTarget(null)}
        isConfirming={isResetting}
        confirmingText="Qaytarilmoqda..."
      />

      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-surface border border-outline/20 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10 text-red-500 border border-red-500/20">
                <ShieldOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Kanalni bloklash</h3>
                <p className="text-xs text-on-primary-container mt-1 leading-relaxed">
                  "{blockTarget.title}" butunlay to'xtatiladi va navbatga qaytmaydi, toki siz o'zingiz blokdan chiqarmaguningizcha.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-on-primary-container block mb-1">
                  Bloklash sababi (ixtiyoriy — bo'sh qoldirilsa standart matn saqlanadi)
                </label>
                {/* TUZATILDI: avval sabab qattiq kodlangan edi ("Admin
                    tomonidan bloklangan.") — admin nima uchun bloklaganini
                    yoza olmasdi, keyinchalik faqat audit logdan qidirish
                    kerak bo'lardi. Endi shu yerda yozilgan matn
                    suspendedReason sifatida saqlanadi va kanal holatida
                    (jadval va bot tomonida) darhol ko'rinadi. */}
                <textarea
                  autoFocus
                  rows={3}
                  maxLength={500}
                  value={blockReason}
                  onChange={(e) => { setBlockReason(e.target.value); setBlockError(null); }}
                  placeholder="Masalan: spam kontent tarqatilmoqda, botlar bilan sun'iy obunachi to'plangan va h.k."
                  className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-on-surface text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
              </div>
              {blockError && (
                <p className="text-xs text-red-400 font-semibold">{blockError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeBlockDialog}
                disabled={isBlocking}
                className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high disabled:opacity-50 text-on-surface font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={submitBlock}
                disabled={isBlocking}
                className="px-5 py-2.5 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {isBlocking ? 'Bloklanmoqda...' : 'Bloklash'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={unblockTarget !== null}
        title={unblockTarget?.blockedByAdmin ? 'Kanalni blokdan chiqarish' : (unblockTarget?.suspendedDueToReports ? 'Kanalni qayta faollashtirish' : (unblockTarget?.suspendedDueToLapse ? 'Obunani qayta tekshirish' : 'Kanalni qayta tekshirish'))}
        message={
          unblockTarget?.blockedByAdmin
            ? 'Bu kanal qaytadan faollashtiriladi va navbatga qaytadi. Davom etilsinmi?'
            : unblockTarget?.suspendedDueToReports
              ? 'Shikoyatlar sabab yashirilgan bu kanal qaytadan faollashtiriladi va navbatga qaytadi. Davom etilsinmi?'
              : unblockTarget?.suspendedDueToLapse
                ? "Bu kanal qoidabuzarlik (egasi boshqa kanaldan chiqib ketgani) sababli to'xtatilgan. Telegram orqali egasi HAQIQATAN qaytadan obuna bo'lganmi tekshiriladi — agar hali obuna bo'lmagan bo'lsa, kanal ATAYLAB NOFAOL holatda QOLDIRILADI (bu bot admin holatiga umuman bog'liq emas). Davom etilsinmi?"
                : "Bot bu kanalda hali ham admin ekanligi Telegram orqali qayta tekshiriladi. Agar bot admin bo'lsa — kanal FAOL bo'ladi; bo'lmasa — NOFAOL holatda qoladi va sabab qayta ko'rsatiladi. Davom etilsinmi?"
        }
        confirmText={unblockTarget?.blockedByAdmin ? 'Blokdan chiqarish' : (unblockTarget?.suspendedDueToReports ? 'Qayta faollashtirish' : (unblockTarget?.suspendedDueToLapse ? 'Obunani tekshirish' : 'Qayta tekshirish'))}
        cancelText="Bekor qilish"
        isConfirming={isUnblocking}
        confirmingText="Tekshirilmoqda..."
        onConfirm={() => unblockTarget !== null && doUnblock(unblockTarget.id)}
        onCancel={() => setUnblockTarget(null)}
      />

      {bonusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
          <div className="bg-surface border border-outline/20 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-secondary-container/10 text-secondary-container border border-secondary-container/20">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Obunachi sonini tuzatish</h3>
                <p className="text-xs text-on-primary-container mt-1 leading-relaxed">
                  "{bonusTarget.title}" — hozirgi: <span className="font-bold">{bonusTarget.earnedSubscribers}</span> ta.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-on-primary-container block mb-1">
                  Miqdor (musbat — qo'shish, manfiy — ayirish)
                </label>
                <input
                  type="number"
                  autoFocus
                  value={bonusAmount}
                  onChange={(e) => { setBonusAmount(e.target.value); setBonusError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitBonus(); }}
                  placeholder="Masalan: 5 yoki -5"
                  className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-on-surface text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-primary-container block mb-1">
                  Sabab (ixtiyoriy, izoh sifatida saqlanadi)
                </label>
                <input
                  type="text"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitBonus(); }}
                  placeholder="Masalan: qochib ketgan xush kelibsiz bonusini qaytarish"
                  className="w-full p-2.5 bg-surface-container border border-white/10 rounded-xl text-on-surface text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
                />
              </div>
              {bonusError && (
                <p className="text-xs text-red-400 font-semibold">{bonusError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeBonusDialog}
                disabled={isSavingBonus}
                className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high disabled:opacity-50 text-on-surface font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={submitBonus}
                disabled={isSavingBonus || !bonusAmount.trim()}
                className="px-5 py-2.5 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer bg-secondary-container text-on-secondary-container hover:brightness-110 disabled:opacity-50"
              >
                {isSavingBonus ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
        <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4">
          <Send className="text-secondary w-5 h-5" />
          Telegram orqali ommaviy xabar
        </h2>
        <p className="text-xs text-gray-400">
          Bu xabar Telegram hisobini ulagan (bloklanmagan, opt-out qilmagan) foydalanuvchilarga botdan yuboriladi.
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-on-primary-container">
            <input
              type="radio"
              name="broadcastAudience"
              checked={broadcastAudience === 'all'}
              onChange={() => setBroadcastAudience('all')}
            />
            Hammaga
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-on-primary-container">
            <input
              type="radio"
              name="broadcastAudience"
              checked={broadcastAudience === 'no_channel'}
              onChange={() => setBroadcastAudience('no_channel')}
            />
            Faqat kanal ulamaganlarga
          </label>
          <button
            type="button"
            onClick={() => {
              setBroadcastAudience('no_channel');
              setBroadcastMsg(
                "🔒 Botdan to'liq foydalanish uchun kanalingizni ulang.\n\n" +
                "1️⃣ Eng avval botni o'z kanalingizga admin qilib qo'ying (Kanal → Administratorlar → Admin qo'shish → botni tanlang).\n" +
                "2️⃣ Keyin kanalingiz havolasini (yoki @username'ini) bizga shu yerga tashlang."
              );
            }}
            className="ml-auto px-3 py-1.5 rounded-lg border border-outline-variant/30 text-gray-300 hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            📋 Shablon: kanal ulash eslatmasi
          </button>
        </div>

        <textarea
          value={broadcastMsg}
          onChange={(e) => setBroadcastMsg(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="Masalan: Diqqat! Ertaga texnik ishlar tufayli sayt 2 soatga o'chirib qo'yiladi..."
          className="w-full p-3 bg-surface-container border border-white/10 rounded-xl text-on-primary-container text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
        />
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={sendBroadcast}
            disabled={isSendingBroadcast || !broadcastMsg.trim()}
            className="px-6 py-2.5 bg-secondary hover:brightness-110 disabled:opacity-50 text-on-secondary font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isSendingBroadcast ? 'Yuborilmoqda...' : broadcastAudience === 'no_channel' ? 'Kanal ulamaganlarga yuborish' : 'Hammaga yuborish'}
          </button>
          {broadcastResult && (
            <p className="text-xs text-gray-400">
              Jami: {broadcastResult.total}, ✅ {broadcastResult.sent}, ❌ {broadcastResult.failed}
              {isSendingBroadcast && ' — fonda davom etmoqda...'}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showBroadcastConfirm}
        title="Ommaviy xabar yuborish"
        message={
          broadcastAudience === 'no_channel'
            ? "Bu xabar Telegram ulangan, LEKIN hali birorta ham kanal ulamagan foydalanuvchilarga (opt-out qilmaganlarga) yuboriladi. Davom etilsinmi?"
            : "Bu xabar Telegram ulangan BARCHA foydalanuvchilarga (opt-out qilmaganlarga) yuboriladi. Davom etilsinmi?"
        }
        confirmText="Ha, yuborish"
        cancelText="Bekor qilish"
        onConfirm={confirmSendBroadcast}
        onCancel={() => setShowBroadcastConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showInvitesToggleConfirm}
        title={invitesEnabled ? "Taklif qilishni to'xtatish" : "Taklif qilishni yoqish"}
        message={
          invitesEnabled
            ? "Kanallarga obuna bo'lish orqali odamlarni taklif qilish TO'LIQ TO'XTATILADI — hech kimga endi hech qanday kanal taklif qilinmaydi (mavjud kanallar va statistikaga tegilmaydi). Davom etilsinmi?"
            : "Kanallarga obuna bo'lish orqali odamlarni taklif qilish QAYTA YOQILADI. Davom etilsinmi?"
        }
        confirmText="Ha, davom etish"
        cancelText="Bekor qilish"
        variant={invitesEnabled ? 'danger' : 'default'}
        onConfirm={confirmToggleInvites}
        onCancel={() => setShowInvitesToggleConfirm(false)}
      />

      <div className={`bg-primary-container border rounded-2xl p-6 md:p-8 shadow-2xl space-y-4 ${invitesEnabled === false ? 'border-red-500/40' : 'border-outline-variant/20'}`}>
        <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4">
          <Users className="text-secondary w-5 h-5" />
          Kanallarga taklif qilish (odam chaqirish)
        </h2>
        <p className="text-xs text-gray-400">
          Bu — botdagi "📋 Kanallarga obuna bo'lish" oqimi orqali foydalanuvchilarga boshqalarning kanallarini obuna bo'lish uchun taklif qilish mexanizmi.
          O'chirilganda hech kimga endi hech qanday kanal taklif qilinmaydi — mavjud kanallar, ularning statistikasi va "Kanalimni qo'shish" funksiyasi buzilmaydi, faqat yangi taklif to'xtaydi.
          Istalgan payt qayta yoqishingiz mumkin.
        </p>
        <div className="flex items-center justify-between gap-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
            invitesEnabled === null
              ? 'bg-white/5 text-gray-400 border-white/10'
              : invitesEnabled
              ? 'bg-success-container/10 text-success border-success/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {invitesEnabled === null ? 'Yuklanmoqda...' : invitesEnabled ? '✅ Yoqilgan' : '⏸ To\'xtatilgan'}
          </span>
          <button
            onClick={toggleInvites}
            disabled={invitesEnabled === null || isTogglingInvites}
            className={`px-6 py-2.5 disabled:opacity-50 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              invitesEnabled
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                : 'bg-secondary hover:brightness-110 text-on-secondary'
            }`}
          >
            {invitesEnabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            {isTogglingInvites ? 'Bajarilmoqda...' : invitesEnabled ? "To'liq to'xtatish" : 'Qayta yoqish'}
          </button>
        </div>
      </div>

      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4 mb-4">
          <BarChart3 className="text-secondary w-5 h-5" />
          Statistika
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="text-2xl font-black text-on-primary-container">{counts.all}</div>
            <div className="text-xs text-gray-400 mt-1">Jami kanal</div>
          </div>
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="text-2xl font-black text-success">{counts.active}</div>
            <div className="text-xs text-gray-400 mt-1">Faol / navbatda</div>
          </div>
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="text-2xl font-black text-yellow-400">{counts.suspended}</div>
            <div className="text-xs text-gray-400 mt-1">Qoidabuzarlik (avto)</div>
          </div>
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="text-2xl font-black text-orange-400">{counts.reported}</div>
            <div className="text-xs text-gray-400 mt-1">Shikoyat tufayli</div>
          </div>
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="text-2xl font-black text-red-400">{counts.blocked}</div>
            <div className="text-xs text-gray-400 mt-1">Admin bloklagan</div>
          </div>
        </div>
      </div>

      <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-on-primary-container flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
          <Repeat className="text-secondary w-5 h-5" />
          Obuna almashish kanallari ({total})
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Bu kanallarni foydalanuvchilarning o'zi Telegram bot orqali qo'shadi (Sponsorlar bo'limidan mustaqil).
          Nomaqbul yoki qoidabuzar kanalni shu yerdan bloklashingiz mumkin.
          "Kredit" — kanal egasi boshqa kanallarga obuna bo'lib to'plagan son; "real" — kanalning o'ziga haqiqiy obuna bo'lganlar soni.
          Kredit realdan sezilarli ko'p bo'lsa <AlertTriangle className="w-3 h-3 inline text-red-400" /> bilan belgilanadi — suiiste'mol ehtimoli.
        </p>

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Kanal nomi, username yoki egasi bo'yicha qidirish..."
              className="w-full pl-9 pr-3 py-2.5 bg-surface-container border border-white/10 rounded-xl text-on-primary-container text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
            className="px-3 py-2.5 bg-surface-container border border-white/10 rounded-xl text-on-primary-container text-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/50 cursor-pointer"
          >
            <option value="all">Barcha holatlar</option>
            <option value="active">Faol / navbatda</option>
            <option value="suspended">Qoidabuzarlik (avto)</option>
            <option value="reported">Shikoyat tufayli</option>
            <option value="blocked">Admin bloklagan</option>
            <option value="inactive">Nofaol (boshqa)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-xs text-left">
            <thead>
              <tr className="text-on-primary-container font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('title')}>
                  <span className="inline-flex items-center gap-1">Kanal <ArrowUpDown className="w-3 h-3 opacity-60" /></span>
                </th>
                <th className="py-3 px-4">Egasi</th>
                <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort('earnedSubscribers')}>
                  <span className="inline-flex items-center gap-1">Kredit / Real <ArrowUpDown className="w-3 h-3 opacity-60" /></span>
                </th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {channels.map((c) => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-on-primary-container">
                    {c.title}
                    {c.channelUsername && <div className="text-gray-400 font-normal">{c.channelUsername}</div>}
                  </td>
                  <td className="py-3.5 px-4">
                    {c.ownerUsername ? `@${c.ownerUsername}` : c.ownerTelegramId}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-on-primary-container">
                      {c.earnedSubscribers} <span className="text-gray-500 font-normal">kredit</span>
                    </div>
                    <div className={`flex items-center gap-1 mt-0.5 ${isSuspicious(c) ? 'text-red-400 font-bold' : 'text-gray-400'}`} title="Kanalning o'ziga haqiqiy (getChatMember bilan tasdiqlangan) obuna bo'lganlar soni">
                      {isSuspicious(c) && <AlertTriangle className="w-3 h-3 shrink-0" />}
                      {c._count !== undefined ? `${c._count.subscriptions} real` : '— real (noma\'lum)'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {statusBadge(c)}
                    {!!c._count?.reports && (
                      <div className="text-orange-400 font-bold mt-1">🚩 {c._count.reports} ta shikoyat</div>
                    )}
                    {c.suspendedReason && <div className="text-gray-500 mt-1">{c.suspendedReason}</div>}
                  </td>
                  <td className="py-3.5 px-4">
                    <div ref={openActionsMenuId === c.id ? actionsMenuRef : undefined} className="relative flex items-center gap-2">
                      <button
                        onClick={() => adjustBonus(c)}
                        disabled={busyRowIds.has(c.id)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container flex items-center gap-1.5"
                        title="Obunachi sonini qo'lda tuzatish"
                      >
                        <Users className="w-4 h-4" /> Bonus
                      </button>

                      <button
                        onClick={() => setOpenActionsMenuId(openActionsMenuId === c.id ? null : c.id)}
                        disabled={busyRowIds.has(c.id)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container"
                        title="Boshqa amallar"
                        aria-label="Boshqa amallar"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openActionsMenuId === c.id && (
                        <div className="absolute right-0 top-full mt-1 z-20 min-w-[220px] bg-surface-container border border-white/10 rounded-xl shadow-2xl py-1.5 flex flex-col">
                          {/* YANGI (foydalanuvchi talabi — "sponsor kanal" navbat tizimi):
                              admin bu tugma orqali istalgan (odatiy foydalanuvchi qo'shgan)
                              kanalni sponsor deb belgilaydi — sponsor kanal /browse navbatida
                              doim birinchi chiqadi va avtomatik chiqarib tashlanishdan
                              himoyalanadi (kredit ham maksimal darajaga o'rnatiladi). */}
                          <button
                            onClick={() => { setOpenActionsMenuId(null); c.isSponsor ? doEditSponsorCredit(c) : doToggleSponsor(c); }}
                            disabled={busyRowIds.has(c.id)}
                            className={`px-3 py-2 text-left disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold ${c.isSponsor ? 'text-amber-400 hover:bg-amber-500/10' : 'text-on-primary-container hover:bg-white/5'}`}
                          >
                            <Star className="w-4 h-4 shrink-0" /> {c.isSponsor ? 'Sponsor ✓ (kreditni tahrirlash)' : 'Sponsor deb belgilash'}
                          </button>
                          {c.isSponsor && (
                            <button
                              onClick={() => { setOpenActionsMenuId(null); doToggleSponsor(c); }}
                              disabled={busyRowIds.has(c.id)}
                              className="px-3 py-2 text-left text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
                            >
                              <Star className="w-4 h-4 shrink-0" /> Sponsorlikni bekor qilish
                            </button>
                          )}
                          {/* TUZATILDI (foydalanuvchi talabi): avval bu tugma faqat
                              blockedByAdmin/suspendedDueToReports bo'lganda ko'rinardi.
                              Endi bot admin-huquqini yo'qotgani sabab oddiy NOFAOL
                              bo'lgan (hali bloklanmagan/shikoyat qilinmagan) kanallar
                              uchun ham ko'rinadi — aks holda ularni qayta faollashtirish
                              uchun HECH QANDAY yo'l yo'q edi (Bonus tugmasi faqat kredit
                              sonini o'zgartiradi, holatga tegmaydi). Sponsor kanallar bu
                              yerda chiqarilmaydi — ular allaqachon doim faol. */}
                          {(c.blockedByAdmin || c.suspendedDueToReports || (!c.isActive && !c.isSponsor)) && (
                            <button
                              onClick={() => { setOpenActionsMenuId(null); setUnblockTarget(c); }}
                              disabled={busyRowIds.has(c.id)}
                              className="px-3 py-2 text-left text-on-primary-container hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
                            >
                              <ShieldCheck className="w-4 h-4 shrink-0" /> {c.blockedByAdmin ? 'Blokdan chiqarish' : (c.suspendedDueToReports ? 'Qayta faollashtirish' : (c.suspendedDueToLapse ? 'Obunani tekshirish' : 'Qayta tekshirish'))}
                            </button>
                          )}
                          {!c.blockedByAdmin && (
                            <button
                              onClick={() => { setOpenActionsMenuId(null); openBlockDialog(c); }}
                              disabled={busyRowIds.has(c.id)}
                              className="px-3 py-2 text-left text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
                            >
                              <ShieldOff className="w-4 h-4 shrink-0" /> Bloklash
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-on-primary-container">
                    {search || statusFilter !== 'all' ? 'Bu filtrga mos kanal topilmadi' : "Hali kanal qo'shilmagan"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-white/5">
            <span className="text-xs text-gray-400">
              {total} tadan {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} ko'rsatilmoqda — {page}/{totalPages} sahifa
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                title="Oldingi sahifa"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                title="Keyingi sahifa"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
