import React from 'react';
import { Flag, CheckCircle, ChevronRight, Info } from 'lucide-react';
import { neoCard, neoBtn, neoTag } from './styles';

export function HomeView({ userData, appConfig, stations, stationsError, refetchStations, setView, setCurrentStationId, setShowRules, stationsClickable }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* BANER GŁÓWNY */}
      <div className={`${neoCard} bg-[#DC2626] p-8 md:p-10 text-white relative overflow-hidden md:flex md:items-center md:justify-between`}>
        <div className="relative z-10 shrink-0">
          <div className={neoTag + " bg-red-800 border-red-400 text-white mb-4"}>MISJA DZISIAJ</div>
          <h3 className="text-4xl md:text-5xl font-[900] leading-none uppercase mb-2 tracking-tighter">WIELKI TURNIEJ</h3>
          <p className="font-mono text-[11px] tracking-widest opacity-80 uppercase">Odpowiedz na jak największą liczbę pytań!</p>
        </div>
        <Flag className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 rotate-12 md:relative md:w-32 md:h-32 md:opacity-20 md:right-0 md:bottom-0 md:rotate-0" />
      </div>

      {/* BŁĄD ŁADOWANIA STACJI */}
      {stationsError && !stations && (
        <div className={`${neoCard} bg-red-50 p-8 text-center`}>
          <h3 className="text-xl font-[900] uppercase text-red-600 mb-4">BŁĄD ŁADOWANIA</h3>
          <p className="font-mono text-sm text-slate-600 mt-2 mb-6">{stationsError}</p>
          <button onClick={refetchStations} className={`${neoBtn} bg-black text-white px-8 py-3`}>
              SPRÓBUJ PONOWNIE
          </button>
        </div>
      )}

      {/* ŁADOWANIE STACJI */}
      {!stations && !stationsError && (
        <div className="flex justify-center items-center p-10">
          <div className="w-10 h-10 border-4 border-black border-t-slate-400 rounded-full animate-spin"></div>
          <p className="ml-4 font-mono uppercase">Ładowanie stacji...</p>
        </div>
      )}

      {/* BENTO GRID STACJI */}
      {stations && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(stations)
          .filter(st => st?.id && st.id.toLowerCase() !== 'półfinał' && st.id.toLowerCase() !== 'finał')
          .map((st) => {
          const maxPoints = st.questions?.reduce((acc, q) => acc + (q.points || 0), 0) || 0;
          const isDone = userData?.completedStations?.includes(st.id);
          return (
            <div 
              key={st.id} 
              onClick={() => {
                if (isDone) return; // Nie rób nic, jeśli stacja jest ukończona
                setCurrentStationId(st.id);
                setView('quiz');
              }}
              className={`${neoCard} bg-white p-8 flex flex-col justify-between min-h-[220px] transition-all ${isDone ? 'opacity-50 grayscale' : 'cursor-pointer hover:translate-y-[-4px]'}`}
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div style={{backgroundColor: st.color}} className="p-4 border-[3px] border-black rounded-[16px] text-white shadow-neo-sm">
                    <st.icon className="w-8 h-8" />
                  </div>
                  <div className="font-mono text-[10px] tracking-widest text-slate-400 text-right">
                    ASPEKT<br/>{st.category}
                  </div>
                </div>
            <h5 className="text-[clamp(1.25rem,5vw,1.5rem)] font-[900] uppercase leading-tight break-words">{st.name}</h5>
              </div>
              <div className="flex justify-between items-center mt-6">
                <span className="font-mono text-[12px] font-bold text-slate-500">{maxPoints} PKT</span>
                {isDone ? (
                  <CheckCircle className="text-green-600 w-8 h-8" />
                ) : <ChevronRight className="w-8 h-8" />}
              </div>
            </div>
          );
        })}
      </div>}

      <div className={`${neoCard} bg-white p-8 border-dashed flex flex-col md:flex-row gap-6 items-start md:items-center`}>
         <Info className="w-12 h-12 text-[#DC2626] shrink-0" />
         <div className="font-mono text-[11px] leading-relaxed uppercase font-bold text-slate-600 space-y-2 flex-1">
           <p>1. Udaj się do wybranego stanowiska i zeskanuj jego kod QR.</p>
           <p>2. Porozmawiaj ze strażnikiem stacji, aby otrzymać tajny kod do pytania.</p>
           <p>3. O godz. {appConfig?.endTime || '??:??'} zapraszamy TOP 10 graczy na półfinał na scenie głównej!</p>
           <p>4. Po rozstrzygnięciu półfinału rozegramy Wielki Finał dla najlepszych.</p>
           <button onClick={() => setShowRules(true)} className="mt-2 inline-block px-3 py-2 bg-slate-100 border-2 border-black rounded-lg active:translate-y-[2px] active:translate-x-[2px] transition-all font-[900]">
             REGULAMIN I RODO
           </button>
         </div>
      </div>
    </div>
  );
}