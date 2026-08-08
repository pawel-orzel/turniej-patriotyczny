import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { Trophy, Radio, Activity, LogOut } from 'lucide-react';
import { LeaderboardModal } from './final'; // Import modalu

const neoCard = "border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px]";
const neoBtn = "border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all rounded-[16px] font-[900] uppercase";

export default function ParticipantBatchPanel({ db, user, appId, liveStage, onLogout }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localStartTime, setLocalStartTime] = useState(null);
  const [answeredInBatch, setAnsweredInBatch] = useState(new Set());
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const isSpectator = !(liveStage?.eligibleUids || []).includes(user?.uid);

  useEffect(() => {
    if (!user?.uid || isSpectator || !liveStage?.allQuestions) return;

    // Ustawiamy czas startu na podstawie danych z serwera, aby zapewnić spójność
    // Date.now() jest używane jako fallback, gdyby liveStage.startTime nie było jeszcze dostępne
    if (liveStage.startTime && !localStartTime) {
      const serverTime = liveStage.startTime.toDate ? liveStage.startTime.toDate().getTime() : Date.now();
      setLocalStartTime(serverTime);
    }
  }, [user?.uid, isSpectator, liveStage?.allQuestions, liveStage?.startTime, localStartTime]);

  const handleAnswer = async (question, selectedIdx) => {
    if (isSubmitting || isSpectator || answeredInBatch.has(question.id)) return;
    setIsSubmitting(true);

    try {
      const isCorrect = selectedIdx === question.correct;
      const timeDiff = Math.max(0, Date.now() - (localStartTime || Date.now()));
      const speedBonus = Math.max(0, 1000 - Math.floor(timeDiff / 15));
      const earned = isCorrect ? (1000 + speedBonus) : 0;

      const resultRef = doc(db, 'artifacts', appId, 'public', 'data', 'stageResults', `${question.id}_${user.uid}`);
      const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);

      await setDoc(resultRef, {
        questionId: question.id,
        uid: user.uid,
        correct: isCorrect,
        earned,
        timeDiff,
        timestamp: serverTimestamp()
      });

      if (earned > 0) {
        await setDoc(participantRef, {
          totalPoints: increment(earned),
          scoreUpdatedAt: serverTimestamp()
        }, { merge: true });
      }

      setAnsweredInBatch(prev => {
        const newSet = new Set(prev);
        newSet.add(question.id);
        return newSet;
      });
      setSelectedAnswers(prev => ({...prev, [question.id]: selectedIdx}));
    } catch (err) {
      console.error('Błąd zapisywania odpowiedzi:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStageColors = () => {
    switch (liveStage?.stageName) {
      case 'PÓŁFINAŁ': return { bg: 'bg-[#3B82F6]', text: 'text-white', accent: 'text-white', tagBg: 'bg-black/20' };
      case 'FINAŁ': return { bg: 'bg-[#EAB308]', text: 'text-black', accent: 'text-black', tagBg: 'bg-black/20' };
      default: return { bg: 'bg-[#DC2626]', text: 'text-white', accent: 'text-[#EAB308]', tagBg: 'bg-black/20' };
    }
  };

  const stageColors = getStageColors();
  const allAnswered = Array.isArray(liveStage?.allQuestions) && liveStage.allQuestions.every(q => answeredInBatch.has(q.id));

  // Ekran oczekiwania (gdy odpowiedziano na wszystkie pytania lub tryb nieaktywny)
  if (!liveStage.active || (allAnswered && !isSpectator)) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#DC2626] overflow-y-auto p-6 text-white animate-in fade-in zoom-in duration-300 flex flex-col">
        <div className="my-auto flex flex-col items-center justify-center py-8 shrink-0">
          <div className="bg-white border-[3px] border-black w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 shrink-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {liveStage.active ? <Trophy className="text-[#EAB308] w-16 h-16" /> : <Activity className="text-[#EAB308] w-16 h-16 animate-pulse" />}
          </div>
          <h2 className="text-4xl font-[900] uppercase text-center mb-2 tracking-tighter shrink-0 break-words whitespace-normal">
            {liveStage.active ? "ODPOWIEDZI WYSŁANE" : "SCENA GŁÓWNA"}
          </h2>
          <p className="font-mono text-sm tracking-widest opacity-80 uppercase text-center mb-8 shrink-0 break-words whitespace-normal">
            {liveStage.active ? "Oczekuj na wyniki rundy!" : "Oczekuj na sygnał od prowadzącego!"}
          </p>

          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setShowLeaderboard(true)}
              className={`${neoBtn} bg-yellow-400 text-black px-6 py-3 flex items-center gap-2`}
            >
              <Trophy className="w-5 h-5" />
              RANKING
            </button>
            <button onClick={onLogout} className={`${neoBtn} bg-black text-white px-6 py-3 flex items-center gap-2`}>
              <LogOut className="w-5 h-5" />
              WYLOGUJ
            </button>
          </div>
        </div>
        {showLeaderboard && <LeaderboardModal db={db} appId={appId} liveStage={liveStage} onClose={() => setShowLeaderboard(false)} />}
      </div>
    );
  }

  // Główny widok masowego odpowiadania
  return (
    <div className="fixed inset-0 z-[100] bg-[#F9FAFB] overflow-y-auto overflow-x-hidden p-6 flex flex-col">
      <div className="my-auto max-w-2xl mx-auto w-full space-y-6 py-8 shrink-0 relative">
        <div className={`${neoCard} ${stageColors.bg} p-8 ${stageColors.text} text-center`}>
          <Radio className={`w-12 h-12 mx-auto mb-4 animate-pulse ${stageColors.accent}`} />
          <div className={`font-mono text-[10px] tracking-widest uppercase font-bold ${stageColors.tagBg} px-3 py-1 rounded-full inline-block mb-4`}>
            {isSpectator ? `WIDZ - ${liveStage.stageName || 'LIVE'}` : `GRACZ - ${liveStage.stageName || 'LIVE'}`}
          </div>
          <h2 className="text-[clamp(1.5rem,6vw,1.875rem)] font-[900] uppercase leading-tight break-words whitespace-normal">
            {liveStage.stageName} - ZESTAW PYTAŃ
          </h2>
        </div>

        {Array.isArray(liveStage.allQuestions) && liveStage.allQuestions.map((q) => {
          const isAnswered = answeredInBatch.has(q.id);
          const selectedOpt = selectedAnswers[q.id];

          return (
            <div key={q.id} className={`${neoCard} bg-white p-6`}>
              <h3 className="text-lg font-[900] uppercase leading-tight mb-4">{q.text}</h3>
              <div className="grid grid-cols-1 gap-3">
                {isSpectator ? (
                  <div className="text-center p-4 bg-slate-50 border-[2px] border-black rounded-xl">
                    Warianty ukryte dla widzów.
                  </div>
                ) : (
                  q.options.map((opt, idx) => {
                    let btnClass = 'bg-white text-black hover:bg-yellow-50';
                    if (isAnswered) {
                      if (idx === q.correct) btnClass = 'bg-green-500 text-white border-green-700';
                      else if (idx === selectedOpt) btnClass = 'bg-red-500 text-white border-red-700';
                      else btnClass = 'bg-slate-100 text-slate-500 opacity-60';
                    }
                    
                    return (
                      <button 
                        key={idx} 
                        disabled={isSubmitting || isSpectator || isAnswered} 
                        onClick={() => handleAnswer(q, idx)} 
                        className={`${neoBtn} p-4 font-[900] uppercase text-sm flex justify-between items-center text-left transition-all ${btnClass} gap-3`}
                      >
                        <span className="min-w-0 break-words whitespace-normal">{opt}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}