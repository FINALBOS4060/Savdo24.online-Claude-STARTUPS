import React, { useState } from 'react';
import { 
  Folder, 
  Plus, 
  Trash2, 
  PlusCircle, 
  Edit, 
  X, 
  RefreshCw, 
  HelpCircle 
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { Category } from '../../types';
import { apiFetch as fetch } from '../../lib/api';
import { ConfirmDialog } from '../ConfirmDialog';

const getLucideIconName = (materialName: string): string => {
  const map: Record<string, string> = {
    'rocket_launch': 'Rocket',
    'rocket': 'Rocket',
    'category': 'Folder',
    'shopping_cart': 'ShoppingCart',
    'payments': 'Coins',
    'business': 'Building2',
    'settings': 'Settings',
    'group': 'Users',
    'gavel': 'Gavel',
    'flag': 'Flag',
    'history': 'History',
    'campaign': 'Megaphone',
    'list': 'List',
    'help_center': 'HelpCircle',
    'quiz': 'HelpCircle',
    'support_agent': 'Headphones',
    'mail': 'Mail',
    'send': 'Send',
    'edit_note': 'FileText',
    'add': 'Plus',
    'add_circle': 'PlusCircle',
    'edit_square': 'Edit',
    'close': 'X',
    'sync': 'RefreshCw',
    'delete': 'Trash2',
  };
  return map[materialName] || materialName.charAt(0).toUpperCase() + materialName.slice(1);
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const lucideName = getLucideIconName(name);
  const IconComponent = (Icons as any)[lucideName] || HelpCircle;
  return <IconComponent className={className} />;
}

interface AdminCategoriesTabProps {
  categories: Category[];
  fetchCategories: () => void;
  onActionToast: (message: string) => void;
}

export function AdminCategoriesTab({ categories, fetchCategories, onActionToast }: AdminCategoriesTabProps) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({ id: '', name: '', icon: '' });
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

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

  const executeDeleteCategory = async (id: string) => {
    setDeleteCategoryId(null);
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

  return (
    <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
      <div className="flex justify-between items-center border-b border-white/5 pb-6">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Folder className="text-secondary w-5 h-5" />
          Kategoriyalarni boshqarish
        </h2>
        <button
          onClick={() => setIsAddingCategory(true)}
          className="px-4 py-2 bg-secondary text-on-secondary rounded-xl font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
        >
          <Plus className="w-4 h-4" />
          Yangi qo'shish
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-surface-container-low border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-secondary">
                <CategoryIcon name={cat.icon} className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{cat.name}</h3>
                <p className="text-xs text-on-primary-container">ID: {cat.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setEditingCategory(cat)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Tahrirlash
              </button>
              <button
                onClick={() => setDeleteCategoryId(cat.id)}
                className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!deleteCategoryId}
        title="Kategoriyani o'chirish"
        message="Haqiqatan ham ushbu kategoriyani o'chirmoqchimisiz? Bu amal qaytarilmas."
        variant="danger"
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        onConfirm={() => deleteCategoryId && executeDeleteCategory(deleteCategoryId)}
        onCancel={() => setDeleteCategoryId(null)}
      />

      {(isAddingCategory || editingCategory) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-primary-container border border-outline-variant/30 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold flex items-center gap-2">
                {isAddingCategory ? (
                  <PlusCircle className="text-secondary w-5 h-5" />
                ) : (
                  <Edit className="text-secondary w-5 h-5" />
                )}
                {isAddingCategory ? "Yangi kategoriya qo'shish" : "Kategoriyani tahrirlash"}
              </h3>
              <button 
                onClick={() => { setIsAddingCategory(false); setEditingCategory(null); }}
                className="text-on-primary-container hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1 flex items-center justify-center"
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isAddingCategory ? handleAddCategory : handleSaveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-bold text-on-primary-container">Kategoriya ID (faqat ingichka harflar va chiziqlar)</label>
                <input
                  type="text"
                  disabled={!isAddingCategory}
                  value={isAddingCategory ? newCategory.id : editingCategory?.id}
                  onChange={(e) => isAddingCategory ? setNewCategory({...newCategory, id: e.target.value}) : null}
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl p-3 text-sm text-white focus:border-secondary outline-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                  placeholder="masalan: startaplar"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-bold text-on-primary-container">Kategoriya nomi</label>
                <input
                  type="text"
                  value={isAddingCategory ? newCategory.name : editingCategory?.name}
                  onChange={(e) => isAddingCategory ? setNewCategory({...newCategory, name: e.target.value}) : setEditingCategory(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl p-3 text-sm text-white focus:border-secondary outline-none focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                  placeholder="masalan: Startaplar"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase font-bold text-on-primary-container">Ikonka (Material Icon nomi)</label>
                <input
                  type="text"
                  value={isAddingCategory ? newCategory.icon : editingCategory?.icon}
                  onChange={(e) => isAddingCategory ? setNewCategory({...newCategory, icon: e.target.value}) : setEditingCategory(prev => prev ? {...prev, icon: e.target.value} : null)}
                  className="w-full bg-surface-container-low border border-white/10 rounded-xl p-3 text-sm text-white focus:border-secondary outline-none focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
                  placeholder="masalan: rocket_launch"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingCategory}
                className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-bold text-sm shadow-lg shadow-secondary/10 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface"
              >
                {isSavingCategory && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isAddingCategory ? "Qo'shish" : "Saqlash"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
