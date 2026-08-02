import React, { useState } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { showAlert, showConfirm } from './modal';
import { neoCard, neoBtn } from './styles';
import { db, appId } from './firebaseConfig';

export function AdminView({ stations }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const clearDatabase = async () => {
    if (!(await showConfirm("OSTRZEŻENIE", "CZY NA PEWNO CHCESZ USUNĄĆ WSZYSTKICH UCZESTNIKÓW I WYZEROWAĆ RANKING? TEJ OPERACJI NIE MOŻNA COFNĄĆ!"))) return;
    setIsDeleting(true);
    try {
      const participantsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
      const snapshot = await getDocs(participantsRef);
      const deletePromises = snapshot.docs.map(document => 
        deleteDoc(doc(participantsRef, document.id))
      );
      await Promise.all(deletePromises);
      await showAlert("SUKCES", "BAZA DANYCH ZOSTAŁA WYCZYSZCZONA! TURNIEJ ZRESETOWANY.");
    } catch (err) { console.error(err); await showAlert("BŁĄD", "WYSTĄPIŁ BŁĄD PODCZAS CZYSZCZENIA BAZY."); }
    setIsDeleting(false);
  };

  const [copiedUrl, setCopiedUrl] = useState('');

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 mt-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-5xl font-[900] uppercase tracking-tighter leading-none mb-2 text-[#DC2626]">SZTAB DOWODZENIA</h1>
          <div className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">PANEL ZARZĄDZANIA TURNIEJEM</div>
        </div>
      </div>

      {/* LINKI DO STACJI (GENERATOR) */}
      <div className={`${neoCard} bg-white p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">LINKI DO KODÓW QR STACJI</h3>
        <p className="font-mono text-xs text-slate-500 mb-4">Skopiuj poniższe linki i wklej je do darmowego generatora kodów QR (np. qr-code-generator.com).</p>
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border-2 border-black rounded-lg shadow-neo-sm flex justify-between items-center">
            <div>
              <div className="font-[900] uppercase mb-1">REJESTRACJA (PLAKAT GŁÓWNY)</div>
              <code className="text-xs break-all text-blue-600 font-bold">{window.location.origin}/</code>
            </div>
            <button onClick={() => handleCopy(`${window.location.origin}/`)} className={`${neoBtn} px-4 py-2 text-xs font-bold uppercase ${copiedUrl === `${window.location.origin}/` ? 'bg-green-500 text-white' : 'bg-white'}`}>
              {copiedUrl === `${window.location.origin}/` ? 'SKOPIOWANO' : 'KOPIUJ'}
            </button>
          </div>
        {stations && Object.values(stations)
          .filter(st => st?.id && st.id.toLowerCase() !== 'półfinał' && st.id.toLowerCase() !== 'finał')
          .map(st => {
            const url = `${window.location.origin}/?station=${st.id}`;
            return (
              <div key={st.id} className="p-3 bg-slate-50 border-2 border-black rounded-lg shadow-neo-sm flex justify-between items-center">
                <div>
                  <div className="font-[900] uppercase mb-1 text-[#DC2626]">{st.name}</div>
                  <code className="text-xs break-all text-blue-600 font-bold">{url}</code>
                </div>
                <button onClick={() => handleCopy(url)} className={`${neoBtn} px-4 py-2 text-xs font-bold uppercase ${copiedUrl === url ? 'bg-green-500 text-white' : 'bg-white'}`}>
                  {copiedUrl === url ? 'SKOPIOWANO' : 'KOPIUJ'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* RESETOWANIE */}
      <div className={`${neoCard} p-8 bg-red-50 border-dashed border-[#DC2626] text-center`}>
        <h3 className="text-2xl font-[900] uppercase leading-tight mb-4 text-[#DC2626]">STREFA NIEBEZPIECZNA</h3>
        <button onClick={clearDatabase} disabled={isDeleting} className={`${neoBtn} w-full py-5 bg-[#DC2626] text-white font-[900] uppercase`}>
          {isDeleting ? "TRWA CZYSZCZENIE..." : "RESETUJ RANKING"}
        </button>
      </div>

    </div>
  );
}