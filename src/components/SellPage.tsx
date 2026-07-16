import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Startup, Category } from '../types';
import { CATEGORY_FIELDS } from '../categoryFields';
import { apiFetch as fetch } from '../lib/api';

interface SellPageProps {
  onAddStartup: (startup: Startup) => void;
  onActionToast: (message: string) => void;
  setView: (view: string) => void;
  categories: Category[];
  isEditing?: boolean;
  startups?: Startup[];
  fetchStartups?: () => void;
}

export default function SellPage({ 
  onAddStartup, 
  onActionToast, 
  setView, 
  categories, 
  isEditing = false,
  startups = [],
  fetchStartups
}: SellPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.id || 'startups');
  const [slogan, setSlogan] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [listingType, setListingType] = useState("To'liq loyiha (manba kodi bilan)");
  const [selectedTechs, setSelectedTechs] = useState<string[]>(['React', 'TypeScript', 'Node.js']);
  const [customTechInput, setCustomTechInput] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [dynamicAttributes, setDynamicAttributes] = useState<Record<string, any>>({});
  const [imageUrl, setImageUrl] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing data if editing
  useEffect(() => {
    if (isEditing && id && startups.length > 0) {
      const s = startups.find(item => item.id === id);
      if (s) {
        setName(s.name);
        setCategory(s.category);
        setSlogan(s.slogan);
        setDescription(s.description);
        setPrice(s.price?.toString() || '');
        setListingType(s.listingType || "To'liq loyiha (manba kodi bilan)");
        
        let techs: string[] = [];
        try {
          techs = Array.isArray(s.techStack) ? s.techStack : JSON.parse(s.techStack as unknown as string);
        } catch (e) { techs = ['Boshqa']; }
        setSelectedTechs(techs);
        
        setDemoUrl(s.demoUrl || '');
        setDeliveryUrl(s.deliveryUrl || '');
        setImageUrl(s.image || '');
        setEmail(s.contactEmail || '');
        setPhone(s.contactPhone || '');
        setTelegram(s.contactTelegram || '');

        if (s.attributes) {
          try {
            setDynamicAttributes(JSON.parse(s.attributes));
          } catch (e) { console.error("Error parsing attributes:", e); }
        }
      }
    }
  }, [isEditing, id, startups]);

  const repoIncluded = listingType === "To'liq loyiha (manba kodi bilan)";
  
  // Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Dynamic Image Uploading to Backend
  const uploadImageFile = async (file: File) => {
    setIsUploading(true);
    onActionToast(`Rasm yuklanmoqda...`);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
        setImageFile(file);
        onActionToast(`Rasm muvaffaqiyatli serverga yuklandi: ${file.name}`);
      } else {
        const err = await res.json();
        onActionToast(err.error || "Rasm yuklashda xatolik yuz berdi.");
      }
    } catch (err: any) {
      console.error(err);
      onActionToast("Rasm yuklashda tarmoq xatosi yuz berdi.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        uploadImageFile(file);
      } else {
        onActionToast('Iltimos, rasm fayli formatini yuklang.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      uploadImageFile(file);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUploading || isSubmitting) {
      onActionToast("Iltimos, kutib turing...");
      return;
    }

    if (!name || !slogan || !description) {
      onActionToast('Iltimos, barcha majburiy maydonlarni to\'ldiring.');
      return;
    }

    setIsSubmitting(true);

    const finalImage = imageUrl || 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=600&auto=format&fit=crop';
    const parsedPrice = parseFloat(price) || 0;

    const attrObj: Record<string, any> = {};
    const fields = CATEGORY_FIELDS[category] || [];
    fields.forEach((field) => {
      const val = dynamicAttributes[field.key];
      if (field.type === 'checkbox') {
        attrObj[field.key] = !!val;
      } else {
        attrObj[field.key] = val !== undefined && val !== '' ? val : "Ko'rsatilmagan";
      }
    });

    const payload = {
      name,
      slogan,
      description,
      longDescription: description,
      category,
      price: parsedPrice,
      listingType,
      techStack: selectedTechs,
      demoUrl: demoUrl || null,
      deliveryUrl: deliveryUrl || null,
      repoIncluded,
      image: finalImage,
      contactEmail: email,
      contactPhone: phone,
      contactTelegram: telegram,
      attributes: JSON.stringify(attrObj),
    };

    try {
      if (isEditing && id) {
        const res = await fetch(`/api/startups/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          onActionToast(`${name} muvaffaqiyatli tahrirlandi.`);
          if (fetchStartups) fetchStartups();
          navigate('/profile');
        } else {
          const err = await res.json();
          onActionToast(err.error || "Tahrirlashda xatolik yuz berdi.");
        }
      } else {
        // Handle new startup via onAddStartup (which likely uses POST)
        const newStartup: Startup = {
          ...payload,
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          soldStatus: 'sotuvda',
          status: 'pending',
          proposalsCount: 0,
          gallery: [],
          team: [{ name: 'Siz', role: 'Asoschi', imgUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=You' }],
          milestones: [],
          techStack: JSON.stringify(payload.techStack) as any,
        };
        onAddStartup(newStartup);
      }
    } catch (err) {
      console.error(err);
      onActionToast("Xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in text-left">
      <div className="bg-primary-container border border-outline-variant/20 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 select-none">
            Yangi g'oya yoki loyihani e'lon qilish
          </h1>
          <p className="text-xs md:text-sm text-on-primary-container leading-relaxed">
            Platformada o'z g'oyangiz va takliflaringizni baham ko'ring. Boshqa foydalanuvchilar sizning g'oyangizni o'rganishi, unga ovoz berishi va birgalikda rivojlantirish uchun fikrlar qoldirishi mumkin.
          </p>
        </div>

        <form onSubmit={handlePublish} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-primary-container block">Startap nomi</label>
              <input
                type="text"
                required
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                placeholder="Masalan: Safia Systems"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-primary-container block">Kategoriya</label>
              <select
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setDynamicAttributes({});
                }}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Category Attributes */}
          <div className="bg-[#0c192d] border border-outline-variant/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-secondary-container">
              Kategoriya ma'lumotlari (Ixtiyoriy moslashuvchan ko'rsatkichlar)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {(CATEGORY_FIELDS[category] || []).map((field) => {
                if (field.type === 'checkbox') {
                  return (
                    <div key={field.key} className="flex items-center gap-3 py-2.5">
                      <input
                        type="checkbox"
                        id={field.key}
                        className="w-5 h-5 accent-secondary-container bg-[#0b1426] border border-outline-variant/30 rounded focus:ring-0 cursor-pointer"
                        checked={!!dynamicAttributes[field.key]}
                        onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.key]: e.target.checked })}
                      />
                      <label htmlFor={field.key} className="text-xs font-semibold text-gray-300 cursor-pointer select-none">
                        {field.label}
                      </label>
                    </div>
                  );
                } else if (field.type === 'select') {
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-semibold text-gray-300 block">{field.label}</label>
                      <select
                        className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-secondary-container transition-all"
                        value={dynamicAttributes[field.key] || ''}
                        onChange={(e) => setDynamicAttributes({ ...dynamicAttributes, [field.key]: e.target.value })}
                      >
                        <option value="">Tanlang...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                } else {
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs font-semibold text-gray-300 block">{field.label}</label>
                      <input
                        type={field.type}
                        className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-secondary-container transition-all"
                        placeholder={field.placeholder}
                        value={dynamicAttributes[field.key] || ''}
                        onChange={(e) => setDynamicAttributes({
                          ...dynamicAttributes,
                          [field.key]: field.type === 'number'
                            ? (e.target.value === '' ? '' : Number(e.target.value))
                            : e.target.value
                        })}
                      />
                    </div>
                  );
                }
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-on-primary-container block">Startap shiori / Slogani</label>
            <input
              type="text"
              required
              className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
              placeholder="Masalan: Logistika uchun sun'iy intellekt va marshrutlash boshqaruvi"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-on-primary-container block">Startap taqdimoti va tavsifi</label>
            <textarea
              required
              rows={5}
              className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all resize-none leading-relaxed"
              placeholder="Texnologiyangiz, bozor talabi, biznes modelingiz va kelajakdagi rejalaringiz haqida batafsil ma'lumot bering..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            ></textarea>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-primary-container block">Sotish narxi ($)</label>
                <button
                  type="button"
                  onClick={async () => {
                    if (!category) return onActionToast("Iltimos, avval kategoriyani tanlang.");
                    onActionToast("AI narxni hisoblamoqda...");
                    try {
                      const features = selectedTechs;
                      const res = await fetch(`/api/ai/price-suggestion?category=${category}&features=${JSON.stringify(features)}`);
                      if (res.ok) {
                        const data = await res.json();
                        setPrice(data.suggestedPrice.toString());
                        onActionToast(`AI taklif qilgan narx: $${data.suggestedPrice} (O'rtacha diapazon: $${data.range.min} - $${data.range.max})`);
                      }
                    } catch (err) {
                      onActionToast("AI narxni hisoblashda xatolik yuz berdi.");
                    }
                  }}
                  className="text-[10px] bg-secondary-container/10 text-secondary-container px-2 py-1 rounded border border-secondary-container/20 font-bold hover:bg-secondary-container/20 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                  AI Narx Taklifi
                </button>
              </div>
              <input
                type="number"
                required
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                placeholder="Masalan: 250 (faqat raqam kiriting)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-primary-container block">Nima sotiladi?</label>
              <select
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                value={listingType}
                onChange={(e) => setListingType(e.target.value)}
              >
                <option value="To'liq loyiha (manba kodi bilan)">To'liq loyiha (manba kodi bilan)</option>
                <option value="Faqat litsenziya (foydalanish huquqi)">Faqat litsenziya (foydalanish huquqi)</option>
                <option value="Manba kodisiz tayyor mahsulot">Manba kodisiz tayyor mahsulot</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Texnologiyalar chip style block */}
            <div className="col-span-1 md:col-span-2 space-y-3 bg-[#0b1426] border border-outline-variant/10 rounded-2xl p-5">
              <div>
                <label className="text-xs font-bold text-on-primary-container block mb-1">
                  Texnologiyalar (Chip-style tanlov)
                </label>
                <p className="text-[10px] text-on-primary-container leading-relaxed">
                  Loyihangizda ishlatilgan asosiy texnologiyalarni tanlang yoki o'zingiznikini qo'shing.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 py-2">
                {[
                  "React", "Vue.js", "Angular", "Next.js", "Node.js", "Express", "NestJS", "Python", "Django", "FastAPI",
                  "Solidity", "TypeScript", "JavaScript", "PostgreSQL", "MongoDB", "MySQL", "Tailwind CSS", "Flutter", "Go", "Docker"
                ].map((tech) => {
                  const isSelected = selectedTechs.includes(tech);
                  return (
                    <button
                      type="button"
                      key={tech}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTechs(selectedTechs.filter(t => t !== tech));
                        } else {
                          setSelectedTechs([...selectedTechs, tech]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-[#f3ba2f] text-[#12161c] border-[#f3ba2f]'
                          : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {tech}
                      {isSelected && <span className="ml-1 text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-black/40 border border-outline-variant/30 text-white rounded-xl p-2.5 font-semibold text-xs focus:outline-none focus:border-secondary-container transition-all"
                  placeholder="Boshqa texnologiya nomi..."
                  value={customTechInput}
                  onChange={(e) => setCustomTechInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = customTechInput.trim();
                      if (trimmed && !selectedTechs.includes(trimmed)) {
                        setSelectedTechs([...selectedTechs, trimmed]);
                        setCustomTechInput('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = customTechInput.trim();
                    if (trimmed && !selectedTechs.includes(trimmed)) {
                      setSelectedTechs([...selectedTechs, trimmed]);
                      setCustomTechInput('');
                    }
                  }}
                  className="px-4 bg-secondary-container text-[#12161c] hover:brightness-110 font-bold text-xs rounded-xl active:scale-95 transition-all"
                >
                  Qo'shish
                </button>
              </div>

              {selectedTechs.length > 0 && (
                <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] text-on-primary-container font-extrabold uppercase mr-1">Tanlanganlar:</span>
                  {selectedTechs.map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#f3ba2f]/10 border border-[#f3ba2f]/30 rounded-lg text-xs font-bold text-[#f3ba2f]"
                    >
                      {tech}
                      <button
                        type="button"
                        onClick={() => setSelectedTechs(selectedTechs.filter(t => t !== tech))}
                        className="text-[10px] hover:text-red-400 font-bold ml-1 text-[#f3ba2f]"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>


            <div className="col-span-1 md:col-span-2 space-y-2 mt-4 bg-secondary-container/5 p-4 rounded-xl border border-secondary-container/20">
              <label className="text-xs font-bold text-secondary-container block flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lock</span>
                Yetkazib berish havolasi (Maxfiy)
              </label>
              <p className="text-[11px] text-on-primary-container mb-2">
                Ushbu havola (GitHub repo, Google Drive va hokazo) FAQAT xaridorga to'lov muvaffaqiyatli o'tgandan keyin ko'rsatiladi.
              </p>
              <input
                type="url"
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                placeholder="Masalan: https://github.com/loyiha/manba-kodi yoki Google Drive linki"
                value={deliveryUrl}
                onChange={(e) => setDeliveryUrl(e.target.value)}
              />
            </div>

            <div className="col-span-1 md:col-span-2 space-y-2 mt-4">
              <label className="text-xs font-bold text-on-primary-container block">Demo havola (ixtiyoriy)</label>
              <input
                type="url"
                className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                placeholder="Masalan: https://demo.loyiha.uz"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Image Upload Area with Drag & Drop functionality */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-primary-container block">Muqova rasmi</label>
            
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                dragActive
                  ? 'border-secondary-container bg-secondary-container/5'
                  : 'border-outline-variant/30 bg-[#0b1426] hover:border-secondary-container/50'
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <span className="material-symbols-outlined text-secondary-container text-4xl animate-spin">
                    sync
                  </span>
                  <p className="text-xs font-bold text-white">Rasm yuklanmoqda, iltimos kuting...</p>
                </div>
              ) : imageUrl ? (
                <div className="flex flex-col items-center justify-center space-y-2 w-full">
                  <img
                    src={imageUrl}
                    alt="Yuklangan startap loyihasi muqovasi"
                    className="max-h-32 rounded-xl object-cover border border-white/10"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    width={160}
                    height={128}
                  />
                  <div className="flex gap-2 items-center">
                    <p className="text-[10px] text-green-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Muvaffaqiyatli yuklandi
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageUrl('');
                        setImageFile(null);
                      }}
                      className="text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 px-2.5 py-1 rounded-lg font-bold"
                    >
                      O'chirish
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-secondary-container text-4xl mb-3">
                    cloud_upload
                  </span>
                  <p className="text-xs font-bold text-white mb-1">
                    Faylni tortib olib tashlang yoki ko'rib chiqish uchun bosing
                  </p>
                  <p className="text-[10px] text-on-primary-container">
                    PNG, JPG yoki SVG formatlarini qo'llab-quvvatlaydi (Maks. 10MB)
                  </p>
                </>
              )}
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-outline-variant/10"></div>
              <span className="flex-shrink mx-4 text-[10px] font-extrabold uppercase tracking-widest text-on-primary-container">
                — YOKI RASM URL MANZILINI JOYLASHTIRING —
              </span>
              <div className="flex-grow border-t border-outline-variant/10"></div>
            </div>

            <input
              type="url"
              className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
              placeholder="Rasmning onlayn URL havolasini kiriting..."
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImageFile(null);
              }}
            />
          </div>

          {/* Founder Contact Information */}
          <div className="pt-6 border-t border-outline-variant/10 space-y-4">
            <h3 className="text-white font-bold text-sm tracking-wide uppercase">
              Asoschi bilan bog'lanish ma'lumotlari
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-primary-container block">Elektron pochta manzili</label>
                <input
                  type="email"
                  className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                  placeholder="contact@safia.uz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-primary-container block">Telefon raqami</label>
                <input
                  type="tel"
                  className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-primary-container block">Telegram foydalanuvchi nomi</label>
                <input
                  type="text"
                  className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 font-semibold text-sm focus:outline-none focus:border-secondary-container transition-all"
                  placeholder="safia_founder"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-secondary-container hover:brightness-110 text-on-secondary-fixed rounded-xl font-bold text-sm shadow-xl shadow-secondary-container/10 uppercase tracking-widest transition-all"
          >
            E'lonni chop etish
          </button>
        </form>
      </div>
    </div>
  );
}
