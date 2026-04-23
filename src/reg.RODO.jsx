import React from 'react';

export default function RegRodo() {
  return (
    <>
      <section>
        <h3 className="font-[900] uppercase mb-2 text-black">1. Zasady Turnieju</h3>
        <ul className="list-disc pl-4 space-y-2 text-slate-700">
          <li>Turniej składa się z eliminacji mobilnych oraz półfinału i finału na scenie.</li>
          <li>W eliminacjach gracze zdobywają punkty za poprawne odpowiedzi na stacjach po uprzednim wpisaniu tajnego kodu od instruktora.</li>
          <li>O miejscu w rankingu decyduje suma punktów, a w przypadku remisu - czas zdobycia ostatniego punktu (kto pierwszy, ten lepszy). W ostateczności brany jest pod uwagę najkrótszy czas ukończenia gry.</li>
          <li>Najlepszych graczy awansuje do fazy LIVE (Półfinału i Finału) rozgrywanej na scenie głównej.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-[900] uppercase mb-2 text-black">2. Ochrona Danych (RODO)</h3>
        <ul className="list-disc pl-4 space-y-2 text-slate-700">
          <li>Aplikacja <strong>nie zbiera</strong> danych wrażliwych (takich jak imię, nazwisko, pesel czy adres e-mail).</li>
          <li>Logowanie opiera się na autoryzacji anonimowej. Wymagane jest jedynie podanie pseudonimu ("Nicku"). Zalecamy używanie nicków, które nie pozwalają na bezpośrednią identyfikację w świecie rzeczywistym.</li>
          <li>Twój Nick oraz wyniki punktowe i czasowe są przetwarzane wyłącznie na potrzeby realizacji turnieju i są publicznie widoczne w rankingu na żywo dla wszystkich uczestników wydarzenia.</li>
          <li>Dane przechowywane są w zabezpieczonej bazie chmurowej i zostaną trwale usunięte po zakończeniu imprezy (w procesie resetu bazy).</li>
        </ul>
      </section>
    </>
  );
}