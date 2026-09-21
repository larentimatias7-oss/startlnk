import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

/**
 * Toast flotante enterprise no bloqueante para la esquina superior derecha (top-right).
 * Duración estándar de 3 a 3.5s según la especificación de diseño Milicic.
 */
export default function Toast({ message, type = 'success', onClose, duration = 3500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-[#141B22]',
      border: 'border-[#38A169]/40',
      badgeBg: 'bg-[rgba(56,161,105,0.16)]',
      text: 'text-[#F1F5F9]',
      iconText: 'text-[#38A169]',
      Icon: CheckCircle2,
    },
    warning: {
      bg: 'bg-[#141B22]',
      border: 'border-[#DD6B20]/40',
      badgeBg: 'bg-[rgba(221,107,32,0.16)]',
      text: 'text-[#F1F5F9]',
      iconText: 'text-[#DD6B20]',
      Icon: AlertTriangle,
    },
    danger: {
      bg: 'bg-[#141B22]',
      border: 'border-[#E53E3E]/40',
      badgeBg: 'bg-[rgba(229,62,62,0.16)]',
      text: 'text-[#F1F5F9]',
      iconText: 'text-[#E53E3E]',
      Icon: AlertCircle,
    },
    info: {
      bg: 'bg-[#141B22]',
      border: 'border-[#3182CE]/40',
      badgeBg: 'bg-[rgba(49,130,206,0.16)]',
      text: 'text-[#F1F5F9]',
      iconText: 'text-[#3182CE]',
      Icon: Info,
    }
  }[type] || styles.info;

  const { Icon } = styles;

  return (
    <div className="fixed top-5 right-5 z-50 animate-slideInRight max-w-md w-full px-4 sm:px-0">
      <div className={`${styles.bg} border ${styles.border} shadow-2xl rounded-lg p-3.5 flex items-start justify-between gap-3 backdrop-blur-md`}>
        <div className="flex items-start gap-2.5">
          <div className={`p-1.5 rounded-md ${styles.badgeBg} ${styles.iconText} shrink-0 mt-0.5`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <p className={`font-semibold ${styles.text} leading-snug`}>{message}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#94A3B8] hover:text-white p-1 rounded-md hover:bg-[#222C38] transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
