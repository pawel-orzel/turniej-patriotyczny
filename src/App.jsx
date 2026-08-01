import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  CheckCircle, ChevronRight, Activity,
  Flag, MapPin, LogOut
} from 'lucide-react';

import FinalStage from './final';
import { showAlert, showConfirm } from './modal';
import RegRodo from './reg.RODO';
import { AUTH_ROLES, canAccessAdminPanel, getAuthRole } from './authHelpers';

const OWNER_UID = "fIGFNjIUm6Onldwe27qb7R9vvB63"; // WAŻNE: Wklej tutaj swoje UID z panelu Firebase Authentication


// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCmfjCLK4zpMW95PQ5JnRosdFtwzRLcB80",
  authDomain: "aplikacje-lw.firebaseapp.com",
  projectId: "aplikacje-lw",
  storageBucket: "aplikacje-lw.appspot.com",
  messagingSenderId: "1091933939899",
  appId: "1:1091933939899:web:5b3c12c392b3e513ed855c",
  measurementId: "G-C5S0J6J0CR"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'turniej-orzel';

// --- STYL NEO-BRUTALISTYCZNY (CUSTOM CLASSES) ---
const neoCard = "border-[3px] border-black shadow-neo rounded-[32px]";
const neoBtn = "border-[3px] border-black shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all rounded-[16px]";
const neoTag = "font-mono text-[10px] tracking-widest uppercase border-2 border-black px-3 py-1 rounded-full inline-block";
const STATIONS_CACHE_KEY = 'stations_cache';
const CACHE_EXPIRATION_MS = 2 * 60 * 1000; // 2 minuty
const STAFF_SESSION_KEY = 'staff_session';
const GOOGLE_SCRIPT_URL = typeof window !== 'undefined'
  ? (window.__stations_url || import.meta.env.VITE_STATIONS_URL || 'https://script.google.com/macros/s/AKfycbzVoBjRhKnw9bMdRdGQe6wFrtKicSCd-S-ulA4IuxXv_-X1ikTH4zoAeSGs-GjDoYVkZQ/exec')
  : (import.meta.env.VITE_STATIONS_URL || 'https://script.google.com/macros/s/AKfycbzVoBjRhKnw9bMdRdGQe6wFrtKicSCd-S-ulA4IuxXv_-X1ikTH4zoAeSGs-GjDoYVkZQ/exec');

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
  const [adminEmail, setAdminEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const stored = window.localStorage.getItem(STAFF_SESSION_KEY);
      if (!stored) return '';
      const parsed = JSON.parse(stored);
      return typeof parsed?.email === 'string' ? parsed.email : '';
    } catch {
      return '';
    }
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState(null);
  const [adminAuthLastResponse, setAdminAuthLastResponse] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [stationsClickable, setStationsClickable] = useState(false);
  const [isReżyserkaOpen, setIsReżyserkaOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const isDevAdmin = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [isAdminSession, setIsAdminSession] = useState(false);
  const currentRole = getAuthRole(user, OWNER_UID, isDevAdmin);
  const canAccessAdmin = canAccessAdminPanel(user, isDevAdmin, isAdminSession, OWNER_UID);
  // Debug: safe log after state initialization
  console.log('App render', { view: undefined, loading: undefined, user: !!user, userDataLoaded: !!userData, isReżyserkaOpen, isDevAdmin });

  const getTimestampMs = useCallback((value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }, []);

  // --- LICZNIK CZASU ---
  useEffect(() => {
    const startValue = userData?.firstLoginAt || userData?.timestamp || user?.metadata?.creationTime;
    const startTime = getTimestampMs(startValue);

    if (!startTime) {
      setElapsedTime('00:00');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, now - startTime);
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [getTimestampMs, user, userData?.firstLoginAt, userData?.timestamp]);

  const waitForAuthState = useCallback((predicate, timeoutMs = 4000) => new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        unsubscribe();
        resolve();
      }
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!settled && predicate(u)) {
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  }), []);

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
    setStations(null);

    const iconMap = { coffee: Coffee, shield: Shield, heart: Heart, zap: Zap };

    try {
      const cachedItem = localStorage.getItem(STATIONS_CACHE_KEY);
      if (cachedItem) {
        const { timestamp, data } = JSON.parse(cachedItem);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
          Object.keys(data).forEach((key) => {
            data[key].icon = iconMap[(data[key].iconName || '').toLowerCase()] || Info;
          });
          setStations(data);
        }
      }
    } catch (cacheError) {
      console.warn('Nie udało się odczytać cache stacji.', cacheError);
    }

    if (!GOOGLE_SCRIPT_URL) {
      setStationsError('Brak adresu źródła danych stacji. Ustaw VITE_STATIONS_URL lub window.__stations_url.');
      return;
    }

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        headers: { Accept: 'application/json' }
      });
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Błąd pobierania danych stacji: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`);
      }

      if (contentType.includes('text/html')) {
        const body = await response.text();
        throw new Error(`Odpowiedź źródła danych ma nieprawidłowy format HTML: ${body}`);
      }

      const rawData = await response.json();
      const data = rawData.payload || rawData;
      if (!data || typeof data !== 'object' || !data.stations || typeof data.stations !== 'object') {
        throw new Error('Źródło danych zwróciło niepoprawny format JSON.');
      }

      const stationsFromSheet = data.stations;
      const processedStations = {};
      Object.keys(stationsFromSheet).forEach((stationId) => {
        const station = stationsFromSheet[stationId] || {};
        const questions = Array.isArray(station.questions)
          ? station.questions.map((q) => {
              const options = Array.isArray(q.options)
                ? q.options.filter((opt) => opt !== '' && opt !== null && opt !== undefined).map(String)
                : [q.option1, q.option2, q.option3, q.option4].filter((opt) => opt !== '' && opt !== null && opt !== undefined).map(String);

              const rawCorrect = Number(q.correct); // Zakładamy, że w arkuszu jest 1, 2, 3, 4
              const normalizedCorrect = Number.isFinite(rawCorrect) && rawCorrect > 0 ? rawCorrect - 1 : 0; // Normalizujemy do 0, 1, 2, 3
              const rawPoints = Number(q.points);
              const normalizedPoints = Number.isFinite(rawPoints) ? rawPoints : 0;

              return {
                question: String(q.question || q.pytanie || '').trim(),
                options,
                correct: normalizedCorrect, // correct index
                points: normalizedPoints,
                code: String(q.code || q.kod || '').trim(),
              };
            })
          : [];

        processedStations[stationId] = {
          id: station.id || stationId,
          name: station.name || stationId,
          category: station.category || '',
          color: station.color || '#000000',
          iconName: station.iconName || 'info',
          questions,
          icon: iconMap[(station.iconName || '').toLowerCase()] || Info
        };
      });

      setStations(processedStations);
      try {
        localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: processedStations }));
      } catch {
        console.warn('Zapis cache zablokowany przez przeglądarkę.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania danych ze źródła zewnętrznego:', error);
      setStationsError(error.message || 'Nie udało się załadować danych stacji z arkusza.');
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
    const sId = params.get('station'); // stationId from URL
    const adminParam = params.get('admin');
    if (adminParam === 'true' && canAccessAdmin) {
      setIsAdminSession(true);
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
      const firstLoginAt = user?.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toISOString()
        : new Date().toISOString();
      // Pola startowe ustawiamy tylko, jeśli użytkownik ich jeszcze nie ma
      if (!userData) {
        payload.totalPoints = 0;
        payload.completedStations = [];
        payload.answeredQuestions = {};
        payload.firstLoginAt = firstLoginAt;
        payload.timestamp = firstLoginAt;
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

  const handleQuestionAnswered = async ({ stationId, questionIdx, selectedOption, isCorrect, pointsEarned, questionCount }) => {
    if (!user || !userData) return;
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
    const currentAnswered = userData.answeredQuestions?.[stationId] || [];
    if (currentAnswered.includes(questionIdx)) return;

    const updates = {
      [`answeredQuestions.${stationId}`]: arrayUnion(questionIdx),
      [`selectedOptions.${stationId}.${questionIdx}`]: selectedOption
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!adminEmail) {
        window.localStorage.removeItem(STAFF_SESSION_KEY);
        return;
      }
      const nextValue = JSON.stringify({ email: adminEmail });
      window.localStorage.setItem(STAFF_SESSION_KEY, nextValue);
    } catch (err) {
      console.warn('Nie udało się zapisać stanu logowania sztabu w przeglądarce', err);
    }
  }, [adminEmail]);

  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      await showAlert("BRAK DANYCH", "Wpisz email i hasło!");
      return;
    }
    const normalizedAdminEmail = adminEmail.trim().toLowerCase();
    setLoading(true);
    setAdminLoginError(null);
    try {
      if (auth.currentUser) {
        await signOut(auth);
        await waitForAuthState((u) => !u);
      }
      await setPersistence(auth, inMemoryPersistence);
      const result = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const myUid = result.user.uid;
      const isAuthorizedAdmin = myUid === OWNER_UID || result.user.email?.toLowerCase() === normalizedAdminEmail;

      if (isAuthorizedAdmin) {
        await waitForAuthState((u) => !!u && u.uid === myUid, 4000);
        window.history.replaceState({}, '', '?admin=true');
        setAdminEmail('');
        setAdminPassword('');
        setIsAdminSession(true);
        setView('admin');
        setShowAdminForm(false);
      } else {
        await showAlert("ZALOGOWANO!", "Twoje UID to:\n" + myUid + "\n\nSkopiuj je (jest też w konsoli - wciśnij F12) i wklej jako OWNER_UID na samej górze kodu!");
        console.log("=== TWOJE UID ADMINA (SKOPIUJ) ===");
        console.log(myUid);
        await signOut(auth);
        await waitForAuthState((u) => !u);
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
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
      console.log('handleLogout start', { uid: user?.uid, isOwner: user?.uid === OWNER_UID, isDevAdmin, currentRole });
      setLoading(true);
      setShowAdminForm(false);
      setAdminEmail('');
      setAdminPassword('');
      setAdminLoginError(null);
      try {
        window.localStorage.removeItem(STAFF_CREDENTIALS_KEY);
      } catch (err) {
        console.warn('Nie udało się usunąć zapisanych danych logowania sztabu', err);
      }
      setAdminAuthLastResponse(null);
      window.history.replaceState({}, '', window.location.pathname);

      if (user?.uid === OWNER_UID || currentRole === AUTH_ROLES.admin) {
        await signOut(auth);
        await waitForAuthState((u) => !u);
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
        setUserData(null);
        setNick('');
        setCurrentStationId(null);
        setIsAdminSession(false);
        setView('home');
      } else {
        await signOut(auth);
        await waitForAuthState((u) => !u);
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
        setUserData(null);
        setNick('');
        setCurrentStationId(null);
        setIsAdminSession(false);
        setView('passport');
      }
    } catch (err) {
      console.error("Błąd wylogowania: ", err);
    } finally {
      setLoading(false);
      console.log('handleLogout end - loading set false');
    }
  };

  if (loading) return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] bg-[#F9FAFB] flex items-center justify-center"><div className="w-12 h-12 border-4 border-black border-t-[#DC2626] rounded-full animate-spin"></div></div>
    </ErrorBoundary>
  );

  const isPassportScreen = !user || (user && !userData && view !== 'admin');
  
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
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
              <input 
                type="password" 
                placeholder="HASŁO..." 
                className="w-full p-5 border-[3px] border-black rounded-[16px] mb-4 font-black outline-none focus:bg-slate-100"
                autoComplete="current-password"
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
                defaultValue={nick || userData?.nick}
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
      <FinalStage db={db} user={user} userData={userData} appId={appId} stations={stations} isAdmin={canAccessAdmin} isOpen={isReżyserkaOpen} setIsOpen={setIsReżyserkaOpen} />

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
        {view === 'admin' && canAccessAdmin ? (
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
      {canAccessAdmin && (
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
      {canAccessAdmin && (
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
function AdminView({ stations }) {
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

  const [copiedUrl, setCopiedUrl] = useState('');

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

// --- QUIZ VIEW ---
function QuizView({ station, userData, handleQuestionAnswered, submitting }) {
  const questionRefs = useRef([]); // Ref do przewijania
  const isDone = userData?.completedStations?.includes(station.id);
  const [isSaving, setIsSaving] = useState(false);
  const [questionCodes, setQuestionCodes] = useState({});
  const [unlockedQuestions, setUnlockedQuestions] = useState(() => new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState(() => new Set(userData?.answeredQuestions?.[station.id] || []));
  
  const getQuestionCodeValue = useCallback((question) => {
    if (!question) return undefined;
    const code = question.code ?? question.kod;
    return (code !== undefined && code !== null && String(code).trim() !== '') ? String(code).trim() : undefined;
  }, []);

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(() => station.questions?.findIndex((q, i) => !answeredQuestions.has(i)) ?? 0);
  const [selectedOptions, setSelectedOptions] = useState(() => 
    userData?.selectedOptions?.[station.id] || {}
  );
  const [savedMessage, setSavedMessage] = useState('');
  const [answeredCorrectly, setAnsweredCorrectly] = useState(() => {
    const initialCorrect = new Set();
    const answeredInStation = userData?.answeredQuestions?.[station.id] || [];
    if (Array.isArray(answeredInStation)) {
      answeredInStation.forEach(qIdx => {
        const question = station.questions?.[qIdx];
        const selected = userData.selectedOptions?.[station.id]?.[qIdx];
        if (question && selected !== undefined && question.correct === selected) {
          initialCorrect.add(qIdx);
        }
      });
    }
    return initialCorrect;
  });

  const localScore = useMemo(() => {
    if (!station.questions || !answeredCorrectly.size) return 0;
    let score = 0;
    answeredCorrectly.forEach(questionIdx => {
      const question = station.questions[questionIdx];
      if (question) {
        score += question.points || 0;
      }
    });
    return score;
  }, [answeredCorrectly, station.questions]);

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

  const requiresCode = useCallback((question) => !!getQuestionCodeValue(question), [getQuestionCodeValue]);

  const handleUnlockQuestion = async (idx) => {
    const question = station.questions?.[idx];
    const expectedCode = getQuestionCodeValue(question);
    if (!question || !expectedCode) {
      console.warn('Brak kodu w obiekcie pytania lub nieznany klucz:', question);
      await showAlert("BŁĄD", "Brak kodu dla tego pytania.");
      return;
    }

    const enteredCode = (questionCodes[idx] || '').toString().trim().toUpperCase();

    if (enteredCode === expectedCode) {
      setUnlockedQuestions(prev => new Set(prev).add(idx));
      setQuestionCodes((prev) => ({ ...prev, [idx]: '' }));
      setActiveQuestionIdx(idx);
    } else {
      await showAlert("ZŁY KOD", "Zapytaj Strażnika pytania o poprawny kod.");
    }
  };
  const handleOptionClick = async (questionIdx, optionIdx) => {
    if (isSaving || submitting || answeredQuestions.has(questionIdx)) return;
    const question = station.questions?.[questionIdx];
    if (!question) return;

    const needsCode = requiresCode(question);
    const isUnlocked = unlockedQuestions.has(questionIdx);

    if (needsCode && !isUnlocked) {
      await showAlert("PYTANIE ZABLOKOWANE", "Musisz najpierw odblokować to pytanie za pomocą poprawnego kodu.");
      setActiveQuestionIdx(questionIdx); // Otwórz pytanie, żeby pokazać pole na kod
      return;
    }
    
    const isCorrect = optionIdx === question.correct;
    
    // Natychmiastowa aktualizacja stanu lokalnego, aby zablokować interfejs
    setAnsweredQuestions(prev => new Set(prev).add(questionIdx));
    setSelectedOptions((prev) => ({ ...prev, [questionIdx]: optionIdx }));
    if (isCorrect) {
      setAnsweredCorrectly(prev => new Set(prev).add(questionIdx));
    }
    
    setIsSaving(true);
    setSavedMessage('ZAPISYWANIE...');
    await handleQuestionAnswered({
      stationId: station.id,
      questionIdx,
      selectedOption: optionIdx,
      isCorrect,
      pointsEarned: isCorrect ? (question.points || 0) : 0,
      questionCount: station.questions?.length || 0
    });
    setIsSaving(false);
    setSavedMessage('ODPOWIEDŹ ZAPISANA');
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
          const needsCode = requiresCode(question);
          const isUnlocked = unlockedQuestions.has(idx);
          const isAnswered = answeredQuestions.has(idx);
          const selectedOption = selectedOptions[idx];
          const isActive = activeQuestionIdx === idx;
          const isCorrect = selectedOption === question.correct;
          const answerOptions = question.options || [];

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
                  <div className={`font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-full shrink-0 text-center max-w-[120px] md:max-w-none whitespace-normal ${isAnswered ? 'bg-green-100 text-green-700' : (needsCode && !isUnlocked) ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-600'}`}>
                    {isAnswered ? 'ODPOWIEDZIANE' : needsCode ? 'WYMAGA KODU' : 'OTWARTE'}
                  </div>
                </div>
              </button>

              {isActive && (
                <div className="mt-6 space-y-4">
                  {needsCode && !isUnlocked && !isAnswered ? (
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
                            const isSelected = selectedOption === optIdx;
                            const isCorrectAnswer = optIdx === question.correct;
                            let btnStyle = 'bg-white text-black';

                            if (isAnswered) {
                              if (isCorrectAnswer) {
                                btnStyle = 'bg-green-600 text-white border-green-700';
                              } else if (isSelected) {
                                btnStyle = 'bg-red-600 text-white border-red-700';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                disabled={submitting || isAnswered || isSaving}
                                onClick={() => handleOptionClick(idx, optIdx)}
                                className={`${neoBtn} ${btnStyle} text-left p-4 md:p-5 font-[900] uppercase text-[clamp(0.875rem,4.5vw,1.125rem)] flex justify-between items-center gap-3`}
                              >
                                <span className="min-w-0 break-words whitespace-normal">{opt}</span>
                                {isSaving && isSelected ? 
                                  <div className="w-6 h-6 shrink-0 border-2 border-current border-t-transparent rounded-full animate-spin"></div> :
                                  <ChevronRight className="w-6 h-6 shrink-0 transition-transform" />
                                }
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {isAnswered && (
                    <div className={`rounded-[16px] p-4 font-mono text-sm ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <div className="mb-2 font-bold uppercase text-[11px] tracking-widest">
                        {isCorrect ? 'POPRAWNA ODPOWIEDŹ' : 'ZŁA ODPOWIEDŹ'}
                      </div>
                      {isCorrect ? 'Poprawna odpowiedź! Punkty zostały zapisane.' : 'Błędna odpowiedź. Możesz przejść do następnego pytania.'}
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