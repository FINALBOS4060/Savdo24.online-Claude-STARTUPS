import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Tasdiqlash',
  cancelText = 'Bekor qilish',
  onConfirm,
  onCancel,
  variant = 'default',
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-surface border border-outline/20 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-secondary-container/10 text-secondary-container border border-secondary-container/20'}`}>
            {isDanger ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">{title}</h3>
            <p className="text-xs text-on-primary-container mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs rounded-xl transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 font-extrabold text-xs rounded-xl transition-all shadow-md cursor-pointer ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-secondary-container text-on-secondary-container hover:brightness-110'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
