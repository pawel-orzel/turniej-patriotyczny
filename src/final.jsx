import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, increment, getDocs } from 'firebase/firestore';
import { Trophy, Radio, Activity, ChevronRight } from 'lucide-react';

const ADMIN_UID = "bLh8osMPACdoM2psBiOoPp0r4KE3";

// Custom Classes Neo-Brutalism
const neoCard = "border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] bg-white";
const neoBtn = "border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all rounded-[16px] font-[900] uppercase";

export default function FinalStage({ db, user, appId, stations }) {
  const [liveStage, setLiveStage] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
    const unsub = onSnapshot(liveRef, (docSnap) => {
      if (docSnap.exists()) {
        setLiveStage(docSnap.data());
      }
    });
    return () => unsub();
  }, [db, appId]);

  const isAdmin = user?.uid === ADMIN_UID;
  const isParticipant = !isAdmin && user;

  const getQuestions = (stationId) => {
    if (!stations) return [];
    const key = Object.keys(stations).find(k => k.toLowerCase() === stationId.toLowerCase());
    const station = key ? stations[key] : null;
    if (!station?.questions) return [];
    return station.questions.map((q, idx) => ({
      id: q.id || `${stationId.charAt(0)}${idx + 1}`,
      text: q.question || q.text || `Pytanie ${idx + 1}`,
      options: q.options || [],
      correct: q.correct !== undefined ? q.correct : 0
    }));
  };
  
  const semifinalQuestions = getQuestions('półfinał');
  const finalQuestions = getQuestions('finał');

  const setEligible = async (count, stageName) => {
    if (!window.confirm(`Czy na pewno chcesz pobrać TOP ${count} z rankingu i ustawić ich jako graczy do etapu: ${stageName}?`)) return;
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'participants'), orderBy('totalPoints', 'desc'), limit(count));
    const snap = await getDocs(q);
    const uids = snap.docs.map(d => d.id);
    
    const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
    await setDoc(liveRef, { eligibleUids: uids, stageName }, { merge: true });
    alert(`Ustawiono ${uids.length} autoryzowanych graczy dla: ${stageName}!`);
  };

  if (isAdmin) {
    return (
      <>
        <button
          id="rezyserka-btn"
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed bottom-24 right-6 z-[100] ${neoBtn} bg-[#DC2626] text-white p-4 flex items-center gap-2`}
        >
          <Activity className="w-6 h-6 animate-pulse" />
          REŻYSERKA
        </button>

        {isOpen && (
          <div className="fixed inset-0 z-[90] bg-[#F9FAFB] overflow-y-auto p-6 pb-32">
            <div className="max-w-2xl mx-auto space-y-8 mt-12">
              <div className="flex justify-between items-center">
                <h1 className="text-4xl font-[900] uppercase text-[#DC2626]">REŻYSERKA</h1>
                <div className="text-right">
                  <div className={`px-4 py-2 border-2 border-black rounded-full font-bold uppercase text-xs mb-1 ${liveStage?.active ? 'bg-green-400 text-black shadow-neo-sm' : 'bg-slate-200 text-slate-500'}`}>
                    {liveStage?.active ? 'STATUS: BROADCASTING' : 'STATUS: OFFLINE'}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 font-bold uppercase flex flex-col items-end">
                    <span>ETAP: {liveStage?.stageName || '---'}</span>
                    <span>GRACZY: {liveStage?.eligibleUids?.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className={`${neoCard} p-6 mb-8`}>
                <h2 className="text-xl font-[900] uppercase mb-4">KONTROLA STATUSU</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={async () => {
                      const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                      await updateDoc(liveRef, { active: false });
                    }}
                    className={`${neoBtn} w-full py-4 bg-black text-white`}
                  >
                    ZATRZYMAJ LIVE
                  </button>
                  <button
                    onClick={async () => {
                      const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                      await updateDoc(liveRef, { showAnswer: true });
                    }}
                    className={`${neoBtn} w-full py-4 bg-green-400 text-black`}
                  >
                    POKAŻ ODP. WIDZOM
                  </button>
                </div>
              </div>

              <div className={`${neoCard} p-6 bg-blue-50`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-[900] uppercase">1. PÓŁFINAŁ</h2>
                  <button onClick={() => setEligible(10, 'PÓŁFINAŁ')} className={`${neoBtn} px-4 py-2 bg-blue-500 text-white text-xs w-full md:w-auto`}>
                    USTAW GRACZY (TOP 10)
                  </button>
                </div>
                <div className="space-y-4">
                  {semifinalQuestions.length === 0 && (
                    <div className="font-mono text-xs text-slate-500 uppercase">Brak pytań. Dodaj stację "półfinał" w arkuszu.</div>
                  )}
                  {semifinalQuestions.map(q => (
                    <div key={q.id} className="border-2 border-black p-4 rounded-xl bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400">ID: {q.id}</div>
                        <div className="font-[900] text-lg leading-tight uppercase">{q.text}</div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Czy na pewno chcesz wypuścić to pytanie?')) return;
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, { active: true, currentId: q.id, question: q, showAnswer: false, startTime: serverTimestamp(), stageName: 'PÓŁFINAŁ' }, { merge: true });
                        }}
                        className={`${neoBtn} bg-[#3B82F6] text-white px-6 py-3 shrink-0 w-full md:w-auto`}
                      >
                        PUSH PÓŁFINAŁ
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${neoCard} p-6 bg-yellow-50`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <h2 className="text-2xl font-[900] uppercase">2. FINAŁ</h2>
                  <button onClick={() => setEligible(5, 'FINAŁ')} className={`${neoBtn} px-4 py-2 bg-[#EAB308] text-black text-xs w-full md:w-auto`}>
                    USTAW GRACZY (TOP 5)
                  </button>
                </div>
                <div className="space-y-4">
                  {finalQuestions.length === 0 && (
                    <div className="font-mono text-xs text-slate-500 uppercase">Brak pytań. Dodaj stację "finał" w arkuszu.</div>
                  )}
                  {finalQuestions.map(q => (
                    <div key={q.id} className="border-2 border-black p-4 rounded-xl bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400">ID: {q.id}</div>
                        <div className="font-[900] text-lg leading-tight uppercase">{q.text}</div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Czy na pewno chcesz wypuścić to pytanie?')) return;
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, { active: true, currentId: q.id, question: q, showAnswer: false, startTime: serverTimestamp(), stageName: 'FINAŁ' }, { merge: true });
                        }}
                        className={`${neoBtn} bg-[#EAB308] text-black px-6 py-3 shrink-0 w-full md:w-auto`}
                      >
                        PUSH FINAŁ
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Leaderboard db={db} appId={appId} isAdmin={isAdmin} liveStage={liveStage} />
            </div>
          </div>
        )}
      </>
    );
  }

  if (isParticipant && liveStage?.active) {
    return <ParticipantLivePanel db={db} user={user} appId={appId} liveStage={liveStage} />;
  }

  return null;
}

function ParticipantLivePanel({ db, user, appId, liveStage }) {
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localStartTime, setLocalStartTime] = useState(null);

  const isSpectator = !(liveStage?.eligibleUids || []).includes(user?.uid);

  useEffect(() => {
    if (!liveStage?.currentId || !user?.uid || isSpectator) return;
    const resultRef = doc(db, 'artifacts', appId, 'public', 'data', 'stageResults', `${liveStage.currentId}_${user.uid}`);
    const unsub = onSnapshot(resultRef, (docSnap) => {
      if (docSnap.exists()) {
        setAnswered(true);
        setResult(docSnap.data());
      } else {
        setAnswered(false);
        setResult(null);
        setLocalStartTime(Date.now());
      }
    });
    return () => unsub();
  }, [liveStage?.currentId, user?.uid, db, appId, isSpectator]);

  const handleAnswer = async (selectedIdx) => {
    if (answered || isSubmitting || isSpectator) return;
    setIsSubmitting(true);

    try {
      const isCorrect = selectedIdx === liveStage.question.correct;
      const timeDiff = Math.max(0, Date.now() - (localStartTime || Date.now()));
      // Czas na odpowiedź: 15 sekund (15000 ms), za każde 15 ms ubywa 1 pkt z puli 1000 pkt bonusowych.
      const speedBonus = Math.max(0, 1000 - Math.floor(timeDiff / 15));
      const earned = isCorrect ? (1000 + speedBonus) : 0;

      const resultRef = doc(db, 'artifacts', appId, 'public', 'data', 'stageResults', `${liveStage.currentId}_${user.uid}`);
      const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);

      await setDoc(resultRef, {
        questionId: liveStage.currentId,
        uid: user.uid,
        correct: isCorrect,
        earned,
        timeDiff,
        timestamp: serverTimestamp()
      });

      if (earned > 0) {
        await updateDoc(participantRef, {
          totalPoints: increment(earned),
          scoreUpdatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Błąd zapisywania odpowiedzi:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (answered && !isSpectator) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#DC2626] flex flex-col items-center justify-center p-6 text-white animate-in fade-in zoom-in duration-300">
        <div className="bg-white border-[3px] border-black w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <Trophy className="text-[#EAB308] w-16 h-16" />
        </div>
        <h2 className="text-4xl font-[900] uppercase text-center mb-2 tracking-tighter">OCZEKIWANIE NA SYGNAŁ</h2>
        <p className="font-mono text-sm tracking-widest opacity-80 uppercase text-center mb-8">Gotuj się na następne wyzwanie!</p>

        {result && (
          <div className="bg-black/20 p-6 rounded-[24px] border-[3px] border-black text-center w-full max-w-sm">
            <div className="font-mono text-[10px] tracking-widest uppercase mb-1">TWÓJ WYNIK</div>
            <div className="text-4xl font-[900] text-[#EAB308]">{result.earned} PKT</div>
            <div className="font-mono text-xs uppercase mt-2 opacity-70">
              {result.correct ? 'Poprawna odpowiedź!' : 'Niestety, błąd.'}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#F9FAFB] overflow-y-auto p-6 flex flex-col justify-center">
      <div className="max-w-md mx-auto w-full space-y-6">
        <div className={`${neoCard} bg-[#DC2626] p-8 text-white text-center`}>
          <Radio className="w-12 h-12 mx-auto mb-4 animate-pulse text-[#EAB308]" />
          <div className="font-mono text-[10px] tracking-widest uppercase font-bold bg-black/20 px-3 py-1 rounded-full inline-block mb-4">
            {isSpectator ? `WIDZ - ${liveStage.stageName || 'LIVE'}` : `GRACZ - ${liveStage.stageName || 'LIVE'}`}
          </div>
          <h2 className="text-3xl font-[900] uppercase leading-tight">
            {liveStage.question.text}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {liveStage.question.options.map((opt, idx) => {
            let btnClass = isSubmitting || isSpectator ? 'opacity-50' : 'hover:bg-yellow-50';
            if (liveStage.showAnswer && idx === liveStage.question.correct) {
              btnClass = 'bg-green-500 text-white border-green-700 opacity-100 scale-105'; // Podświetlenie poprawnej odpowiedzi
            } else if (liveStage.showAnswer) {
              btnClass = 'opacity-30 grayscale';
            }
            return (
              <button
                key={idx}
                disabled={isSubmitting || isSpectator || liveStage.showAnswer}
                onClick={() => handleAnswer(idx)}
                className={`${neoBtn} bg-white text-black p-6 font-[900] uppercase text-xl flex justify-between items-center text-left transition-all ${btnClass}`}
              >
                <span>{opt}</span>
                <ChevronRight className="w-8 h-8 opacity-30" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ db, appId, isAdmin, liveStage }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'participants'),
      orderBy('totalPoints', 'desc'),
      limit(25)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeaders(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, [db, appId]);

  const togglePlayer = async (uid) => {
    if (!isAdmin) return;
    const current = liveStage?.eligibleUids || [];
    const isEligible = current.includes(uid);
    let next;
    if (isEligible) {
      next = current.filter(id => id !== uid);
    } else {
      next = [...current, uid];
    }
    const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
    await setDoc(liveRef, { eligibleUids: next }, { merge: true });
  };

  return (
    <div className={`${neoCard} p-6 bg-white`}>
      <h2 className="text-2xl font-[900] uppercase mb-2 flex items-center gap-2">
        <Trophy className="w-8 h-8 text-[#EAB308]" />
        RANKING MISTRZÓW
      </h2>
      {isAdmin && (
        <p className="font-mono text-xs text-slate-500 mb-6 uppercase leading-tight">
          Wybierz graczy do finału klikając w ich nick. Podświetleni na zielono biorą udział w aktywnym etapie.
        </p>
      )}
      <div className="space-y-3">
        {leaders.map((l, idx) => {
          const isEligible = liveStage?.eligibleUids?.includes(l.uid);
          return (
            <div 
              key={l.uid} 
              onClick={() => togglePlayer(l.uid)}
              className={`flex justify-between items-center p-4 border-2 border-black rounded-xl transition-all ${isAdmin ? 'cursor-pointer active:scale-95 hover:border-[#DC2626]' : ''} ${isEligible ? 'bg-green-100 border-green-600 shadow-neo-sm' : 'bg-slate-50'}`}
            >
            <div className="flex items-center gap-4">
              <span className="font-[900] text-xl w-6 text-slate-400">{idx + 1}.</span>
              <span className="font-[900] uppercase text-lg">{l.nick}</span>
            </div>
            <span className="font-mono font-bold">{l.totalPoints} PKT</span>
          </div>
          );
        })}
        {leaders.length === 0 && (
          <div className="text-center font-mono text-sm text-slate-500 py-4 uppercase">
            Brak wyników
          </div>
        )}
      </div>
    </div>
  );
}