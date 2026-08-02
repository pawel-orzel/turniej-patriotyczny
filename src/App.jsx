import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  arrayUnion,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import { 
  Coffee, Shield, Heart, Zap, Info
} from 'lucide-react';

import FinalStage from './final';
import { showAlert, showConfirm } from './modal';
import { AUTH_ROLES, canAccessAdminPanel, getAuthRole } from './authHelpers';
import { db, auth, appId } from './firebaseConfig';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminView } from './components/AdminView';
import { HomeView } from './components/HomeView';
import { QuizView } from './components/QuizView';
import { RulesModal } from './components/RulesModal';
import { LeaderboardView } from './components/LeaderboardView';
import { PassportView } from './components/PassportView';
import { useStations } from './hooks/useStations';
import { Layout } from './components/Layout';

const OWNER_UID = "fIGFNjIUm6Onldwe27qb7R9vvB63"; // WAŻNE: Wklej tutaj swoje UID z panelu Firebase Authentication

const STAFF_SESSION_KEY = 'staff_session';

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'leaderboard' | 'quiz' | 'admin'
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState(null);
  const [adminAuthLastResponse, setAdminAuthLastResponse] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [stationsClickable, setStationsClickable] = useState(false);
  const [isReżyserkaOpen, setIsReżyserkaOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const { stations, stationsError, refetchStations } = useStations();

  const [impersonatedUserData, setImpersonatedUserData] = useState(null); // Nowy stan do podglądu

  const isDevAdmin = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [isAdminSession, setIsAdminSession] = useState(false);
  const currentRole = useMemo(() => getAuthRole(user, OWNER_UID, isDevAdmin), [user, isDevAdmin]);
  const canAccessAdmin = useMemo(() => canAccessAdminPanel(user, isDevAdmin, isAdminSession, OWNER_UID), [user, isDevAdmin, isAdminSession]);
  // Debug: safe log after state initialization
  console.log('App render', { view: undefined, loading: undefined, user: !!user, userDataLoaded: !!userData, isReżyserkaOpen, isDevAdmin });

  const displayUserData = impersonatedUserData || userData;

  const getTimestampMs = useCallback((value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }, []);

  // --- LICZNIK CZASU ---
  useEffect(() => {
    const startValue = displayUserData?.firstLoginAt || displayUserData?.timestamp || user?.metadata?.creationTime;
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
  }, [getTimestampMs, user, displayUserData?.firstLoginAt, displayUserData?.timestamp]);

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
      setView('admin'); // Pozostawiamy, aby admin mógł wejść do panelu
    } else if (stations[sId] && userData) {
      setCurrentStationId(sId);
      setView('quiz');
    }
  }, [user, userData, stations, isDevAdmin, canAccessAdmin]); // Reaguj gdy załaduje się user i jego dane

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

  const handleRegister = async (nick) => {
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

    // POPRAWNA STRUKTURA: Zagnieżdżone obiekty zamiast notacji z kropką
    const payload = {
      answeredQuestions: {
        [stationId]: arrayUnion(questionIdx)
      },
      selectedOptions: {
        [stationId]: {
          [questionIdx.toString()]: selectedOption
        }
      }
    };

    if (pointsEarned > 0) {
      payload.totalPoints = increment(pointsEarned);
      payload.scoreUpdatedAt = serverTimestamp();
    }
    
    if (currentAnswered.length + 1 >= questionCount) {
      payload.completedStations = arrayUnion(stationId);
    }

    setSubmitting(true);
    try {
      await setDoc(userRef, payload, { merge: true });
    } catch (err) {
      console.error('Błąd zapisu odpowiedzi:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
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

  const handleAdminLogin = async (adminEmail, adminPassword) => {
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
        setIsAdminSession(true);
        setView('admin');
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
      setAdminLoginError(null);
      try {
        window.localStorage.removeItem(STAFF_CREDENTIALS_KEY);
      } catch (err) {
        console.warn('Nie udało się usunąć zapisanych danych logowania sztabu', err);
      }
      setAdminAuthLastResponse(null);
      window.history.replaceState({}, '', window.location.pathname);

      if (currentRole === AUTH_ROLES.admin) {
        await signOut(auth);
        await waitForAuthState((u) => !u);
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
        setUserData(null);
        setCurrentStationId(null);
        setIsAdminSession(false);
        setView('home');
      } else {
        await signOut(auth);
        await waitForAuthState((u) => !u);
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
        setUserData(null);
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
  
  if (isPassportScreen && !loading) {
    return (
      <ErrorBoundary>
        <PassportView
          onRegister={handleRegister}
          onAdminLogin={handleAdminLogin}
          userData={userData}
          submitting={submitting}
          adminLoginError={adminLoginError}
          adminAuthLastResponse={adminAuthLastResponse}
        />
      </ErrorBoundary>
    );
  }

    return (
    <ErrorBoundary>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      <FinalStage db={db} user={user} userData={userData} appId={appId} stations={stations} isAdmin={canAccessAdmin} isOpen={isReżyserkaOpen} setIsOpen={setIsReżyserkaOpen} />
      <Layout
        userData={userData}
        appConfig={appConfig}
        elapsedTime={elapsedTime}
        view={view}
        setView={setView}
        handleLogout={handleLogout}
        canAccessAdmin={canAccessAdmin}
        setIsReżyserkaOpen={setIsReżyserkaOpen}
        stationsClickable={stationsClickable}
        handleUpdateConfig={handleUpdateConfig}
      >
        {view === 'admin' && canAccessAdmin ? (
          <AdminView appConfig={appConfig} user={user} stations={stations} onLogout={handleLogout} handleUpdateConfig={handleUpdateConfig} />
        ) : view === 'quiz' && currentStationId && stations && stations[currentStationId] ? (
          <QuizView key={currentStationId} station={stations[currentStationId]} userData={userData} handleQuestionAnswered={handleQuestionAnswered} submitting={submitting} />
        ) : view === 'leaderboard' ? (
          <LeaderboardView appConfig={appConfig} />
        ) : (
          <HomeView userData={userData} appConfig={appConfig} stations={stations} stationsError={stationsError} refetchStations={refetchStations} setView={setView} setCurrentStationId={setCurrentStationId} setShowRules={setShowRules} stationsClickable={stationsClickable} />
        )}
      </Layout>
    </ErrorBoundary>
    );
}