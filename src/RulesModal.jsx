import React, { useEffect } from 'react';
import RegRodo from './reg.RODO';
import { neoBtn } from './styles';

export function RulesModal({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
      >
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 id="rules-title" className="text-2xl font-[900] uppercase text-[#DC2626]">Regulamin i RODO</h2>
        </div>
        <div 
          className="overflow-y-auto flex-1 border-2 border-black rounded-xl p-5 space-y-5 mb-4 bg-slate-50 text-sm font-medium"
          tabIndex={0}
        >
          <RegRodo />
        </div>
        <button onClick={onClose} autoFocus className={`${neoBtn} w-full py-4 bg-black text-white flex justify-center items-center text-sm`}>
          ZROZUMIANO, ZAMKNIJ
        </button>
      </div>
    </div>
  );
}