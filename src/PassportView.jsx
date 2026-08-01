import React, { useState } from 'react';
import { neoCard, neoBtn } from '../styles';
import { RulesModal } from './RulesModal';

export function PassportView({
  onRegister,
  onAdminLogin,
  userData,
  nick: initialNick,
  submitting,
  adminLoginError,
  adminAuthLastResponse,
}) {
  const [nick, setNick] = useState(initialNick || userData?.nick || '');
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showRules, setShowRules] = useState(false);

  const handleRegisterClick = () => {
    onRegister(nick);
  };

  const handleAdminLoginClick = () => {
    onAdminLogin(adminEmail, adminPassword);
  };

  return (
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
              onClick={handleAdminLoginClick}
              disabled={submitting}
              className={`${neoBtn} w-full py-5 bg-black text-white font-[900] uppercase`}
            >
              {submitting ? 'LOGOWANIE...' : 'ZALOGUJ DO SZTABU'}
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
              onClick={handleRegisterClick}
              disabled={submitting}
              className={`${neoBtn} w-full py-5 bg-[#DC2626] text-white font-[900] uppercase`}
            >
              {submitting ? 'ZAPISYWANIE...' : (userData?.nick ? 'ZAPISZ NICK I WRÓĆ' : 'OTWÓRZ PASZPORT')}
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
  );
}