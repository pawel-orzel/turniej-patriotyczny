import React, { useState, useEffect, useCallback } from 'react';
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
  query,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  User, Trophy, Coffee, Shield, Heart, Zap, Megaphone, Lock, Info,
  CheckCircle, ChevronRight, 
  Flag, MapPin, LogOut
} from 'lucide-react';

const OWNER_UID = "Do8KU9DccNWoAMDxhARxZj8zref1"; // WAŻNE: Wklej tutaj swoje UID z panelu Firebase Authentication
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz3xSkviG5CrfOgbgLf13pmL60w4ItYhyduuJ-dp6l_6t0oFDwNADK6V0sRZTxommm49g/exec"; // WAŻNE: Wklej tutaj URL z Google Apps Script

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
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'weekend-patriotyczny-torun';

// --- STYL NEO-BRUTALISTYCZNY (CUSTOM CLASSES) ---
const neoCard = "border-[3px] border-black shadow-neo rounded-[32px]";
const neoBtn = "border-[3px] border-black shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all rounded-[16px]";
const neoTag = "font-mono text-[10px] tracking-widest uppercase border-2 border-black px-3 py-1 rounded-full inline-block";

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [nick, setNick] = useState('');
  const [stations, setStations] = useState(null);
  const [stationsError, setStationsError] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [currentStationId, setCurrentStationId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'leaderboard' | 'quiz' | 'admin'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');


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

  const fetchStations = useCallback(async () => {
    setStationsError(null);
    setStations(null); // Reset stations to show loading indicator
    const iconMap = { coffee: Coffee, shield: Shield, heart: Heart, zap: Zap };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        if (!response.ok) {
          throw new Error(`Błąd sieci: ${response.statusText}`);
        }
        const data = await response.json();
        
        const processedStations = {};
        Object.keys(data.stations).forEach(stationId => {
            const station = data.stations[stationId];
            processedStations[stationId] = {
                ...station,
                icon: iconMap[station.iconName] || Info
            };
        });
        setStations(processedStations);
    } catch (error) {
        console.error("Błąd podczas pobierania danych ze Skryptu Google:", error);
        setStationsError("Nie udało się załadować stacji. Sprawdź połączenie z internetem.");
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    if (!user) return; // Nasłuchuj dopiero po pomyślnym zalogowaniu (anonimowym lub admina)
    // Nasłuchiwanie na zmiany w konfiguracji aplikacji (ogłoszenia, czas, hasła)
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
    const unsubscribe = onSnapshot(
      configRef, 
      (snapshot) => {
        if (snapshot.exists()) {
          setAppConfig(snapshot.data());
        } else {
          console.log("Dokument konfiguracyjny nie istnieje!");
        }
      },
      (error) => console.error("Błąd pobierania konfiguracji:", error) // Wyłapywanie błędu braku uprawnień
    );
    return () => unsubscribe();
  }, [user]); // Zależność powoduje, że useEffect uruchomi się ponownie po załadowaniu obiektu user

  useEffect(() => {
    // Centralny licznik czasu do końca turnieju
    if (!appConfig?.endTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(appConfig.endTime).getTime();
      const distance = end - now;
      if (distance < 0) {
        setCountdown("00:00:00");
        clearInterval(interval);
        return;
      }
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const seconds = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');
      setCountdown(`${hours}:${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [appConfig]);

  useEffect(() => {
    if (!stations) return; // Czekaj aż stacje się załadują
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('station');
    const adminParam = params.get('admin');
    if (adminParam === 'true' && user?.uid === OWNER_UID) {
      setView('admin');
    } else if (stations[sId] && userData) {
      setCurrentStationId(sId);
      setView('quiz');
    }
  }, [user, userData, stations]); // Reaguj gdy załaduje się user i jego dane

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
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid), {
        uid: user.uid,
        nick: nick.toUpperCase(),
        totalPoints: 0,
        completedStations: [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Błąd podczas rejestracji:", error);
      alert("Wystąpił błąd przy logowaniu. Sprawdź połączenie.");
    }
    setSubmitting(false);
  };

  const handleStationComplete = async (pointsEarned) => {
    if (!user || !userData || !currentStationId) return;
    // Blokada czasowa przesunięta na 30 Czerwca 2026, godz. 15:30 dla celów testowych.
    // PAMIĘTAJ: Miesiące w JavaScript liczymy od 0 (0 = styczeń, 5 = czerwiec).
    const end = new Date(appConfig.endTime).getTime();
    if (Date.now() > end) {
      alert("ELIMINACJE ZAKOŃCZONE! TRWA PODLICZANIE WYNIKÓW DO PÓŁFINAŁU.");
      setView('leaderboard');
      setCurrentStationId(null);
      return;
    }

    setSubmitting(true);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid), {
      totalPoints: userData.totalPoints + pointsEarned,
      completedStations: arrayUnion(currentStationId)
    });
    setSubmitting(false);
    setView('home');
    setCurrentStationId(null);
  };

  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      alert("Wpisz email i hasło!");
      return;
    }
    try {
      const result = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const myUid = result.user.uid;
      
      if (myUid === OWNER_UID) {
        window.history.pushState({}, '', '?admin=true');
        setView('admin');
      } else {
        alert("ZALOGOWANO!\n\nTwoje UID to:\n" + myUid + "\n\nSkopiuj je (jest też w konsoli - wciśnij F12) i wklej jako OWNER_UID na samej górze kodu!");
        console.log("=== TWOJE UID ADMINA (SKOPIUJ) ===");
        console.log(myUid);
      }
    } catch (error) {
      console.error("Błąd logowania admina:", error);
      alert("Nie udało się zalogować.\nPowód błędu: " + error.message + "\n\nSprawdź konsolę (F12) po więcej szczegółów.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/'; // Przeładowanie strony uruchomi na nowo ekran startowy
    } catch (err) { console.error("Błąd wylogowania: ", err); }
  };

  if (loading) return <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center"><div className="w-12 h-12 border-4 border-black border-t-[#DC2626] rounded-full animate-spin"></div></div>;

  if (user && !userData && view !== 'admin') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        <div className={`${neoCard} bg-white w-full max-w-sm p-10 text-center`}>
        <div className="bg-[#DC2626] border-4 border-black w-24 h-24 rounded-[24px] flex items-center justify-center mx-auto mb-8 shadow-neo-sm">
            <Flag className="text-white w-12 h-12" />
          </div>
          <h1 className="text-4xl font-[900] mb-2 leading-none uppercase tracking-tighter">PASZPORT SKAUTA</h1>
          <p className="font-mono text-[10px] tracking-widest text-slate-500 mb-10 uppercase">Biało-Czerwona 2.0</p>
          
          {showAdminForm ? (
            <>
              <input 
                type="email" 
                placeholder="EMAIL SZTABU..." 
                className="w-full p-5 border-[3px] border-black rounded-[16px] mb-4 font-black outline-none focus:bg-slate-100"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="HASŁO..." 
                className="w-full p-5 border-[3px] border-black rounded-[16px] mb-4 font-black outline-none focus:bg-slate-100"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              <button 
                onClick={handleAdminLogin}
                className={`${neoBtn} w-full py-5 bg-black text-white font-[900] uppercase`}
              >
                ZALOGUJ DO SZTABU
              </button>
              <button onClick={() => setShowAdminForm(false)} className="mt-6 font-mono text-xs text-slate-400 uppercase tracking-widest">
                Wróć do logowania gracza
              </button>
            </>
          ) : (
            <>
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
              <button onClick={() => setShowAdminForm(true)} className="mt-6 font-mono text-xs text-slate-400 uppercase tracking-widest">
                Logowanie dla Sztabu
              </button>
            </>
          )}
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
        <div className="text-right flex flex-col items-end">
          <div className="text-2xl font-[900] leading-none">{userData?.totalPoints} PKT</div>
          <div className="font-mono text-[10px] tracking-widest text-slate-400 uppercase font-bold">{countdown}</div>
          <button onClick={handleLogout} className="mt-1 font-mono text-[9px] font-bold tracking-widest uppercase bg-slate-100 text-black px-2 py-1 rounded-md border-2 border-black active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center gap-1 shadow-neo-sm">
            <LogOut className="w-3 h-3" /> WYLOGUJ
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-6">
        {view === 'admin' && user?.uid === OWNER_UID ? (
          <AdminView appConfig={appConfig} user={user} stations={stations} />
        ) : view === 'quiz' && currentStationId ? (
          <QuizView station={stations[currentStationId]} userData={userData} handleStationComplete={handleStationComplete} submitting={submitting} />
        ) : view === 'leaderboard' ? (
          <LeaderboardView appConfig={appConfig} />
        ) : (
          <HomeView userData={userData} appConfig={appConfig} stations={stations} stationsError={stationsError} refetchStations={fetchStations} setView={setView} setCurrentStationId={setCurrentStationId} />
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

// --- ADMIN VIEW ---
function AdminView({ appConfig, user, stations }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [staffMessage, setStaffMessage] = useState('');

  const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');

  const handleUpdateConfig = async (field, value) => {
    try {
      await updateDoc(configRef, { [field]: value });
      alert(`Pole "${field}" zaktualizowane!`);
    } catch (err) {
      alert("Błąd aktualizacji!");
      console.error(err);
    }
  };

  const clearDatabase = async () => {
    if (!window.confirm("CZY NA PEWNO CHCESZ USUNĄĆ WSZYSTKICH UCZESTNIKÓW I WYZEROWAĆ RANKING? TEJ OPERACJI NIE MOŻNA COFNĄĆ!")) return;
    setIsDeleting(true);
    try {
      const participantsRef = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
      const snapshot = await getDocs(participantsRef);
      const deletePromises = snapshot.docs.map(document => 
        deleteDoc(doc(participantsRef, document.id))
      );
      await Promise.all(deletePromises);
      alert("BAZA DANYCH ZOSTAŁA WYCZYSZCZONA! TURNIEJ ZRESETOWANY.");
    } catch (err) { console.error(err); alert("WYSTĄPIŁ BŁĄD PODCZAS CZYSZCZENIA BAZY."); }
    setIsDeleting(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/'; // Przeładowanie strony uruchomi na nowo logowanie gracza
    } catch (err) { console.error("Błąd wylogowania: ", err); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 mt-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-5xl font-[900] uppercase tracking-tighter leading-none mb-2 text-[#DC2626]">SZTAB DOWODZENIA</h1>
          <div className="font-mono text-[10px] tracking-widest text-slate-400 uppercase">PANEL ZARZĄDZANIA TURNIEJEM</div>
        </div>
        <button onClick={handleLogout} className="font-mono text-[10px] font-bold tracking-widest uppercase bg-black text-white px-4 py-3 rounded-xl shadow-neo-sm active:translate-y-1 active:translate-x-1 transition-transform">
          Wyloguj
        </button>
      </div>

      {/* UID ADMINA */}
      <div className={`${neoCard} bg-white p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">TWÓJ IDENTYFIKATOR ADMINA</h3>
        <p className="font-mono text-xs text-slate-500 mb-2">Skopiuj ten identyfikator i wklej go do stałej `OWNER_UID` w pliku App.jsx, aby zabezpieczyć ten panel.</p>
        <input type="text" readOnly value={user?.uid || 'Brak UID'} className="w-full p-3 bg-slate-100 border-2 border-black rounded-lg font-mono text-sm" />
      </div>

      {/* LINKI DO STACJI (GENERATOR) */}
      <div className={`${neoCard} bg-white p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">LINKI DO KODÓW QR STACJI</h3>
        <p className="font-mono text-xs text-slate-500 mb-4">Skopiuj poniższe linki i wklej je do darmowego generatora kodów QR (np. qr-code-generator.com).</p>
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border-2 border-black rounded-lg shadow-neo-sm">
            <div className="font-[900] uppercase mb-1">REJESTRACJA (PLAKAT GŁÓWNY)</div>
            <code className="text-xs break-all text-blue-600 font-bold">{window.location.origin}/</code>
          </div>
          {stations && Object.values(stations).map(st => (
            <div key={st.id} className="p-3 bg-slate-50 border-2 border-black rounded-lg shadow-neo-sm">
              <div className="font-[900] uppercase mb-1 text-[#DC2626]">{st.name}</div>
              <div className="font-mono text-[10px] text-slate-500 mb-1">ID STACJI: {st.id}</div>
              <code className="text-xs break-all text-blue-600 font-bold">{window.location.origin}/?station={st.id}</code>
            </div>
          ))}
        </div>
      </div>

      {/* ZARZĄDZANIE CZASEM */}
      <div className={`${neoCard} bg-white p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">USTAW CZAS ZAKOŃCZENIA</h3>
        <input type="datetime-local" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full p-3 border-[3px] border-black rounded-lg mb-4"/>
        <button onClick={() => handleUpdateConfig('endTime', newTime)} className={`${neoBtn} bg-black text-white w-full py-3`}>ZAPISZ CZAS</button>
      </div>

      {/* OGŁOSZENIA */}
      <div className={`${neoCard} bg-white p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">OGŁOSZENIA ZE SZTABU</h3>
        <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} className="w-full p-3 border-[3px] border-black rounded-lg mb-4" placeholder="Treść ogłoszenia..."></textarea>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => handleUpdateConfig('messages', arrayUnion(newMessage))} className={`${neoBtn} bg-blue-500 text-white py-3`}>DODAJ</button>
          <button onClick={() => handleUpdateConfig('messages', [])} className={`${neoBtn} bg-slate-200 text-black py-3`}>WYCZYŚĆ</button>
        </div>
      </div>
      
      {/* INSTRUKCJE DLA KADRY */}
      <div className={`${neoCard} bg-yellow-50 p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">INSTRUKCJE DLA STRAŻNIKÓW</h3>
        <textarea value={staffMessage} onChange={e => setStaffMessage(e.target.value)} className="w-full p-3 border-[3px] border-black rounded-lg mb-4" placeholder="Tajna wiadomość dla obsługi..."></textarea>
        <button onClick={() => handleUpdateConfig('staffToGatekeepers', staffMessage)} className={`${neoBtn} bg-yellow-400 text-black w-full py-3`}>WYŚLIJ INSTRUKCJĘ</button>
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

// --- HOME (BENTO BOX LAYOUT) ---
function HomeView({ userData, appConfig, stations, stationsError, refetchStations, setView, setCurrentStationId }) {
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

      {/* OGŁOSZENIA */}
      {Array.isArray(appConfig?.messages) && appConfig.messages.length > 0 && (
        <div className={`${neoCard} bg-[#EAB308] p-8`}>
          <div className="flex items-center gap-4 mb-4">
            <Megaphone className="w-8 h-8" />
            <h4 className="text-xl font-[900] uppercase">OGŁOSZENIA ZE SZTABU</h4>
          </div>
          <ul className="list-disc pl-5 space-y-2 font-mono uppercase text-sm">
            {appConfig.messages.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

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
        {Object.values(stations).map((st) => {
          const maxPoints = st.questions?.reduce((acc, q) => acc + (q.points || 0), 0) || 0;
          const isDone = userData?.completedStations?.includes(st.id);
          return (
            <div 
              key={st.id} 
              onClick={() => {
                if (!isDone) {
                  setCurrentStationId(st.id);
                  setView('quiz');
                }
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
                <h5 className="text-2xl font-[900] uppercase leading-tight">{st.name}</h5>
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
function QuizView({ station, userData, handleStationComplete, submitting }) {
  const isDone = userData?.completedStations?.includes(station.id);
  const [localScore, setLocalScore] = useState(0);
  const [questionCode, setQuestionCode] = useState('');
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(null);
  const [unlockedQuestions, setUnlockedQuestions] = useState(new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const [selectedOptions, setSelectedOptions] = useState({});

  useEffect(() => {
    setLocalScore(0);
    setQuestionCode('');
    setActiveQuestionIdx(null);
    setUnlockedQuestions(new Set());
    setAnsweredQuestions(new Set());
    setSelectedOptions({});
  }, [station.id]);

  if (isDone) return (
    <div className="text-center py-20 animate-in zoom-in">
      <div className="bg-green-100 border-[3px] border-black w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-neo">
        <CheckCircle className="text-green-600 w-12 h-12" />
      </div>
      <h3 className="text-3xl font-[900] uppercase mb-4">PIECZĘĆ ZDOBYTA</h3>
      <p className="font-mono text-[12px] text-slate-500 uppercase">Szukaj kolejnych wyzwań na terenie pikniku.</p>
    </div>
  );

  const maxPoints = station.questions?.reduce((acc, q) => acc + (q.points || 0), 0) || 0;
  const isAllAnswered = station.questions?.length > 0 && answeredQuestions.size === station.questions.length;

  const handleUnlockQuestion = (idx) => {
    const question = station.questions?.[idx];
    if (!question || !question.code) {
      alert('Błąd: Brak kodu dla tego pytania.');
      return;
    }
    if (questionCode.toUpperCase() === question.code.toUpperCase()) {
      setUnlockedQuestions((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setQuestionCode('');
    } else {
      alert('ZŁY KOD! ZAPYTAJ INSTRUKTORA O POPRAWNY.');
    }
  };

  const handleOptionClick = (questionIdx, optionIdx) => {
    if (submitting || answeredQuestions.has(questionIdx) || !unlockedQuestions.has(questionIdx)) return;
    const question = station.questions?.[questionIdx];
    if (!question) return;

    const isCorrect = optionIdx === question.correct;
    if (isCorrect) {
      setLocalScore((prev) => prev + (question.points || 0));
    }

    setAnsweredQuestions((prev) => {
      const next = new Set(prev);
      next.add(questionIdx);
      return next;
    });
    setSelectedOptions((prev) => ({ ...prev, [questionIdx]: optionIdx }));
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-12 duration-500">
      <div style={{backgroundColor: station.color}} className={`${neoCard} p-10 text-white`}>
        <div className="flex justify-between items-center mb-4 opacity-80">
          <div className="font-mono text-[10px] tracking-widest uppercase">WYZWANIE: {station.category}</div>
          <div className="font-mono text-[10px] tracking-widest uppercase font-bold bg-black/20 px-3 py-1 rounded-full">
            {answeredQuestions.size} / {station.questions?.length || 0} ODPOWIEDZI
          </div>
        </div>
        <h3 className="text-4xl font-[900] uppercase leading-none mb-4">{station.name}</h3>
        <div className="bg-white/20 p-4 rounded-[12px] font-mono text-[12px] font-bold flex justify-between">
          <span>MAX STACJI: {maxPoints} PKT</span>
          <span>ZDOBYTO: {localScore} PKT</span>
        </div>
      </div>

      <div className="space-y-6">
        {station.questions?.map((question, idx) => {
          const isUnlocked = unlockedQuestions.has(idx);
          const isAnswered = answeredQuestions.has(idx);
          const selectedOption = selectedOptions[idx];
          const isActive = activeQuestionIdx === idx;
          const isCorrect = selectedOption === question.correct;

          return (
            <div key={idx} className={`${neoCard} bg-white p-6`}>
              <button type="button" onClick={() => setActiveQuestionIdx(idx)} className="w-full text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400 mb-2">Pytanie {idx + 1}</div>
                    <h4 className="text-xl font-[900] uppercase leading-tight">{question.question}</h4>
                  </div>
                  <div className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-full ${isAnswered ? 'bg-green-100 text-green-700' : isUnlocked ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                    {isAnswered ? 'ODPOWIEDZIANE' : isUnlocked ? 'ODKLOKOWANE' : 'KOD PRZY ODPOWIEDZI'}
                  </div>
                </div>
              </button>

              {isActive && (
                <div className="mt-6 space-y-4">
                  {!isUnlocked ? (
                    <>
                      <p className="font-mono text-[11px] text-slate-500 uppercase text-center">Wpisz kod od instruktora, aby rozpocząć odpowiadanie.</p>
                      <input
                        type="text"
                        placeholder="KOD DO PYTANIA..."
                        className="w-full p-5 border-[3px] border-black rounded-[16px] mb-4 font-black uppercase outline-none focus:bg-yellow-50 text-center"
                        value={questionCode}
                        onChange={(e) => setQuestionCode(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleUnlockQuestion(idx);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleUnlockQuestion(idx)}
                        className={`${neoBtn} w-full py-5 bg-[#EAB308] text-black font-[900] uppercase`}
                      >
                        ODBLOKUJ PYTANIE
                      </button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        {question.options.map((opt, optIdx) => {
                          let btnStyle = 'bg-white text-black';
                          if (isAnswered) {
                            if (optIdx === question.correct) btnStyle = 'bg-green-500 text-white border-green-700';
                            else if (optIdx === selectedOption) btnStyle = 'bg-red-500 text-white border-red-700';
                          }
                          return (
                            <button
                              key={optIdx}
                              disabled={submitting || isAnswered}
                              onClick={() => handleOptionClick(idx, optIdx)}
                              className={`${neoBtn} ${btnStyle} text-left p-5 font-[900] uppercase text-lg flex justify-between items-center`}
                            >
                              <span>{opt}</span>
                              <ChevronRight className="w-6 h-6 transition-transform" />
                            </button>
                          );
                        })}
                      </div>
                      {isAnswered && (
                        <div className={`rounded-[16px] p-4 font-mono text-sm ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          {isCorrect ? 'Poprawna odpowiedź! Punkty zostały zapisane.' : 'Błędna odpowiedź. Możesz przejść do następnego pytania.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`${neoCard} bg-white p-8`}> 
        <button
          disabled={!isAllAnswered || submitting}
          onClick={() => handleStationComplete(localScore)}
          className={`${neoBtn} w-full py-5 ${isAllAnswered ? 'bg-black text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
        >
          {isAllAnswered ? 'ZAKOŃCZ STACJĘ' : 'ODPOWIEDZ NA WSZYSTKIE PYTANIA'}
        </button>
        <p className="font-mono text-[11px] text-slate-500 uppercase">Wszystkie pytania widoczne od razu. Aby odpowiedzieć, wybierz pytanie i wpisz jego kod.</p>
      </div>
    </div>
  );
}

// --- RANKING VIEW ---
function LeaderboardView({ appConfig }) {
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
            className={`${neoCard} p-6 flex items-center justify-between ${idx === 0 ? 'bg-red-50 border-[#DC2626]' : 'bg-white'}`}
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
        <Trophy className="w-10 h-10 mx-auto mb-4 text-[#EAB308]" />
        <h5 className="text-xl font-[900] uppercase mb-2">GOTOWY NA PÓŁFINAŁ?</h5>
        <p className="font-mono text-[11px] opacity-60 uppercase">O godz. {appConfig?.endTime ? new Date(appConfig.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '??:??'} zamkniemy ranking.</p>
      </div>
    </div>
  );
}