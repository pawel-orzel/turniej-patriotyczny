import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const showCustomModal = (title, message, type = 'alert') => {
  return new Promise((resolve) => {
    const modalContainer = document.createElement('div');
    document.body.appendChild(modalContainer);
    const root = createRoot(modalContainer);

    const handleClose = (result) => {
      root.unmount();
      modalContainer.remove();
      resolve(result);
    };

    const isError = title.toLowerCase().includes('błąd') || title.toLowerCase().includes('zły');
    const isSuccess = title.toLowerCase().includes('sukces') || title.toLowerCase().includes('zalogowano');

    const neoBtn = "border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all rounded-[16px] font-[900] uppercase";

    root.render(
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200 font-['Plus_Jakarta_Sans']">
        <div className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] p-8 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
          <div className="flex justify-center mb-6">
            {isError ? <AlertTriangle className="w-12 h-12 text-[#DC2626]" /> :
             isSuccess ? <CheckCircle className="w-12 h-12 text-green-500" /> :
             <Info className="w-12 h-12 text-blue-500" />}
          </div>
          <h3 className="text-3xl font-[900] uppercase tracking-tighter text-black mb-4 leading-tight">{title}</h3>
          <p className="font-mono text-sm font-bold text-slate-600 uppercase mb-8 whitespace-pre-wrap">{message}</p>
          <div className="flex flex-col gap-3 justify-center">
            {type === 'confirm' && (
              <button onClick={() => handleClose(false)} className={`${neoBtn} w-full py-4 px-6 bg-slate-100 text-black`}>
                ANULUJ
              </button>
            )}
            <button onClick={() => handleClose(true)} className={`${neoBtn} w-full py-4 px-6 ${type === 'confirm' ? 'bg-[#DC2626] text-white' : 'bg-black text-white'}`}>
              {type === 'confirm' ? 'TAK, POTWIERDŹ' : 'OK, ZROZUMIANO'}
            </button>
          </div>
        </div>
      </div>
    );
  });
};

export const showAlert = (title, message) => showCustomModal(title, message, 'alert');
export const showConfirm = (title, message) => showCustomModal(title, message, 'confirm');