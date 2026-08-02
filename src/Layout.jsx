import React from 'react';
import { LogOut, MapPin, Trophy, Activity } from 'lucide-react';
import { neoBtn } from './styles';

export function Layout({
  children,
  userData,
  appConfig,
  elapsedTime,
  view,
  setView,
  handleLogout,
  canAccessAdmin,
  setIsReżyserkaOpen,
  stationsClickable,
  handleUpdateConfig,
}) {
  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB] font-['Plus_Jakarta_Sans'] pb-28 md:pb-32 overflow-x-hidden">
      {/* NAGŁÓWEK */}
      <header className="bg-white border-b-[3px] border-black p-4 md:p-6 sticky top-0 z-50 flex justify-between items-center gap-2">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="bg-[#DC2626] border-2 border-black w-10 h-10 md:w-12 md:h-12 rounded-[10px] md:rounded-[12px] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden shrink-0">
            <img src="/favicon.png" alt="Logo aplikacji" className="w-6 h-6 md:w-8 md:h-8 object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base md:text-xl font-[900] leading-none uppercase truncate max-w-[110px] md:max-w-[250px]">{userData?.nick}</h2>
            <div className="font-mono text-[8px] md:text-[10px] tracking-widest text-slate-400 uppercase mt-1 truncate">STATUS: AKTYWNY</div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end shrink-0">
          <div className="flex flex-col md:flex-row items-end md:items-center gap-1 md:gap-3 mb-1 md:mb-0">
            {userData?.timestamp && (
              <div className="font-mono text-[10px] md:text-[13px] font-bold bg-white text-black px-1.5 md:px-2 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                ⏱ {elapsedTime}
              </div>
            )}
            <div className="text-lg md:text-2xl font-[900] leading-none">{userData?.totalPoints || 0} PKT</div>
          </div>
          <div className="font-mono text-[8px] md:text-[10px] tracking-widest text-slate-400 uppercase font-bold mt-0.5">KONIEC: {appConfig?.endTime || '--:--'}</div>
          <button onClick={handleLogout} className="mt-1 font-mono text-[8px] md:text-[9px] font-bold tracking-widest uppercase bg-slate-100 text-black px-2 py-1 rounded-md border-2 border-black active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center gap-1 shadow-neo-sm">
            <LogOut className="w-3 h-3" /> WYLOGUJ
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {children}
      </main>

      {/* Pływający przycisk REŻYSERKA dla admina */}
      {canAccessAdmin && (
        <button
          onClick={() => setIsReżyserkaOpen(prev => !prev)}
          className={`fixed bottom-24 right-6 z-[100] ${neoBtn} bg-[#DC2626] text-white p-4 flex items-center gap-2`}
        >
          <Activity className="w-6 h-6 animate-pulse" />
          REŻYSERKA
        </button>
      )}

      {/* MENU DOLNE */}
      {view !== 'admin' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-0 md:pb-8 md:px-4">
          <nav className="pointer-events-auto w-full md:max-w-md bg-white border-t-[3px] md:border-[3px] border-black p-4 md:rounded-[24px] flex justify-around items-center shadow-[0px_-4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
            <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-[#DC2626]' : 'text-black'}`}>
              <MapPin className="w-7 h-7" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest">MAPA</span>
            </button>
            <button onClick={() => setView('leaderboard')} className={`flex flex-col items-center gap-1 ${view === 'leaderboard' ? 'text-[#DC2626]' : 'text-black'}`}>
              <Trophy className="w-7 h-7" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest">RANKING</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}