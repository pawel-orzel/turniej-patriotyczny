import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, increment } from 'firebase/firestore';
import { Trophy, Radio, Activity, ChevronRight } from 'lucide-react';

const ADMIN_UID = "bLh8osMPACdoM2psBiOoPp0r4KE3";

// Custom Classes Neo-Brutalism
const neoCard = "border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] bg-white";
const neoBtn = "border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all rounded-[16px] font-[900] uppercase";

const FINAL_QUESTIONS = [
  {
    id: 'q1',
    text: 'W którym roku Toruń powrócił do macierzy?',
    options: ['1918', '1920', '1939', '1945'],
    correct: 1
  },
  {
    id: 'q2',
    text: 'Ile promieni ma lilijka skautowa?',
    options: ['2', '3', '5', '10'],
    correct: 1
  },
  {
    id: 'q3',
    text: 'Kto napisał tekst "Roty"?',
    options: ['M. Konopnicka', 'H. Sienkiewicz', 'J. Wybicki', 'A. Mickiewicz'],
    correct: 0
  },
  {
    id: 'q4',
    text: 'Który król założył Toruń?',
    options: ['Kazimierz Wielki', 'Władysław Jagiełło', 'Brak, założyli go Krzyżacy', 'Bolesław Chrobry'],
    correct: 2
  },
  {
    id: 'q5',
    text: 'Co symbolizuje węzeł płaski na chuście skautowej?',
    options: ['Przyjaźń', 'Dobry uczynek', 'Wierność', 'Gotowość'],
    correct: 1
  }
];

export default function FinalStage({ db, user, appId }) {
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

  if (isAdmin) {
    return (
      <>
        <button
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
                <div className={`px-4 py-2 border-2 border-black rounded-full font-bold uppercase text-xs ${liveStage?.active ? 'bg-green-400 text-black shadow-neo-sm' : 'bg-slate-200 text-slate-500'}`}>
                  {liveStage?.active ? 'STATUS: BROADCASTING' : 'STATUS: OFFLINE'}
                </div>
              </div>

              <div className={`${neoCard} p-6`}>
                <button
                  onClick={async () => {
                    const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                    await updateDoc(liveRef, { active: false });
                  }}
                  className={`${neoBtn} w-full py-4 bg-black text-white`}
                >
                  ZATRZYMAJ LIVE
                </button>
              </div>

              <div className={`${neoCard} p-6 bg-yellow-50`}>
                <h2 className="text-2xl font-[900] uppercase mb-4">PYTANIA FINAŁOWE</h2>
                <div className="space-y-4">
                  {FINAL_QUESTIONS.map(q => (
                    <div key={q.id} className="border-2 border-black p-4 rounded-xl bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400">ID: {q.id}</div>
                        <div className="font-[900] text-lg leading-tight uppercase">{q.text}</div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Czy na pewno chcesz wypuścić to pytanie do wszystkich?')) return;
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, {
                            active: true,
                            currentId: q.id,
                            question: q,
                            startTime: serverTimestamp()
                          }, { merge: true });
                        }}
                        className={`${neoBtn} bg-[#EAB308] text-black px-6 py-3 shrink-0 w-full md:w-auto`}
                      >
                        PUSH PYTANIE
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Leaderboard db={db} appId={appId} />
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

  useEffect(() => {
    if (!liveStage?.currentId || !user?.uid) return;
    const resultRef = doc(db, 'artifacts', appId, 'public', 'data', 'stageResults', `${liveStage.currentId}_${user.uid}`);
    const unsub = onSnapshot(resultRef, (docSnap) => {
      if (docSnap.exists()) {
        setAnswered(true);
        setResult(docSnap.data());
      } else {
        setAnswered(false);
        setResult(null);
      }
    });
    return () => unsub();
  }, [liveStage?.currentId, user?.uid, db, appId]);

  const handleAnswer = async (selectedIdx) => {
    if (answered || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const isCorrect = selectedIdx === liveStage.question.correct;
      const startValue = liveStage.startTime;
      const startMs = startValue?.toMillis ? startValue.toMillis() : (startValue ? new Date(startValue).getTime() : Date.now());
      
      const timeDiff = Date.now() - startMs;
      const speedBonus = Math.max(0, 1000 - Math.floor(timeDiff / 10));
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

  if (answered) {
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
            PYTANIE NA ŻYWO
          </div>
          <h2 className="text-3xl font-[900] uppercase leading-tight">
            {liveStage.question.text}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {liveStage.question.options.map((opt, idx) => (
            <button
              key={idx}
              disabled={isSubmitting}
              onClick={() => handleAnswer(idx)}
              className={`${neoBtn} bg-white text-black p-6 font-[900] uppercase text-xl flex justify-between items-center text-left ${isSubmitting ? 'opacity-50' : 'hover:bg-yellow-50'}`}
            >
              <span>{opt}</span>
              <ChevronRight className="w-8 h-8 opacity-30" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ db, appId }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'participants'),
      orderBy('totalPoints', 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeaders(snap.docs.map(d => d.data()));
    });
    return () => unsub();
  }, [db, appId]);

  return (
    <div className={`${neoCard} p-6 bg-white`}>
      <h2 className="text-2xl font-[900] uppercase mb-6 flex items-center gap-2">
        <Trophy className="w-8 h-8 text-[#EAB308]" />
        RANKING MISTRZÓW
      </h2>
      <div className="space-y-3">
        {leaders.map((l, idx) => (
          <div key={l.uid} className="flex justify-between items-center p-4 border-2 border-black rounded-xl bg-slate-50">
            <div className="flex items-center gap-4">
              <span className="font-[900] text-xl w-6 text-slate-400">{idx + 1}.</span>
              <span className="font-[900] uppercase text-lg">{l.nick}</span>
            </div>
            <span className="font-mono font-bold">{l.totalPoints} PKT</span>
          </div>
        ))}
        {leaders.length === 0 && (
          <div className="text-center font-mono text-sm text-slate-500 py-4 uppercase">
            Brak wyników
          </div>
        )}
      </div>
    </div>
  );
}