import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Trophy } from 'lucide-react';
import { db, appId } from '../firebaseConfig';
import { neoCard } from '../styles';

export function LeaderboardView({ appConfig }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => d.data());
      all.sort((a, b) => {
        // 1. Sortuj po punktach (malejąco)
        const scoreDiff = (b.totalPoints || 0) - (a.totalPoints || 0);
        if (scoreDiff !== 0) return scoreDiff;

        // 2. W przypadku remisu, sortuj po całkowitym czasie gry (rosnąco)
        const getTime = (ts) => {
          if (!ts) return 0;
          try {
            const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime();
            return isNaN(ms) ? 0 : ms;
          } catch { return 0; }
        };
        const aGameTime = getTime(a.scoreUpdatedAt) - getTime(a.timestamp);
        const bGameTime = getTime(b.scoreUpdatedAt) - getTime(b.timestamp);
        if (aGameTime !== bGameTime) return aGameTime - bGameTime;

        const aCreated = getTime(a.timestamp);
        const bCreated = getTime(b.timestamp);
        return aCreated - bCreated;
      });
      setLeaders(all.slice(0, 10));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-5xl font-[900] uppercase tracking-tighter leading-none mb-2">TABLICA CHWAŁY</h1>
        <div className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">RANKING TOP 10 NA ŻYWO</div>
      </div>

      <div className="space-y-4">
        {leaders.map((p, idx) => (
          <div 
            key={p.uid} 
            className={`${neoCard} p-6 flex items-center justify-between ${idx === 0 ? 'bg-red-50 border-[#DC2626]' : 'bg-white'}`}
          >
            <div className="flex items-center gap-6">
              <div className={`w-12 h-12 border-[3px] border-black rounded-[12px] flex items-center justify-center font-[900] text-xl ${
                idx === 0 ? 'bg-[#EAB308]' : idx === 1 ? 'bg-slate-300' : idx === 2 ? 'bg-orange-400' : 'bg-white'
              }`}>
                {idx + 1}
              </div>
              <span className="text-xl font-[900] uppercase tracking-tight truncate max-w-[150px] md:max-w-[300px]">{p.nick}</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-[900] leading-none">{p.totalPoints}</div>
              <div className="font-mono text-[9px] text-slate-400 tracking-widest font-bold">
                PKT
              </div>
              {p.scoreUpdatedAt && (
                <div className="font-mono text-[9px] text-slate-400 tracking-widest font-bold mt-1">
                {(() => {
                  try {
                    const d = typeof p.scoreUpdatedAt.toDate === 'function' ? p.scoreUpdatedAt.toDate() : new Date(p.scoreUpdatedAt);
                    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } catch {
                    return '';
                  }
                })()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`${neoCard} bg-black text-white p-8 text-center`}>
        <Trophy className="w-10 h-10 mx-auto mb-4 text-[#EAB308]" />
        <h5 className="text-xl font-[900] uppercase mb-2">GOTOWY NA PÓŁFINAŁ?</h5>
        <p className="font-mono text-[11px] opacity-60 uppercase">O godz. {appConfig?.endTime || '??:??'} zamkniemy ranking.</p>
      </div>
    </div>
  );
}