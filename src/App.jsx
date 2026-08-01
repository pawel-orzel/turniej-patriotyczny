import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  setPersistence, // This is the function to set persistence
  browserLocalPersistence, // This is the type of persistence
  inMemoryPersistence // Import in-memory persistence as a fallback
} from 'firebase/auth';
import { 
  User, Trophy, Coffee, Shield, Heart, Zap, Megaphone, Lock, Info,
  CheckCircle, ChevronRight, 
  Flag, MapPin, LogOut
} from 'lucide-react';

import FinalStage from './final';
import { showAlert, showConfirm } from './modal';
import RegRodo from './reg.RODO';

const OWNER_UID = "Do8KU9DccNWoAMDxhARxZj8zref1"; // WAŻNE: Wklej tutaj swoje UID z panelu Firebase Authentication
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVoBjRhKnw9bMdRdGQe6wFrtKicSCd-S-ulA4IuxXv_-X1ikTH4zoAeSGs-GjDoYVkZQ/exec"; // WAŻNE: Wklej tutaj URL z Google Apps Script

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
const appId = 'turniej-2-0-torun';

// --- STYL NEO-BRUTALISTYCZNY (CUSTOM CLASSES) ---
const neoCard = "border-[3px] border-black shadow-neo rounded-[32px]";
const neoBtn = "border-[3px] border-black shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all rounded-[16px]";
const neoTag = "font-mono text-[10px] tracking-widest uppercase border-2 border-black px-3 py-1 rounded-full inline-block";
const STATIONS_CACHE_KEY = 'stations_cache';
const CACHE_EXPIRATION_MS = 2 * 60 * 1000; // 2 minuty

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [nick, setNick] = useState('');
  const [stations, setStations] = useState(null);
  const [stationsError, setStationsError] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'leaderboard' | 'quiz' | 'admin'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState(null);
  const [adminAuthLastResponse, setAdminAuthLastResponse] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [stationsClickable, setStationsClickable] = useState(false);
  const [isReżyserkaOpen, setIsReżyserkaOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const isDevAdmin = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  // Debug: safe log after state initialization
  console.log('App render', { view: undefined, loading: undefined, user: !!user, userDataLoaded: !!userData, isReżyserkaOpen, isDevAdmin });

  // --- LICZNIK CZASU ---
  useEffect(() => {
    if (!userData?.timestamp) {
      setElapsedTime('00:00');
      return;
    }
    const startTime = new Date(userData.timestamp).getTime();
    
    // Sprawdzamy czy gracz ukończył wszystkie standardowe stacje (eliminacyjne)
    let endTime = null;
    if (stations && userData?.completedStations) {
      const standardStationsCount = Object.values(stations).filter(
        st => st?.id && st.id.toLowerCase() !== 'półfinał' && st.id.toLowerCase() !== 'finał'
      ).length;
      
      if (standardStationsCount > 0 && userData.completedStations.length >= standardStationsCount) {
        if (userData.scoreUpdatedAt) {
           endTime = typeof userData.scoreUpdatedAt.toMillis === 'function' 
             ? userData.scoreUpdatedAt.toMillis() 
             : new Date(userData.scoreUpdatedAt).getTime();
        }
      }
    }

    const updateTimer = () => {
      const now = endTime || Date.now();
      const diff = Math.max(0, now - startTime);
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setElapsedTime(h === '00' ? `${m}:${s}` : `${h}:${m}:${s}`);
    };

    updateTimer(); // Wywołanie od razu, by uniknąć opóźnienia 1s
    if (endTime) return; // Zatrzymujemy stoper, jeśli gracz skończył grę
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [userData?.timestamp, userData?.scoreUpdatedAt, userData?.completedStations, stations]);

  useEffect(() => {
    // Import czcionek
    const link = document.createElement('link');
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800;900&family=Roboto+Mono:wght@700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const initAuth = async () => {
      try {
        // Try to set local persistence which is best for keeping users signed in.
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        // This can fail in some environments (e.g., private browsing in Edge/Firefox).
        // Fallback to in-memory persistence.
        console.warn('Błąd przy ustawianiu utrwalania sesji (local), przechodzę na tryb w pamięci (in-memory).', err);
        try {
          await setPersistence(auth, inMemoryPersistence);
        } catch (fallbackErr) {
          console.error('Nie udało się ustawić żadnego trybu utrwalania sesji.', fallbackErr);
        }
      }

      const customToken = typeof window !== 'undefined' ? window.__initial_auth_token : undefined;
      // After attempting to set persistence, manage the sign-in state.
      try {
        if (customToken) {
          await signInWithCustomToken(auth, customToken);
        } else if (!auth.currentUser) { // Only sign in if persistence didn't restore a user.
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Błąd logowania:", err); }
      
      if (!auth.currentUser) {
        setLoading(false); // W razie kompletnej porażki zwolnij ekran ładowania
      }
    };
    initAuth();

    // Intercept fetch calls to capture identitytoolkit responses for debugging
    try {
      if (!window.__originalFetch__) window.__originalFetch__ = window.fetch;
      window.fetch = async (input, init) => {
        try {
          const res = await window.__originalFetch__(input, init);
          try {
            const url = typeof input === 'string' ? input : input?.url;
            if (url && url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')) {
              const clone = res.clone();
              const text = await clone.text();
              let parsed;
              try { parsed = JSON.parse(text); } catch { parsed = text; }
              setAdminAuthLastResponse({ status: res.status, body: parsed });
            }
          } catch (inner) { console.warn('Error capturing auth response', inner); }
          return res;
        } catch (err) {
          const url = typeof input === 'string' ? input : input?.url;
          if (url && url.includes('identitytoolkit.googleapis.com/v1/accounts:signInWithPassword')) {
            setAdminAuthLastResponse({ networkError: String(err) });
          }
          throw err;
        }
      };
    } catch (e) { console.warn('Could not override fetch for debugging', e); }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      try { if (window.__originalFetch__) window.fetch = window.__originalFetch__; } catch (restoreErr) { console.warn('restore original fetch failed', restoreErr); }
    };
  }, []);

  useEffect(() => {
    // Synchronizuj stan przełącznika z konfiguracją z Firebase
    setStationsClickable(!!appConfig?.stationsClickable);
  }, [appConfig?.stationsClickable]);

  const fetchStations = useCallback(async () => {
    setStationsError(null);
    setStations(null); // Reset stations to show loading indicator

    const iconMap = { coffee: Coffee, shield: Shield, heart: Heart, zap: Zap };

    // 1. Sprawdź cache
    try {
      const cachedItem = localStorage.getItem(STATIONS_CACHE_KEY);
      if (cachedItem) {
        const { timestamp, data } = JSON.parse(cachedItem);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
          console.log("Ładowanie stacji z cache...");
          // Odzyskiwanie referencji do ikon Reacta (JSON ucina komponenty/funkcje)
          Object.keys(data).forEach(key => {
            data[key].icon = iconMap[(data[key].iconName || '').toLowerCase()] || Info;
          });
          setStations(data);
          return;
        }
      }
    } catch (cacheError) {
      console.warn("Nie udało się załadować stacji z cache (może być uszkodzony). Pobieram z sieci.", cacheError);
      try {
        localStorage.removeItem(STATIONS_CACHE_KEY);
      } catch (removeError) {
        void removeError;
      } // Bezpieczne zignorowanie błędu, jeśli przeglądarka blokuje localStorage
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        if (!response.ok) {
          throw new Error(`Błąd sieci: ${response.statusText}`);
        }
        const data = await response.json();

        const rawStations = data.stations || data.stationList || data.stacje || data.stationData || {};
        const stationEntries = Array.isArray(rawStations)
          ? rawStations.reduce((acc, station) => {
              if (station?.id) acc[station.id] = station;
              return acc;
            }, {})
          : rawStations;

        const questionsSource = data.questions || data.pytania || [];
        const questionsByStation = {};
        if (Array.isArray(questionsSource)) {
          questionsSource.forEach((question) => {
            const stationId = question.stationId || question.station || question.stationID || question.station_id;
            if (!stationId) return;
            const key = String(stationId).trim();
            if (!questionsByStation[key]) questionsByStation[key] = [];
            questionsByStation[key].push(question);
          });
        }

        const processedStations = {};
        Object.keys(stationEntries).forEach(stationId => {
            const station = stationEntries[stationId] || {};
            const rawQuestions = Array.isArray(station.questions)
              ? station.questions
              : questionsByStation[stationId] || [];

            const questions = (Array.isArray(rawQuestions) ? rawQuestions : []).map((q) => {
              const rawCorrect = Number(q.correct);
              const normalizedCorrect = Number.isFinite(rawCorrect)
                ? (rawCorrect >= 1 ? rawCorrect - 1 : rawCorrect)
                : 0;
              const options = (q.options && q.options.length)
                ? q.options
                : [q.option1, q.option2, q.option3, q.option4].filter(Boolean).map(String);
              return {
                ...q,
                options,
                correct: normalizedCorrect
              };
            });

            processedStations[stationId] = {
                id: stationId,
                ...station,
                questions,
                icon: iconMap[(station.iconName || '').toLowerCase()] || Info
            };
        });

        Object.keys(questionsByStation).forEach((stationId) => {
          if (!processedStations[stationId]) {
            const rawQuestions = questionsByStation[stationId];
            const questions = rawQuestions.map((q) => {
              const rawCorrect = Number(q.correct);
              const normalizedCorrect = Number.isFinite(rawCorrect)
                ? (rawCorrect >= 1 ? rawCorrect - 1 : rawCorrect)
                : 0;
              const options = (q.options && q.options.length)
                ? q.options
                : [q.option1, q.option2, q.option3, q.option4].filter(Boolean).map(String);
              return {
                ...q,
                options,
                correct: normalizedCorrect
              };
            });
            processedStations[stationId] = {
              id: stationId,
              name: stationId,
              category: '',
              color: '#000000',
              iconName: 'info',
              questions,
              icon: Info
            };
          }
        });

        setStations(processedStations);
        // Zapisz do cache
        try {
          localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: processedStations }));
        } catch {
          console.warn("Zapis cache zablokowany przez przeglądarkę.");
        }
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
    if (!stations) return; // Czekaj aż stacje się załadują
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('station');
    const adminParam = params.get('admin');
    if (adminParam === 'true' && (user?.uid === OWNER_UID || isDevAdmin)) {
      setView('admin');
    } else if (stations[sId] && userData) {
      setCurrentStationId(sId);
      setView('quiz');
    }
  }, [user, userData, stations, isDevAdmin]); // Reaguj gdy załaduje się user i jego dane

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      } else {
        setUserData(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Błąd pobierania danych gracza:", error);
      setLoading(false); // Zapobiega nieskończonemu ładowaniu przy błędzie Firebase
    });
    return () => unsubscribe();
  }, [user]);

  const handleRegister = async () => {
    if (!nick.trim() || !user) return;
    setSubmitting(true);
    try {
      const payload = {
        uid: user.uid,
        nick: nick.toUpperCase(),
      };
      // Pola startowe ustawiamy tylko, jeśli użytkownik ich jeszcze nie ma
      if (!userData) {
        payload.totalPoints = 0;
        payload.completedStations = [];
        payload.answeredQuestions = {};
        payload.timestamp = new Date().toISOString();
        payload.scoreUpdatedAt = serverTimestamp();
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid), payload, { merge: true });
      setView('home');
    } catch (error) {
      console.error("Błąd podczas rejestracji:", error);
      await showAlert("BŁĄD REJESTRACJI", "Wystąpił błąd przy logowaniu. Sprawdź połączenie.");
    }
    setSubmitting(false);
  };

  const handleQuestionAnswered = async ({ stationId, questionIdx, pointsEarned, questionCount }) => {
    if (!user || !userData) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
    const currentAnswered = userData.answeredQuestions?.[stationId] || [];
    if (currentAnswered.includes(questionIdx)) return;

    const updates = {
      [`answeredQuestions.${stationId}`]: arrayUnion(questionIdx)
    };
    if (pointsEarned > 0) {
      updates.totalPoints = increment(pointsEarned);
      updates.scoreUpdatedAt = serverTimestamp();
    }
    if (currentAnswered.length + 1 >= questionCount) {
      updates.completedStations = arrayUnion(stationId);
    }

    setSubmitting(true);
    try {
      await updateDoc(userRef, updates);
    } catch (err) {
      console.error('Błąd zapisu odpowiedzi:', err);
    }
    setSubmitting(false);
  };

  const handleUpdateConfig = async (field, value) => {
    if (!user || user.uid !== OWNER_UID) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
    try {
      await setDoc(configRef, { [field]: value }, { merge: true });
      // Nie pokazujemy alertu, bo to teraz przełącznik UI
    } catch (err) {
      await showAlert("BŁĄD", "Błąd aktualizacji konfiguracji!");
      console.error(err);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      await showAlert("BRAK DANYCH", "Wpisz email i hasło!");
      return;
    }
    setLoading(true);
    setAdminLoginError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const myUid = result.user.uid;
      
      if (myUid === OWNER_UID) {
        window.history.replaceState({}, '', '?admin=true');
        setView('admin');
        setShowAdminForm(false);
        setAdminEmail('');
        setAdminPassword('');
      } else {
        await showAlert("ZALOGOWANO!", "Twoje UID to:\n" + myUid + "\n\nSkopiuj je (jest też w konsoli - wciśnij F12) i wklej jako OWNER_UID na samej górze kodu!");
        console.log("=== TWOJE UID ADMINA (SKOPIUJ) ===");
        console.log(myUid);
      }
    } catch (error) {
      console.error("Błąd logowania admina:", error, { code: error.code });
      const message = `Powód błędu: ${error.code || 'unknown'} - ${error.message}`;
      setAdminLoginError(message);
      await showAlert("BŁĄD LOGOWANIA", `Nie udało się zalogować.\n${message}\n\nSprawdź konsolę (F12) po więcej szczegółów.`);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      console.log('handleLogout start', { uid: user?.uid, isOwner: user?.uid === OWNER_UID, isDevAdmin });
      if (user?.uid === OWNER_UID) {
        // Prawdziwe wylogowanie tylko dla administratora
        setLoading(true);
        await signOut(auth);
        console.log('signOut successful');
        setUserData(null);
        setView('home');
        setShowAdminForm(false);
        setAdminEmail('');
        setAdminPassword('');
        window.history.replaceState({}, '', window.location.pathname);
        try {
          await signInAnonymously(auth);
          console.log('signed in anonymously after signOut', { anonUid: auth.currentUser?.uid });
        } catch (anonErr) {
          console.error('signInAnonymously failed after signOut:', anonErr);
        }
      } else {
        // Udawane wylogowanie dla gracza (wraca do ekranu Paszportu i czysci URL z ewentualnych stacji)
        console.log('performing fake logout for player');
        setUserData(null);
        setNick('');
        setView('passport');
        setShowAdminForm(false);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) { 
      console.error("Błąd wylogowania: ", err); 
    } finally {
      setLoading(false);
      console.log('handleLogout end - loading set false');
    }
  };

  useEffect(() => {
    // Jeśli użytkownik ma już nick, załaduj go do pola input na ekranie logowania
    if (userData?.nick && !nick) {
      setNick(userData.nick);
    }
  }, [userData?.nick, nick]);

  if (loading) return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center"><div className="w-12 h-12 border-4 border-black border-t-[#DC2626] rounded-full animate-spin"></div></div>
    </ErrorBoundary>
  );

  const isPassportScreen = !user || view === 'passport' || (user && !userData && view !== 'admin' && !showAdminForm);

  if (isPassportScreen) {
    return (
      <ErrorBoundary>
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        <div className={`${neoCard} bg-white w-full max-w-sm p-10 text-center`}>
          <div className="bg-[#DC2626] border-4 border-black w-max mx-auto rounded-full p-4 mb-8 shadow-neo-sm">
            <img src="/favicon.png" alt="Logo aplikacji" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-4xl font-[900] mb-2 leading-none uppercase tracking-tighter">PASZPORT UCZESTNIKA</h1>
          <p className="font-mono text-[10px] tracking-widest text-slate-500 mb-10 uppercase">Turniej 2.0</p>
          
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
              {adminLoginError && (
                <div className="mb-4 p-3 bg-red-50 border-2 border-red-600 text-red-700 rounded-md text-sm">
                  <strong>Błąd logowania:</strong>
                  <div className="mt-1">{adminLoginError}</div>
                </div>
              )}
              {adminAuthLastResponse && (
                <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-600 text-yellow-700 rounded-md text-sm text-left">
                  <strong>Diagnoza żądania auth:</strong>
                  <pre className="mt-1 overflow-auto text-xs max-h-48">{JSON.stringify(adminAuthLastResponse, null, 2)}</pre>
                </div>
              )}
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
                {userData?.nick ? 'ZAPISZ NICK I WRÓĆ' : 'OTWÓRZ PASZPORT'}
              </button>
              <button onClick={() => setShowRules(true)} className="mt-4 w-full py-3 bg-slate-100 border-[3px] border-black rounded-[16px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all font-[900] font-mono text-[11px] uppercase text-slate-700">
                REGULAMIN I RODO
              </button>
              <button onClick={() => setShowAdminForm(true)} className="mt-6 font-mono text-xs text-slate-400 uppercase tracking-widest">
                Logowanie dla Sztabu
              </button>
            </>
          )}
        </div>
      </div>
      </ErrorBoundary>
    );
  }

    return (
    <ErrorBoundary>
    <div className="min-h-[100dvh] bg-[#F9FAFB] font-['Plus_Jakarta_Sans'] pb-28 md:pb-32 overflow-x-hidden">
      {/* MODUŁ FINAŁOWY - ODPALA SIĘ JAKO OVERLAY */}
      {/* Ten komponent został przypadkowo usunięty w poprzedniej wersji, co powodowało błąd. */}
      <FinalStage db={db} user={user} userData={userData} appId={appId} stations={stations} isAdmin={(user?.uid === OWNER_UID) || isDevAdmin} isOpen={isReżyserkaOpen} setIsOpen={setIsReżyserkaOpen} />

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

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
            <div className="text-lg md:text-2xl font-[900] leading-none">{userData?.totalPoints} PKT</div>
          </div>
          <div className="font-mono text-[8px] md:text-[10px] tracking-widest text-slate-400 uppercase font-bold mt-0.5">KONIEC: {appConfig?.endTime || '--:--'}</div>
          <button onClick={handleLogout} className="mt-1 font-mono text-[8px] md:text-[9px] font-bold tracking-widest uppercase bg-slate-100 text-black px-2 py-1 rounded-md border-2 border-black active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all flex items-center gap-1 shadow-neo-sm">
            <LogOut className="w-3 h-3" /> WYLOGUJ
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {view === 'admin' && (user?.uid === OWNER_UID || isDevAdmin) ? (
          <AdminView appConfig={appConfig} user={user} stations={stations} onLogout={handleLogout} handleUpdateConfig={handleUpdateConfig} />
        ) : view === 'quiz' && currentStationId && stations && stations[currentStationId] ? (
          <QuizView key={currentStationId} station={stations[currentStationId]} userData={userData} handleQuestionAnswered={handleQuestionAnswered} submitting={submitting} />
        ) : view === 'leaderboard' ? (
          <LeaderboardView appConfig={appConfig} />
        ) : (
          <HomeView userData={userData} appConfig={appConfig} stations={stations} stationsError={stationsError} refetchStations={fetchStations} setView={setView} setCurrentStationId={setCurrentStationId} setShowRules={setShowRules} />
        )}
      </main>

      {/* Pływający przycisk REŻYSERKA dla admina */}
      {(user?.uid === OWNER_UID || isDevAdmin) && (
        <button
          onClick={() => {
            console.log('Toggling reżyserka. current:', isReżyserkaOpen);
            setIsReżyserkaOpen(prev => !prev);
          }}
          className={`fixed bottom-24 right-6 z-[100] ${neoBtn} bg-[#DC2626] text-white p-4 flex items-center gap-2`}
        >
          <Activity className="w-6 h-6 animate-pulse" />
          REŻYSERKA
        </button>
      )}

      {/* Pływający przełącznik QR/KLIK dla admina */}
      {(user?.uid === OWNER_UID || isDevAdmin) && (
        <div
          className={`fixed bottom-24 left-6 z-[100] ${neoBtn} bg-white text-black p-2 flex items-center gap-2 text-xs`}
        >
          <span className={`font-bold uppercase ${!stationsClickable ? 'text-black' : 'text-slate-400'}`}>QR</span>
          <button
            onClick={() => handleUpdateConfig('stationsClickable', !stationsClickable)}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors ${stationsClickable ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${stationsClickable ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`font-bold uppercase ${stationsClickable ? 'text-black' : 'text-slate-400'}`}>KLIK</span>
        </div>
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
    </ErrorBoundary>
    );
}

// Simple Error Boundary to catch render errors and display them instead of a white screen
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-white p-8 text-black flex items-center justify-center">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold mb-4">Wystąpił błąd aplikacji</h2>
            <pre className="bg-slate-100 p-4 rounded">{String(this.state.error && this.state.error.toString())}</pre>
            <p className="mt-4">Sprawdź konsolę deweloperską (F12) po więcej informacji.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- ADMIN VIEW ---
function AdminView({ appConfig, stations, onLogout, handleUpdateConfig }) {
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

  const [newTime, setNewTime] = useState();
  const [copiedUrl, setCopiedUrl] = useState('');
  const displayedNewTime = newTime !== undefined ? newTime : (appConfig?.endTime || '');

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
          <button onClick={onLogout} className="font-mono text-[10px] font-bold tracking-widest uppercase bg-slate-200 text-black px-3 py-2 rounded-md border-2 border-black active:translate-y-[2px] active:translate-x-[2px] shadow-neo-sm flex items-center gap-1 shrink-0">
            <LogOut className="w-4 h-4" /> WYLOGUJ
          </button>
      </div>

      {/* ZARZĄDZANIE CZASEM */}
      <div className={`${neoCard} bg-white p-8`}>
        <h3 className="text-xl font-[900] uppercase mb-4">USTAW CZAS ZAKOŃCZENIA</h3>
          <div className="font-mono text-[11px] uppercase mb-3 text-slate-600">
            Wyświetlany czas zakończenia: <span className="font-[900] text-black">{appConfig?.endTime || 'brak'}</span>
          </div>
        <input 
          type="text" 
          placeholder="np. 15:30"
          value={displayedNewTime} 
          onChange={e => setNewTime(e.target.value)} 
          className="w-full p-3 border-[3px] border-black rounded-lg mb-4" 
        />
        <button 
          onClick={() => handleUpdateConfig('endTime', displayedNewTime)} 
          className={`${neoBtn} bg-black text-white w-full py-3`}
        >
          ZAPISZ CZAS
        </button>
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

// --- HOME (BENTO BOX LAYOUT) ---
function HomeView({ userData, appConfig, stations, stationsError, refetchStations, setView, setCurrentStationId, setShowRules }) {
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
                if (isDone) return;
                if (appConfig?.stationsClickable) {
                  setCurrentStationId(st.id);
                  setView('quiz');
                } else {
                  showAlert("ZESKANUJ KOD QR", "Aby odblokować to wyzwanie, udaj się na wybrane stanowisko i zeskanuj jego kod QR!");
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

// --- QUIZ VIEW ---
function QuizView({ station, userData, handleQuestionAnswered, submitting }) {
  const questionRefs = useRef([]); // Ref do przewijania
  const isDone = userData?.completedStations?.includes(station.id);
  const [localScore, setLocalScore] = useState(() => new Set(userData?.answeredQuestions?.[station.id] || []));
  const [questionCodes, setQuestionCodes] = useState({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(null);
  const [unlockedQuestions, setUnlockedQuestions] = useState(() => new Set(userData?.answeredQuestions?.[station.id] || []));
  const [answeredQuestions, setAnsweredQuestions] = useState(() => new Set(userData?.answeredQuestions?.[station.id] || []));
  const [selectedOptions, setSelectedOptions] = useState({});

  useEffect(() => {
    // Przewijanie do aktywnego pytania
    if (activeQuestionIdx !== null && questionRefs.current[activeQuestionIdx]) {
      setTimeout(() => {
        questionRefs.current[activeQuestionIdx].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100); // Małe opóźnienie dla pewności, że element jest widoczny
    }
  }, [activeQuestionIdx]);

  if (isDone) return (
    <div className="text-center py-20 animate-in zoom-in">
      <div className="bg-green-100 border-[3px] border-black w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-neo">
        <CheckCircle className="text-green-600 w-12 h-12" />
      </div>
      <h3 className="text-3xl font-[900] uppercase mb-4">PIECZĘĆ ZDOBYTA</h3>
      <p className="font-mono text-[12px] text-slate-500 uppercase">Szukaj kolejnych wyzwań na terenie turnieju.</p>
    </div>
  );

  const maxPoints = station.questions?.reduce((acc, q) => acc + (q.points || 0), 0) || 0;

  const getQuestionCodeValue = (question) => {
    if (!question) return undefined;
    const direct = question.code ?? question.Code ?? question.CODE ?? question.questionCode ?? question.QuestionCode;
    if (direct !== undefined) return direct;
    const key = Object.keys(question).find((k) => k.toLowerCase() === 'code');
    if (key) return question[key];
    const fuzzyKey = Object.keys(question).find((k) => k.toLowerCase().includes('code'));
    return fuzzyKey ? question[fuzzyKey] : undefined;
  };

  const requiresCode = (question) => {
    const code = getQuestionCodeValue(question);
    return code !== undefined && code !== null && code.toString().trim() !== '';
  };

  const handleUnlockQuestion = async (idx) => {
    const question = station.questions?.[idx];
    const expectedRaw = getQuestionCodeValue(question);
    if (!question || expectedRaw === undefined || expectedRaw === null || expectedRaw.toString().trim() === '') {
      console.warn('Brak kodu w obiekcie pytania lub nieznany klucz:', question);
      await showAlert("BŁĄD", "Brak kodu dla tego pytania.");
      return;
    }

    const enteredCode = (questionCodes[idx] || '').toString().trim().toUpperCase();
    const expectedCode = expectedRaw.toString().trim().toUpperCase();

    if (enteredCode === expectedCode) {
      setUnlockedQuestions((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setQuestionCodes((prev) => ({ ...prev, [idx]: '' }));
      setActiveQuestionIdx(idx);
    } else {
      await showAlert("ZŁY KOD", "Zapytaj Strażnika pytania o poprawny kod.");
    }
  };

  const handleOptionClick = (questionIdx, optionIdx) => {
    if (submitting || answeredQuestions.has(questionIdx)) return;
    const question = station.questions?.[questionIdx];
    if (!question) return;
    if (!unlockedQuestions.has(questionIdx) && requiresCode(question)) return;

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
    handleQuestionAnswered({
      stationId: station.id,
      questionIdx,
      pointsEarned: isCorrect ? (question.points || 0) : 0,
      questionCount: station.questions?.length || 0
    });
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
        <h3 className="text-[clamp(1.75rem,8vw,2.25rem)] font-[900] uppercase leading-none mb-4 break-words">{station.name}</h3>
        <div className="bg-white/20 p-4 rounded-[12px] font-mono text-[12px] font-bold flex justify-between">
          <span>MAX STACJI: {maxPoints} PKT</span>
          <span>ZDOBYTO: {localScore} PKT</span>
        </div>
      </div>

      <div className="space-y-6">
        {station.questions?.map((question, idx) => {
          const isUnlocked = unlockedQuestions.has(idx) || answeredQuestions.has(idx) || !requiresCode(question);
          const isAnswered = answeredQuestions.has(idx);
          const selectedOption = selectedOptions[idx];
          const isActive = activeQuestionIdx === idx;
          const isCorrect = selectedOption === question.correct;
          const answerOptions = (question.options && question.options.length)
            ? question.options
            : [question.option1, question.option2, question.option3, question.option4].filter(Boolean);

          return (
            <div 
              key={idx} 
              ref={el => questionRefs.current[idx] = el} // Przypisanie refa
              className={`${neoCard} bg-white p-6 transition-all duration-300 ${isAnswered ? 'opacity-60 grayscale' : ''}`}
            >
              <button type="button" onClick={() => setActiveQuestionIdx(isActive ? null : idx)} className="w-full text-left">
                <div className="flex items-start justify-between gap-4 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] tracking-widest uppercase text-slate-400 mb-2">Pytanie {idx + 1}</div>
                    <h4 className="text-[clamp(1.125rem,6vw,1.25rem)] font-[900] uppercase leading-tight break-words whitespace-normal">{question.question}</h4>
                  </div>
                  <div className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-full shrink-0 text-center max-w-[120px] md:max-w-none whitespace-normal ${isAnswered ? 'bg-green-100 text-green-700' : isUnlocked ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                    {isAnswered ? 'ODPOWIEDZIANE' : isUnlocked ? 'ODBLOKOWANE' : 'KOD PRZY ODPOWIEDZI'}
                  </div>
                </div>
              </button>

              {isActive && (
                <div className="mt-6 space-y-4">
                  {!isUnlocked ? (
                    <>
                      <p className="font-mono text-[11px] text-slate-600 font-bold uppercase text-center leading-tight">Kod zyskasz poprzez wykonanie zadania zleconego przez Strażnika pytania – kod daje dostęp do odpowiedzi.</p>
                      <input
                        type="text"
                        placeholder="KOD DO PYTANIA..."
                        className="w-full p-5 border-[3px] border-black rounded-[16px] mb-4 font-black uppercase outline-none focus:bg-yellow-50 text-center"
                        value={questionCodes[idx] || ''}
                        onChange={(e) => setQuestionCodes((prev) => ({ ...prev, [idx]: e.target.value }))}
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
                      {answerOptions.length ? (
                        <div className="grid grid-cols-1 gap-4">
                          {answerOptions.map((opt, optIdx) => {
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
                                className={`${neoBtn} ${btnStyle} text-left p-4 md:p-5 font-[900] uppercase text-[clamp(0.875rem,4.5vw,1.125rem)] flex justify-between items-center gap-3`}
                              >
                                <span className="min-w-0 break-words whitespace-normal">{opt}</span>
                                <ChevronRight className="w-6 h-6 shrink-0 transition-transform" />
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
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

    </div>
  );
}

// --- RULES MODAL ---
function RulesModal({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-[32px] p-6 max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
      >
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 id="rules-title" className="text-2xl font-[900] uppercase text-[#DC2626]">Regulamin i RODO</h2>
        </div>
        <div 
          className="overflow-y-auto flex-1 border-2 border-black rounded-xl p-5 space-y-5 mb-4 bg-slate-50 text-sm font-medium"
          tabIndex={0}
        >
          <RegRodo />
        </div>
        <button onClick={onClose} autoFocus className={`${neoBtn} w-full py-4 bg-black text-white flex justify-center items-center text-sm`}>
          ZROZUMIANO, ZAMKNIJ
        </button>
      </div>
    </div>
  );
}

// --- RANKING VIEW ---
function LeaderboardView({ appConfig }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => d.data());
      all.sort((a, b) => {
        const scoreDiff = (b.totalPoints || 0) - (a.totalPoints || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const getTime = (ts) => {
          if (!ts) return 0;
          try {
            const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime();
            return isNaN(ms) ? 0 : ms;
          } catch { return 0; }
        };
        const aTime = getTime(a.scoreUpdatedAt);
        const bTime = getTime(b.scoreUpdatedAt);
        if (aTime !== bTime) return aTime - bTime;

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