import React, { useState, useEffect, useRef } from 'react';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp, 
  collection, 
  increment, 
  getDocs, 
  deleteField 
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  Trophy, 
  Radio, 
  Activity, 
  ChevronRight, 
  Megaphone, 
  Shield, 
  X 
} from 'lucide-react';
import { showAlert, showConfirm, showWaitingModal } from './modal';

// Custom Classes Neo-Brutalism
const neoCard = "border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px]";
const neoBtn = "border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all rounded-[16px] font-[900] uppercase";

// Zoptymalizowane konfetti
const CONFETTI_PIECES = Array.from({ length: 150 }).map((_, i) => ({
  key: i,
  style: {
    left: `${Math.random() * 100}vw`,
    animationDuration: `${Math.random() * 3 + 2}s`,
    animationDelay: `${Math.random() * 5}s`,
    transform: `rotate(${Math.random() * 360}deg)`,
  },
  emojiIndex: i % 6,
}));

// Funkcja sortowania uczestników (ujednolicona)
function sortParticipants(a, b) {
  const scoreDiff = (b?.totalPoints || 0) - (a?.totalPoints || 0);
  if (scoreDiff !== 0) return scoreDiff;

  const getTime = (ts) => {
    if (!ts) return Number.MAX_SAFE_INTEGER;
    try {
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.toDate === 'function') return ts.toDate().getTime();
      if (ts.seconds !== undefined) return ts.seconds * 1000;
      const ms = new Date(ts).getTime();
      return isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  };

  const aTime = getTime(a?.scoreUpdatedAt);
  const bTime = getTime(b?.scoreUpdatedAt);
  if (aTime !== bTime) return aTime - bTime;

  const aCreated = getTime(a?.timestamp);
  const bCreated = getTime(b?.timestamp);
  return aCreated - bCreated;
}

// Modal logowania administratora dostępny awaryjnie z każdego ekranu
function AdminLoginModal({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      setError('Wpisz email i hasło!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      if (onLoginSuccess) onLoginSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Błąd logowania administratora');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[24px] p-6 max-w-sm w-full text-black animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-[900] uppercase text-[#DC2626] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#DC2626]" /> LOGOWANIE ADMINA
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>
        <p className="font-mono text-[11px] text-slate-500 uppercase mb-4 leading-tight">
          Zaloguj się kontem administratora, aby natychmiast otworzyć panel Reżyserki / Sztabu.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input 
            type="email" 
            placeholder="Email administratora"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border-2 border-black rounded-lg text-sm font-medium"
            autoFocus
          />
          <input 
            type="password" 
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border-2 border-black rounded-lg text-sm font-medium"
          />
          {error && <div className="text-red-600 font-mono text-xs font-bold leading-tight">{error}</div>}
          <button 
            type="submit" 
            disabled={loading}
            className={`${neoBtn} w-full py-3 bg-[#DC2626] text-white flex justify-center items-center text-sm`}
          >
            {loading ? "LOGOWANIE..." : "ZALOGUJ I OTWÓRZ REŻYSERKĘ"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Główny komponent sceny finałowej
export default function FinalStage({ db, user, userData, appId, stations, isAdmin }) {
  const [liveStage, setLiveStage] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectionModal, setSelectionModal] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
    const unsub = onSnapshot(liveRef, (docSnap) => {
      if (docSnap.exists()) {
        setLiveStage(docSnap.data());
      }
    });
    return () => unsub();
  }, [db, appId]);

  const isParticipant = !isAdmin && user;

  const handleOpenAdmin = () => {
    if (isAdmin) {
      setIsOpen(true);
    } else {
      setShowAdminLogin(true);
    }
  };

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

  const clearAnnouncement = async () => {
    const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
    await setDoc(liveRef, { announcement: deleteField() }, { merge: true });
  };

  if (isAdmin) {
    const currentStageLevel = liveStage?.stageName === 'WYNIKI' ? 3 : liveStage?.stageName === 'FINAŁ' ? 2 : liveStage?.stageName === 'PÓŁFINAŁ' ? 1 : 0;

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

        {/* Przycisk powrotu do Reżyserki na pełnoekranowym podglądzie */}
        {!isOpen && liveStage?.isLiveModeVisible && (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed top-4 right-4 z-[99999] bg-[#DC2626] text-white px-4 py-2 rounded-full border-2 border-black shadow-neo-sm text-xs font-bold flex items-center gap-2 uppercase tracking-wide cursor-pointer active:scale-95"
          >
            <Activity className="w-4 h-4 animate-pulse" />
            REŻYSERKA
          </button>
        )}

        {isOpen && (
          <>
            <div className="fixed inset-0 z-[90] bg-[#F9FAFB] overflow-y-auto overflow-x-hidden p-6 pb-32">
              <div className="max-w-2xl mx-auto space-y-8 mt-12">
                <div className="flex justify-between items-center">
                  <h1 className="text-4xl font-[900] uppercase text-[#DC2626]">REŻYSERKA</h1>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className={`px-4 py-1.5 border-2 border-black rounded-full font-bold uppercase text-[11px] mb-1 ${liveStage?.active ? 'bg-green-400 text-black shadow-neo-sm' : 'bg-slate-200 text-slate-500'}`}>
                        {liveStage?.active ? 'BROADCASTING' : 'OFFLINE'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 font-bold uppercase flex flex-col items-end">
                        <span>ETAP: {liveStage?.stageName || '---'}</span>
                        <span>GRACZY: {liveStage?.eligibleUids?.length || 0}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className={`${neoBtn} bg-black text-white px-4 py-2 text-xs flex items-center gap-1.5`}
                    >
                      <X className="w-4 h-4" /> ZAMKNIJ
                    </button>
                  </div>
                </div>

                {/* KONTROLA STATUSU */}
                <div className={`${neoCard} bg-white p-6 mb-8`}>
                  <h2 className="text-xl font-[900] uppercase mb-4">KONTROLA STATUSU</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={async () => {
                        try {
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, { isLiveModeVisible: true, active: false }, { merge: true });
                        } catch(e) { await showAlert("BŁĄD", e.message); }
                      }}
                      className={`${neoBtn} w-full py-4 bg-red-600 text-white`}
                    >
                      OTWÓRZ PODGLĄD (WSZYSCY)
                    </button>
                    <button
                      onClick={async () => {
                        if(!(await showConfirm("POTWIERDŹ", "Czy na pewno chcesz wyłączyć Finał i przywrócić widok mapy wszystkim użytkownikom?"))) return;
                        try {
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, { isLiveModeVisible: false, active: false }, { merge: true });
                        } catch(e) { await showAlert("BŁĄD", e.message); }
                      }}
                      className={`${neoBtn} w-full py-4 bg-slate-800 text-white`}
                    >
                      ZAMKNIJ PODGLĄD (MAPA)
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        try {
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, { active: false }, { merge: true });
                        } catch(e) { await showAlert("BŁĄD", e.message); }
                      }}
                      className={`${neoBtn} w-full py-4 bg-black text-white`}
                    >
                      UKRYJ PYTANIE
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const allQuestions = [...semifinalQuestions, ...finalQuestions];
                          const activeQ = allQuestions.find(item => item.id === liveStage?.currentId);
                          const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                          await setDoc(liveRef, { 
                            showAnswer: true, 
                            correctAnswer: (activeQ && activeQ.correct !== undefined) ? activeQ.correct : 0 
                          }, { merge: true });
                        } catch(e) { await showAlert("BŁĄD", e.message); }
                      }}
                      className={`${neoBtn} w-full py-4 bg-green-400 text-black`}
                    >
                      POKAŻ ODP. WIDZOM
                    </button>
                  </div>
                </div>

                {/* OGŁOSZENIA NA EKRANACH */}
                <div className={`${neoCard} p-6 bg-green-50`}>
                  <h2 className="text-xl font-[900] uppercase mb-4 flex items-center gap-2"><Megaphone /> OGŁOSZENIA NA EKRANACH</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onClick={() => setSelectionModal({ stageName: 'PÓŁFINAŁ', count: 10, announcement: { type: 'semifinalists', title: 'PÓŁFINALIŚCI TURNIEJU', subtitle: 'Oto 10 najlepszych graczy z eliminacji!' } })} className={`${neoBtn} py-3 bg-blue-500 text-white text-[11px] lg:text-sm ${currentStageLevel >= 2 ? 'opacity-50 grayscale' : ''}`}>
                      OGŁOŚ PÓŁFINALISTÓW (TOP 10)
                    </button>
                    <button onClick={() => setSelectionModal({ stageName: 'FINAŁ', count: 5, announcement: { type: 'finalists', title: 'FINALIŚCI TURNIEJU', subtitle: 'Oto gracze, którzy zmierzą się w wielkim finale!' } })} className={`${neoBtn} py-3 bg-green-600 text-white text-[11px] lg:text-sm ${currentStageLevel >= 3 ? 'opacity-50 grayscale' : ''}`}>
                      OGŁOŚ FINALISTÓW (TOP 5)
                    </button>
                    <button onClick={() => setSelectionModal({ stageName: 'WYNIKI', count: 3, announcement: { type: 'winners', title: 'MISTRZOWIE TURNIEJU', subtitle: 'Gratulacje dla najlepszych!' } })} className={`${neoBtn} py-3 bg-yellow-400 text-black text-[11px] lg:text-sm`}>
                      OGŁOŚ ZWYCIĘZCÓW (TOP 3)
                    </button>
                  </div>
                  {liveStage?.announcement && (
                    <div className="mt-6 p-4 border-[3px] border-red-500 bg-white rounded-[16px] text-center shadow-neo-sm">
                      <div className="font-[900] text-red-600 uppercase mb-2 text-lg">AKTYWNE OGŁOSZENIE: {liveStage.announcement.title}</div>
                      <button onClick={clearAnnouncement} className={`${neoBtn} w-full py-3 bg-red-600 text-white`}>
                        UKRYJ OGŁOSZENIE (WRÓĆ DO SCENY)
                      </button>
                    </div>
                  )}
                </div>

                {/* SEKCJA PÓŁFINAŁU */}
                <div className={`${neoCard} p-6 bg-blue-50`}>
                  <h2 className="text-2xl font-[900] uppercase mb-6">1. PÓŁFINAŁ</h2>
                  <div className="space-y-4">
                    {semifinalQuestions.length === 0 && (
                      <div className="font-mono text-xs text-slate-500 uppercase">Brak pytań. Dodaj stację "półfinał" w arkuszu.</div>
                    )}
                    {semifinalQuestions.map(q => {
                      const isLive = liveStage?.active && liveStage?.currentId === q.id;
                      const isAsked = !isLive && liveStage?.askedQuestions?.includes(q.id);
                      return (
                        <div key={q.id} className={`border-2 border-black p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${isLive ? 'bg-green-100 border-green-500 shadow-neo-sm scale-[1.02]' : isAsked ? 'bg-slate-100 opacity-50 grayscale' : 'bg-white'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400">ID: {q.id}</div>
                            <div className="font-[900] text-lg leading-tight uppercase break-words whitespace-normal">{q.text}</div>
                          </div>
                          <button
                            disabled={isLive}
                            onClick={async () => {
                              if (!(await showConfirm("POTWIERDŹ", isAsked ? "To pytanie było już zadane. Czy na pewno chcesz je powtórzyć?" : "Czy na pewno chcesz wypuścić to pytanie?"))) return;
                              const asked = liveStage?.askedQuestions || [];
                              const newAsked = asked.includes(q.id) ? asked : [...asked, q.id];
                              const publicQuestion = { id: q.id, text: q.text, options: q.options };
                              const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                              await setDoc(liveRef, { 
                                isLiveModeVisible: true, 
                                active: true, 
                                currentId: q.id, 
                                question: publicQuestion, 
                                showAnswer: false, 
                                correctAnswer: deleteField(),
                                startTime: serverTimestamp(), 
                                stageName: 'PÓŁFINAŁ',
                                announcement: deleteField(),
                                askedQuestions: newAsked
                              }, { merge: true });
                            }}
                            className={`${neoBtn} ${isAsked ? 'bg-slate-500' : 'bg-[#3B82F6]'} text-white px-6 py-3 shrink-0 w-full md:w-auto`}
                          >
                            {isLive ? 'NA ŻYWO' : isAsked ? 'POWTÓRZ' : 'PUSH PÓŁFINAŁ'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SEKCJA FINAŁU */}
                <div className={`${neoCard} p-6 bg-yellow-50`}>
                  <h2 className="text-2xl font-[900] uppercase mb-6">2. FINAŁ</h2>
                  <div className="space-y-4">
                    {finalQuestions.length === 0 && (
                      <div className="font-mono text-xs text-slate-500 uppercase">Brak pytań. Dodaj stację "finał" w arkuszu.</div>
                    )}
                    {finalQuestions.map(q => {
                      const isLive = liveStage?.active && liveStage?.currentId === q.id;
                      const isAsked = !isLive && liveStage?.askedQuestions?.includes(q.id);
                      return (
                        <div key={q.id} className={`border-2 border-black p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${isLive ? 'bg-green-100 border-green-500 shadow-neo-sm scale-[1.02]' : isAsked ? 'bg-slate-100 opacity-50 grayscale' : 'bg-white'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400">ID: {q.id}</div>
                            <div className="font-[900] text-lg leading-tight uppercase break-words whitespace-normal">{q.text}</div>
                          </div>
                          <button
                            disabled={isLive}
                            onClick={async () => {
                              if (!(await showConfirm("POTWIERDŹ", isAsked ? "To pytanie było już zadane. Czy na pewno chcesz je powtórzyć?" : "Czy na pewno chcesz wypuścić to pytanie?"))) return;
                              const asked = liveStage?.askedQuestions || [];
                              const newAsked = asked.includes(q.id) ? asked : [...asked, q.id];
                              const publicQuestion = { id: q.id, text: q.text, options: q.options };
                              const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
                              await setDoc(liveRef, { 
                                isLiveModeVisible: true, 
                                active: true, 
                                currentId: q.id, 
                                question: publicQuestion, 
                                showAnswer: false, 
                                correctAnswer: deleteField(),
                                startTime: serverTimestamp(), 
                                stageName: 'FINAŁ',
                                announcement: deleteField(),
                                askedQuestions: newAsked
                              }, { merge: true });
                            }}
                            className={`${neoBtn} ${isAsked ? 'bg-slate-500 text-white' : 'bg-[#EAB308] text-black'} px-6 py-3 shrink-0 w-full md:w-auto`}
                          >
                            {isLive ? 'NA ŻYWO' : isAsked ? 'POWTÓRZ' : 'PUSH FINAŁ'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Leaderboard db={db} appId={appId} isAdmin={isAdmin} liveStage={liveStage} />
              </div>
            </div>

            {selectionModal && (
              <PlayerSelectionModal
                db={db}
                appId={appId}
                stageName={selectionModal.stageName}
                limitCount={selectionModal.count}
                announcement={selectionModal.announcement}
                onClose={() => setSelectionModal(null)}
                liveStage={liveStage}
              />
            )}
          </>
        )}
      </>
    );
  }

  if (isParticipant && liveStage?.isLiveModeVisible) {
    return (
      <>
        {liveStage.announcement ? (
          <AnnouncementPanel
            title={liveStage.announcement.title}
            subtitle={liveStage.announcement.subtitle}
            type={liveStage.announcement.type}
            showConfetti={liveStage.announcement.type === 'winners'}
            db={db}
            appId={appId}
            liveStage={liveStage}
            onOpenAdmin={handleOpenAdmin}
          />
        ) : (
          <ParticipantLivePanel 
            db={db} 
            user={user} 
            userData={userData} 
            appId={appId} 
            liveStage={liveStage} 
            onOpenAdmin={handleOpenAdmin}
          />
        )}
        {showAdminLogin && (
          <AdminLoginModal 
            onClose={() => setShowAdminLogin(false)} 
            onLoginSuccess={() => {
              setShowAdminLogin(false);
              setIsOpen(true);
            }} 
          />
        )}
      </>
    );
  }

  return null;
}

// Panel gracza / widza na żywo
function ParticipantLivePanel({ db, user, userData, appId, liveStage, onOpenAdmin }) {
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  // Blokada przed spamowaniem kliknięć
  const clickLockRef = useRef(false);
  const closeModalRef = useRef(null);
  const questionRenderedAtRef = useRef(Date.now());

  // Automatyczne zamykanie modalu przy zmianie pytania lub wyłączeniu
  useEffect(() => {
    if (closeModalRef.current) {
      closeModalRef.current(); 
      closeModalRef.current = null;
    }
    return () => {
      if (closeModalRef.current) {
        closeModalRef.current();
        closeModalRef.current = null;
      }
    };
  }, [liveStage?.currentId, liveStage?.active]);

  const getStageColors = () => {
    switch (liveStage?.stageName) {
      case 'PÓŁFINAŁ':
        return { bg: 'bg-[#3B82F6]', text: 'text-white', accent: 'text-white', tagBg: 'bg-black/20' };
      case 'FINAŁ':
        return { bg: 'bg-[#EAB308]', text: 'text-black', accent: 'text-black', tagBg: 'bg-black/20' };
      default:
        return { bg: 'bg-[#DC2626]', text: 'text-white', accent: 'text-[#EAB308]', tagBg: 'bg-black/20' };
    }
  };

  const stageColors = getStageColors();
  const isSpectator = !(liveStage?.eligibleUids || []).includes(user?.uid);

  useEffect(() => {
    clickLockRef.current = false;
    questionRenderedAtRef.current = Date.now();

    if (userData?.finalAnswers?.[liveStage?.currentId]) {
      setAnswered(true);
      setResult(userData.finalAnswers[liveStage.currentId]);
      setHasAttempted(true);
      clickLockRef.current = true;
    }

    if (!liveStage?.currentId || !user?.uid || isSpectator) return;
    
    const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
    const unsub = onSnapshot(participantRef, (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const finalAnswers = data.finalAnswers || {};
          
          if (finalAnswers[liveStage.currentId]) {
            setAnswered(true);
            setResult(finalAnswers[liveStage.currentId]);
            clickLockRef.current = true; 
          } else {
            setAnswered(false);
            setResult(null);
            setHasAttempted(false);
            setSelectedAnswer(null);
          }
        } else {
          setAnswered(false);
          setHasAttempted(false);
          setResult(null);
        }
      } catch (err) { console.error('Błąd w trakcie nasłuchiwania na odpowiedzi finałowe:', err); }
    });
    return () => unsub();
  }, [liveStage?.currentId, user?.uid, db, appId, isSpectator, userData]);

  // Automatyczne naliczanie punktów, gdy prowadzący odsłoni poprawną odpowiedź (showAnswer)
  useEffect(() => {
    if (!liveStage?.showAnswer || liveStage.correctAnswer === undefined || !liveStage?.currentId) return;
    if (isSpectator || !user?.uid) return;

    const myAnswer = userData?.finalAnswers?.[liveStage.currentId];
    if (!myAnswer || myAnswer.status === 'scored' || myAnswer.earned !== undefined) return;

    const isCorrect = myAnswer.selectedAnswer === liveStage.correctAnswer;
    const earned = isCorrect ? (1000 + (myAnswer.speedBonus ?? 0)) : 0;

    const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
    const updates = {
      [`finalAnswers.${liveStage.currentId}.correct`]: isCorrect,
      [`finalAnswers.${liveStage.currentId}.earned`]: earned,
      [`finalAnswers.${liveStage.currentId}.status`]: 'scored'
    };
    if (earned > 0) {
      updates.totalPoints = increment(earned);
      updates.scoreUpdatedAt = serverTimestamp();
    }
    setDoc(participantRef, updates, { merge: true }).catch((err) => console.error("Błąd zapisu punktacji finałowej:", err));
  }, [liveStage?.showAnswer, liveStage?.correctAnswer, liveStage?.currentId, isSpectator, user?.uid, userData?.finalAnswers, db, appId]);

  const handleAnswer = async (selectedIdx) => {
    if (clickLockRef.current || answered || hasAttempted || isSubmitting || isSpectator) return;
    clickLockRef.current = true; 
    
    setIsSubmitting(true);
    setSelectedAnswer(selectedIdx);
    setHasAttempted(true);

    try {
      const elapsedOnDevice = Math.max(0, Date.now() - questionRenderedAtRef.current);
      const speedBonus = Math.max(0, 1000 - Math.floor(elapsedOnDevice / 15));

      const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
      const updates = {
        [`finalAnswers.${liveStage.currentId}`]: {
          selectedAnswer: selectedIdx,
          answerTime: serverTimestamp(),
          timeDiff: elapsedOnDevice,
          speedBonus: speedBonus,
          status: 'pending'
        }
      };

      await setDoc(participantRef, updates, { merge: true });

      showWaitingModal(
        'ODPOWIEDŹ ZAPISANA!', 
        `Twój czas: ${elapsedOnDevice}ms. Czekaj na sygnał od prowadzącego!`, 
        (closeFunction) => {
          closeModalRef.current = closeFunction; 
        }
      );
    } catch (err) {
      console.error('Błąd zapisywania odpowiedzi:', err);
      clickLockRef.current = false; 
      showAlert(
        "Wystąpił problem", 
        err.message,
        (closeFunction) => {
          closeModalRef.current = closeFunction; 
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!liveStage?.active || (answered && !isSpectator)) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#DC2626] overflow-y-auto p-6 text-white animate-in fade-in zoom-in duration-300 flex flex-col">
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="fixed top-4 right-4 z-[99999] opacity-50 hover:opacity-100 transition-all bg-black/80 hover:bg-black text-white px-3 py-1.5 rounded-full border border-white/40 shadow-lg text-[11px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md cursor-pointer active:scale-95"
            title="Awaryjny dostęp: Reżyserka / Sztab"
          >
            <Shield className="w-3.5 h-3.5 text-yellow-400" />
            <span>SZTAB</span>
          </button>
        )}
        <div className="my-auto flex flex-col items-center justify-center py-8 shrink-0">
          <div className="bg-white border-[3px] border-black w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 shrink-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {liveStage?.active ? <Trophy className="text-[#EAB308] w-16 h-16" /> : <Activity className="text-[#EAB308] w-16 h-16 animate-pulse" />}
          </div>
          <h2 className="text-4xl font-[900] uppercase text-center mb-2 tracking-tighter shrink-0 break-words whitespace-normal">
            {liveStage?.active ? "ODPOWIEDŹ ZAPISANA" : "SCENA GŁÓWNA"}
          </h2>
          <p className="font-mono text-sm tracking-widest opacity-80 uppercase text-center mb-8 shrink-0 break-words whitespace-normal">
            {liveStage?.active ? "Czekaj na dalsze kroki!" : "Oczekuj na sygnał od prowadzącego!"}
          </p>

          {result && !isSpectator && (
            <div className="bg-black/20 p-6 rounded-[24px] border-[3px] border-black text-center w-full max-w-sm shrink-0">
              <div className="font-mono text-[10px] tracking-widest uppercase mb-1">TWÓJ WYNIK ZA PYTANIE</div>
              <div className="text-4xl font-[900] text-[#EAB308]">
                {result.earned !== undefined ? `${result.earned} PKT` : "OCZEKIWANIE..."}
              </div>
              <div className="font-mono text-xs uppercase mt-2 opacity-70">
                {result.earned !== undefined
                  ? (result.correct ? 'Poprawna odpowiedź!' : 'Niestety, błąd.')
                  : 'Prowadzący zaraz odsłoni poprawną odpowiedź!'}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#F9FAFB] overflow-y-auto overflow-x-hidden p-6 flex flex-col">
      {onOpenAdmin && (
        <button
          onClick={onOpenAdmin}
          className="fixed top-4 right-4 z-[99999] opacity-50 hover:opacity-100 transition-all bg-black/80 hover:bg-black text-white px-3 py-1.5 rounded-full border border-white/40 shadow-lg text-[11px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md cursor-pointer active:scale-95"
          title="Awaryjny dostęp: Reżyserka / Sztab"
        >
          <Shield className="w-3.5 h-3.5 text-yellow-400" />
          <span>SZTAB</span>
        </button>
      )}
      <div className="my-auto max-w-md mx-auto w-full space-y-6 py-8 shrink-0 relative">
        <div className={`${neoCard} ${stageColors.bg} p-8 ${stageColors.text} text-center`}>
          <Radio className={`w-12 h-12 mx-auto mb-4 animate-pulse ${stageColors.accent}`} />
          <div className={`font-mono text-[10px] tracking-widest uppercase font-bold ${stageColors.tagBg} px-3 py-1 rounded-full inline-block mb-4`}>
            {isSpectator ? `WIDZ - ${liveStage?.stageName || 'LIVE'}` : `GRACZ - ${liveStage?.stageName || 'LIVE'}`}
          </div>
          <h2 className="text-[clamp(1.5rem,6vw,1.875rem)] font-[900] uppercase leading-tight break-words whitespace-normal">
            {liveStage?.question?.text || "Wczytywanie pytania..."}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isSpectator && !liveStage?.showAnswer ? (
            <div className="text-center p-8 bg-white border-[3px] border-black rounded-[24px] shadow-neo-sm opacity-80 mt-4">
              <div className="font-[900] uppercase text-xl mb-2">Trwa głosowanie...</div>
              <div className="font-mono text-xs uppercase font-bold text-slate-500">Warianty odpowiedzi są ukryte dla widzów, aby uniknąć podpowiadania.</div>
            </div>
          ) : (
            (liveStage?.question?.options || []).map((opt, idx) => {
              let btnClass = 'bg-white text-black hover:bg-yellow-50';
              if (isSubmitting && !isSpectator) {
                btnClass = selectedAnswer === idx ? 'bg-yellow-400 text-black' : 'bg-white text-black opacity-30 grayscale';
              } else if (isSpectator && !liveStage.showAnswer) {
                btnClass = 'bg-white text-black opacity-50';
              } else if (liveStage.showAnswer && idx === liveStage?.correctAnswer) {
                btnClass = 'bg-green-500 text-white border-green-700 opacity-100 scale-105'; 
              } else if (liveStage.showAnswer) {
                btnClass = 'bg-white text-black opacity-30 grayscale';
              }
              return (
                <button
                  key={idx}
                  disabled={hasAttempted || isSubmitting || isSpectator || liveStage.showAnswer || answered}
                  onClick={() => handleAnswer(idx)}
                  className={`${neoBtn} p-5 md:p-6 font-[900] uppercase text-[clamp(1rem,5vw,1.25rem)] flex justify-between items-center text-left transition-all ${btnClass} gap-3`}
                >
                  <span className="min-w-0 break-words whitespace-normal">{opt}</span>
                  <ChevronRight className="w-8 h-8 opacity-30 shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Modal rankingu
export function LeaderboardModal({ db, appId, liveStage, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95">
        <div className="overflow-y-auto flex-1 mb-4">
          <Leaderboard db={db} appId={appId} liveStage={liveStage} limitCount={20} />
        </div>
        <button onClick={onClose} className={`${neoBtn} w-full py-4 bg-black text-white flex justify-center items-center text-sm`}>
          ZAMKNIJ RANKING
        </button>
      </div>
    </div>
  );
}

// Konfetti
function Confetti() {
  const emojis = ['🎉', '🎊', '🏆', '🥇', '⭐', '🎈'];
  return (
    <>
      <style>{`
        @keyframes fall {
          0% { top: -10vh; opacity: 1; }
          100% { top: 110vh; opacity: 1; }
        }
        .confetti-piece {
          position: absolute;
          top: -10vh;
          font-size: 1.5rem;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
          user-select: none;
        }
        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 9999;
        }
      `}</style>
      <div className="confetti-container">
        {CONFETTI_PIECES.map((piece) => (
          <div key={piece.key} className="confetti-piece" style={piece.style}>
            {emojis[piece.emojiIndex]}
          </div>
        ))}
      </div>
    </>
  );
}

// Panel ogłoszeń (półfinaliści, finaliści, zwycięzcy)
function AnnouncementPanel({ title, subtitle, showConfetti, type, db, appId, liveStage, onOpenAdmin }) {
  const limit = type === 'semifinalists' ? 10 : (type === 'finalists' ? 5 : 3);
  return (
    <div className="fixed inset-0 z-[100] bg-black text-white animate-in fade-in zoom-in duration-500 overflow-y-auto flex flex-col">
      {showConfetti && <Confetti />}
      {onOpenAdmin && (
        <button
          onClick={onOpenAdmin}
          className="fixed top-4 right-4 z-[99999] opacity-50 hover:opacity-100 transition-all bg-black/80 hover:bg-black text-white px-3 py-1.5 rounded-full border border-white/40 shadow-lg text-[11px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md cursor-pointer active:scale-95"
          title="Awaryjny dostęp: Reżyserka / Sztab"
        >
          <Shield className="w-3.5 h-3.5 text-yellow-400" />
          <span>SZTAB</span>
        </button>
      )}
      <div className="my-auto flex flex-col items-center justify-center p-6 py-12 shrink-0">
        <Trophy className="text-yellow-400 w-24 h-24 mb-6 drop-shadow-[0_5px_15px_rgba(250,204,21,0.4)] shrink-0" />
        <h1 className="text-[clamp(1.75rem,8vw,3rem)] font-[900] uppercase text-center mb-2 tracking-tighter shrink-0 break-words">{title}</h1>
        <p className="font-mono text-[clamp(0.7rem,3vw,0.875rem)] tracking-widest opacity-80 uppercase text-center mb-8 shrink-0 break-words">{subtitle}</p>
        <div className="w-full max-w-2xl bg-white/10 p-2 md:p-4 rounded-[32px] shrink-0 text-black text-left overflow-hidden">
          <Leaderboard db={db} appId={appId} liveStage={liveStage} limitCount={limit} filterEligible={true} />
        </div>
      </div>
    </div>
  );
}

// Tabela rankingu
function Leaderboard({ db, appId, isAdmin = false, liveStage, limitCount = 20, filterEligible = false }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => d.data());
      all.sort(sortParticipants);
      setLeaders(all);
    }, (err) => console.error("Ranking error:", err));
    return () => unsub();
  }, [db, appId]);

  let displayedLeaders = leaders;
  if (filterEligible && liveStage?.eligibleUids && liveStage.eligibleUids.length > 0) {
    displayedLeaders = displayedLeaders.filter(l => liveStage.eligibleUids.includes(l.uid));
    displayedLeaders.sort((a, b) => {
      const indexA = liveStage.eligibleUids.indexOf(a.uid);
      const indexB = liveStage.eligibleUids.indexOf(b.uid);
      return indexA - indexB;
    });
  }
  displayedLeaders = displayedLeaders.slice(0, limitCount);

  return (
    <div className={`${neoCard} p-6 bg-white text-black`}>
      <h2 className="text-2xl font-[900] uppercase mb-2 flex items-center gap-2">
        <Trophy className="w-8 h-8 text-[#EAB308]" />
        RANKING MISTRZÓW
      </h2>
      {isAdmin && (
        <p className="font-mono text-xs text-slate-500 mb-6 uppercase leading-tight">
          Poniżej znajduje się ogólny ranking na żywo. Podświetleni na zielono biorą aktualnie udział w wybranym etapie. Aby zaktualizować listę, użyj przycisków weryfikacji.
        </p>
      )}
      <div className="space-y-3">
        {displayedLeaders.map((l, idx) => {
          const isEligible = liveStage?.eligibleUids?.includes(l.uid);
          return (
            <div 
              key={l.uid} 
              className={`flex justify-between items-center p-4 border-2 border-black rounded-xl transition-all ${isEligible ? 'bg-green-100 border-green-600 shadow-neo-sm' : 'bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <span className="font-[900] text-xl w-6 text-slate-400">{idx + 1}.</span>
                <span className="font-[900] uppercase text-lg truncate max-w-[120px] md:max-w-[200px]">{l.nick}</span>
              </div>
              <span className="font-mono font-bold">{l.totalPoints} PKT</span>
            </div>
          );
        })}
        {displayedLeaders.length === 0 && (
          <div className="text-center font-mono text-sm text-slate-500 py-4 uppercase">
            Brak wyników
          </div>
        )}
      </div>
    </div>
  );
}

// Modal weryfikacji i doboru graczy
function PlayerSelectionModal({ db, appId, stageName, limitCount, announcement, onClose, liveStage }) {
  const [players, setPlayers] = useState([]);
  const [selectedUids, setSelectedUids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
        const snap = await getDocs(q);
        const all = snap.docs.map(d => d.data());
        
        all.sort(sortParticipants);

        // Pula TOP 40 do wyboru
        const top40 = all.slice(0, 40);
        setPlayers(top40);

        const targetCount = Math.min(limitCount, top40.length);
        const existingUids = (liveStage?.stageName === stageName && Array.isArray(liveStage.eligibleUids)) ? liveStage.eligibleUids : null;
        if (existingUids && existingUids.length > 0) {
          setSelectedUids(existingUids);
        } else {
          setSelectedUids(top40.slice(0, targetCount).map(p => p.uid));
        }

        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [db, appId, limitCount, stageName, liveStage]);

  const targetCount = Math.min(limitCount, players.length);

  const toggle = (uid) => {
    if (selectedUids.includes(uid)) {
      setSelectedUids(prev => prev.filter(id => id !== uid));
    } else {
      setSelectedUids(prev => [...prev, uid]);
    }
  };

  const handleConfirm = async () => {
    if (players.length > 0 && selectedUids.length !== targetCount) {
      await showAlert("UWAGA", `Liczba zaznaczonych graczy (${selectedUids.length}) nie zgadza się z wymaganą liczbą dla tego etapu (${targetCount}).\n\nUpewnij się, że wybrałeś dokładnie ${targetCount} osób.`);
      return;
    }

    try {
      const liveRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'liveStage');
      const payload = { eligibleUids: selectedUids, stageName };
      if (announcement) {
        payload.announcement = announcement;
        payload.isLiveModeVisible = true;
        payload.active = false;
      }
      await setDoc(liveRef, payload, { merge: true });
      onClose();
      showAlert("SUKCES", announcement ? `Zatwierdzono listę ${selectedUids.length} graczy i opublikowano ogłoszenie!` : `Zatwierdzono listę ${selectedUids.length} graczy dla etapu: ${stageName}!`);
    } catch (e) {
      console.error(e);
      showAlert("BŁĄD", e.message);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '--:--:--.---';
    try {
      const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return '--:--:--.---';
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      const s = d.getSeconds().toString().padStart(2, '0');
      const ms = d.getMilliseconds().toString().padStart(3, '0');
      return `${h}:${m}:${s}.${ms}`;
    } catch {
      return '--:--:--.---';
    }
  };

  const formatDuration = (startTs, endTs) => {
    if (!startTs || !endTs) return '--';
    try {
      const start = new Date(startTs).getTime();
      const end = typeof endTs.toDate === 'function' ? endTs.toDate().getTime() : new Date(endTs).getTime();
      if (isNaN(start) || isNaN(end) || end < start) return '--';
      const diff = end - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    } catch {
      return '--';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95">
        <h2 className="text-3xl font-[900] uppercase mb-2">WERYFIKACJA: {stageName}</h2>
        <p className="font-mono text-[11px] text-slate-600 mb-4 leading-tight uppercase font-bold">
          Zaznacz graczy, którzy są obecni na scenie. System domyślnie zaznaczył TOP {targetCount}, ale w razie nieobecności kogoś z czołówki, możesz dobrać osoby z rezerwy (miejsca {targetCount + 1}-40).
        </p>
        <div className="overflow-y-auto flex-1 border-2 border-black rounded-xl p-2 space-y-2 mb-4 bg-slate-50">
          {loading ? (
            <div className="p-4 text-center font-mono text-sm uppercase font-bold">Pobieranie wyników...</div>
          ) : (
            players.map((p, idx) => {
              const isSelected = selectedUids.includes(p.uid);
              return (
                <div key={p.uid} onClick={() => toggle(p.uid)} className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer active:scale-95 transition-transform ${isSelected ? 'bg-green-400 shadow-neo-sm' : 'bg-white opacity-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="font-[900] w-6 text-right opacity-60 shrink-0">{idx + 1}.</div>
                    <div className="font-[900] uppercase truncate max-w-[100px] md:max-w-[200px]">{p.nick}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold">{p.totalPoints} PKT</div>
                    <div className="font-mono text-[10px] text-slate-500">{formatTimestamp(p.scoreUpdatedAt)}</div>
                    <div className="font-mono text-[9px] text-slate-400 uppercase">Czas gry: {formatDuration(p.timestamp, p.scoreUpdatedAt)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-4 shrink-0 mt-2">
          <button onClick={onClose} className={`${neoBtn} w-1/3 py-4 bg-slate-200 text-black text-sm`}>ANULUJ</button>
          <button onClick={handleConfirm} className={`${neoBtn} w-2/3 py-4 bg-[#DC2626] text-white flex justify-center items-center gap-2 text-sm`}>
            ZATWIERDŹ <span className="bg-white text-black px-2 py-1 rounded-full text-[10px]">{selectedUids.length}/{targetCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}