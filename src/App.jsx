import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  updateDoc,
  arrayUnion,
  query
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';
import { 
  User, Trophy, Coffee, Shield, Heart, Zap, 
  CheckCircle, ChevronRight, Medal, 
  MapPin, Flag, Timer, Info
} from 'lucide-react';

// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCmfjCLK4zpMW95PQ5JnRosdFtwzRLcB80",
  authDomain: "liturgiczne-labirynty-wiary.firebaseapp.com",
  projectId: "liturgiczne-labirynty-wiary",
  storageBucket: "liturgiczne-labirynty-wiary.firebasestorage.app",
  messagingSenderId: "729398904317",
  appId: "1:729398904317:web:c5ba0375a7c42aa3280594",
  measurementId: "G-XXZR5KK5BD"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'weekend-patriotyczny-torun';

// --- DEFINICJA STACJI ZGODNIE Z KOLORAMI FORMACJI LLW ---
const STATIONS = {
  kawa: { 
    id: 'kawa',
    name: 'KAWA U ANDRZEJA', 
    icon: Coffee, 
    points: 10, 
    category: 'SPOŁECZNY',
    question: "Z jakiego kraju pochodzi rzemieślnicza kawa serwowana u Andrzeja?", 
    options: ["ETIOPIA", "RUANDA", "BRAZYLIA", "WIETNAM"], 
    correct: 1,
    color: '#DC2626' // Czerwony LLW
  },
  skauci: { 
    id: 'skauci',
    name: 'OBÓZ SKAUTÓW KRÓLA', 
    icon: Shield, 
    points: 15, 
    category: 'SKAUTING',
    question: "Co oznacza oficjalne zawołanie Skautów Króla?", 
    options: ["CZUWAJ!", "ZAWSZE GOTÓW!", "GOTÓW!", "Z PANEM BOGIEM!"], 
    correct: 2,
    color: '#22C55E' // Zielony LLW
  },
  gastronomia: { 
    id: 'gastronomia',
    name: 'STREFA GASTRO', 
    icon: Heart, 
    points: 5, 
    category: 'TRADYCJA',
    question: "Jaką tradycyjną przekąskę przygotowała Grupa św. Józefa i Klub Seniora?", 
    options: ["ZAPIEKANKI", "CHLEB ZE SMALCEM", "HOT-DOGI", "POPCORN"], 
    correct: 1,
    color: '#EAB308' // Żółty LLW
  },
  medyczna: { 
    id: 'medyczna',
    name: 'PIERWSZA POMOC', 
    icon: Zap, 
    points: 10, 
    category: 'WIEDZA',
    question: "Jaki jest uniwersalny numer alarmowy w całej Europie?", 
    options: ["997", "112", "998", "999"], 
    correct: 1,
    color: '#3B82F6' // Niebieski LLW
  }
};

// --- STYL NEO-BRUTALISTYCZNY (CUSTOM CLASSES) ---
const neoCard = "bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px]";
const neoBtn = "bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all rounded-[16px]";
const neoTag = "font-mono text-[10px] tracking-widest uppercase bg-white border-2 border-black px-3 py-1 rounded-full inline-block";

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [nick, setNick] = useState('');
  const [currentStationId, setCurrentStationId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'leaderboard' | 'quiz'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Import czcionek
    const link = document.createElement('link');
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800;900&family=Roboto+Mono:wght@700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error(err); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('station');
    if (STATIONS[sId]) {
      setCurrentStationId(sId);
      setView('quiz');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) setUserData(snapshot.data());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleRegister = async () => {
    if (!nick.trim() || !user) return;
    setSubmitting(true);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid), {
      uid: user.uid,
      nick: nick.toUpperCase(),
      totalPoints: 0,
      completedStations: [],
      timestamp: new Date().toISOString()
    });
    setSubmitting(false);
  };

  const handleAnswer = async (index) => {
    if (!user || !userData || !currentStationId) return;

    // Blokada czasowa (np. 15 Kwiecień 2026, 15:30)
    // Dostosuj rok, miesiąc (0-11) i dzień do faktycznej daty wydarzenia!
    const cutoffTime = new Date(2026, 3, 15, 15, 30, 0).getTime();
    if (Date.now() > cutoffTime) {
      alert("ELIMINACJE ZAKOŃCZONE! TRWA PODLICZANIE WYNIKÓW DO PÓŁFINAŁU.");
      setView('leaderboard');
      setCurrentStationId(null);
      return;
    }

    setSubmitting(true);
    const station = STATIONS[currentStationId];
    const isCorrect = index === station.correct;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid), {
      totalPoints: userData.totalPoints + (isCorrect ? station.points : 0),
      completedStations: arrayUnion(currentStationId)
    });
    setSubmitting(false);
    setTimeout(() => { setView('home'); setCurrentStationId(null); }, 1500);
  };

  if (loading) return <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><div className="w-12 h-12 border-4 border-black border-t-[#DC2626] rounded-full animate-spin"></div></div>;

  if (user && !userData) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        <div className={`${neoCard} w-full max-w-sm p-10 text-center`}>
          <div className="bg-[#DC2626] border-4 border-black w-24 h-24 rounded-[24px] flex items-center justify-center mx-auto mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <Flag className="text-white w-12 h-12" />
          </div>
          <h1 className="text-4xl font-[900] mb-2 leading-none uppercase tracking-tighter">PASZPORT SKAUTA</h1>
          <p className="font-mono text-[10px] tracking-widest text-slate-500 mb-10 uppercase">Biało-Czerwona 2.0</p>
          <input 
            type="text" 
            placeholder="TWÓJ NICK..." 
            className="w-full p-5 border-[3px] border-black rounded-[16px] mb-4 font-black uppercase outline-none focus:bg-red-50"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
          />
          <button 
            onClick={handleRegister}
            className={`${neoBtn} w-full py-5 bg-[#DC2626] text-white font-[900] uppercase`}
          >
            OTWÓRZ PASZPORT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-['Plus_Jakarta_Sans'] pb-24">
      {/* NAGŁÓWEK */}
      <header className="bg-white border-b-[3px] border-black p-6 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-[#DC2626] border-2 border-black w-12 h-12 rounded-[12px] flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <User className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-[900] leading-none uppercase">{userData?.nick}</h2>
            <div className="font-mono text-[10px] tracking-widest text-slate-400 uppercase mt-1">STATUS: AKTYWNY</div>
          </div>
        </div>
        <div className="bg-[#EAB308] border-[3px] border-black px-5 py-2 rounded-[16px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
          <Trophy className="w-5 h-5" />
          <span className="text-2xl font-[900]">{userData?.totalPoints}</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-6">
        {view === 'quiz' && currentStationId ? (
          <QuizView station={STATIONS[currentStationId]} userData={userData} handleAnswer={handleAnswer} submitting={submitting} />
        ) : view === 'leaderboard' ? (
          <LeaderboardView setView={setView} />
        ) : (
          <HomeView userData={userData} setView={setView} />
        )}
      </main>

      {/* MENU DOLNE */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t-[3px] border-black p-5 flex justify-around items-center z-50">
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
  );
}

// --- HOME (BENTO BOX LAYOUT) ---
function HomeView({ userData, setView }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* BANER GŁÓWNY */}
      <div className={`${neoCard} bg-[#DC2626] p-10 text-white relative overflow-hidden`}>
        <div className="relative z-10">
          <div className={neoTag + " bg-red-800 border-red-400 text-white mb-4"}>MISJA DZISIAJ</div>
          <h3 className="text-4xl font-[900] leading-none uppercase mb-2 tracking-tighter">TURNIEJ SKAUTOWY</h3>
          <p className="font-mono text-[11px] tracking-widest opacity-80 uppercase">Zdobądź wszystkie 4 pieczęcie!</p>
        </div>
        <Flag className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 rotate-12" />
      </div>

      {/* BENTO GRID STACJI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.values(STATIONS).map((st) => {
          const isDone = userData?.completedStations.includes(st.id);
          return (
            <div 
              key={st.id} 
              className={`${neoCard} p-8 flex flex-col justify-between min-h-[220px] transition-all ${isDone ? 'opacity-50 grayscale' : 'hover:translate-y-[-4px]'}`}
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div style={{backgroundColor: st.color}} className="p-4 border-[3px] border-black rounded-[16px] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <st.icon className="w-8 h-8" />
                  </div>
                  <div className="font-mono text-[10px] tracking-widest text-slate-400 text-right">
                    ASPEKT<br/>{st.category}
                  </div>
                </div>
                <h5 className="text-2xl font-[900] uppercase leading-tight">{st.name}</h5>
              </div>
              <div className="flex justify-between items-center mt-6">
                <span className="font-mono text-[12px] font-bold text-slate-500">{st.points} PKT</span>
                {isDone ? (
                  <CheckCircle className="text-green-600 w-8 h-8" />
                ) : (
                  <div className="bg-black text-white px-4 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase">OPEN</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`${neoCard} bg-white p-8 border-dashed flex gap-6 items-center`}>
         <Info className="w-12 h-12 text-[#DC2626] shrink-0" />
         <p className="font-mono text-[11px] leading-relaxed uppercase font-bold text-slate-600">
           KAŻDA STACJA TO KOLEJNY KROK W TURNIEJU. PÓŁFINAŁ O GODZINIE 15:30 NA SCENIE GŁÓWNEJ DLA TOP 10 WYNIKÓW.
         </p>
      </div>
    </div>
  );
}

// --- QUIZ VIEW ---
function QuizView({ station, userData, handleAnswer, submitting }) {
  const isDone = userData?.completedStations.includes(station.id);

  if (isDone) return (
    <div className="text-center py-20 animate-in zoom-in">
      <div className="bg-green-100 border-[3px] border-black w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <CheckCircle className="text-green-600 w-12 h-12" />
      </div>
      <h3 className="text-3xl font-[900] uppercase mb-4">PIECZĘĆ ZDOBYTA</h3>
      <p className="font-mono text-[12px] text-slate-500 uppercase">Szukaj kolejnych wyzwań na terenie pikniku.</p>
    </div>
  );

  return (
    <div className="animate-in slide-in-from-bottom-12 duration-500">
      <div style={{backgroundColor: station.color}} className={`${neoCard} p-10 text-white mb-8`}>
        <div className="font-mono text-[10px] tracking-widest uppercase mb-4 opacity-80">WYZWANIE: {station.category}</div>
        <h3 className="text-4xl font-[900] uppercase leading-none mb-4">{station.name}</h3>
        <div className="bg-white/20 p-4 rounded-[12px] font-mono text-[12px] font-bold">WARTOŚĆ: {station.points} PUNKTÓW</div>
      </div>

      <div className={`${neoCard} p-10`}>
        <h4 className="text-2xl font-[900] uppercase mb-10 leading-tight border-l-8 border-black pl-6">{station.question}</h4>
        <div className="grid grid-cols-1 gap-4">
          {station.options.map((opt, idx) => (
            <button 
              key={idx}
              disabled={submitting}
              onClick={() => handleAnswer(idx)}
              className={`${neoBtn} text-left p-6 font-[900] uppercase text-lg flex justify-between items-center group`}
            >
              <span>{opt}</span>
              <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- RANKING VIEW ---
function LeaderboardView({ setView }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => d.data());
      setLeaders(all.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 10));
      setLoading(false);
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
            className={`${neoCard} p-6 flex items-center justify-between ${idx === 0 ? 'bg-red-50 border-[#DC2626]' : ''}`}
          >
            <div className="flex items-center gap-6">
              <div className={`w-12 h-12 border-[3px] border-black rounded-[12px] flex items-center justify-center font-[900] text-xl ${
                idx === 0 ? 'bg-[#EAB308]' : idx === 1 ? 'bg-slate-300' : idx === 2 ? 'bg-orange-400' : 'bg-white'
              }`}>
                {idx + 1}
              </div>
              <span className="text-xl font-[900] uppercase tracking-tight">{p.nick}</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-[900] leading-none">{p.totalPoints}</div>
              <div className="font-mono text-[9px] text-slate-400 tracking-widest font-bold">PKT</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${neoCard} bg-black text-white p-8 text-center`}>
        <Timer className="w-10 h-10 mx-auto mb-4 text-[#EAB308]" />
        <h5 className="text-xl font-[900] uppercase mb-2">GOTOWY NA PÓŁFINAŁ?</h5>
        <p className="font-mono text-[11px] opacity-60 uppercase">O godz. 15:30 zamkniemy ranking eliminacyjny.</p>
      </div>
    </div>
  );
}