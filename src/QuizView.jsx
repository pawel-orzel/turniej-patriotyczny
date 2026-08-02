import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { showAlert } from './modal';
import { neoCard, neoBtn } from './styles';

export function QuizView({ station, userData, handleQuestionAnswered, submitting }) {
  const questionRefs = useRef([]); // Ref do przewijania
  const isDone = userData?.completedStations?.includes(station.id);
  const [isSaving, setIsSaving] = useState(false);
  const [questionCodes, setQuestionCodes] = useState({});
  const [unlockedQuestions, setUnlockedQuestions] = useState(() => new Set());
  const [pendingSelection, setPendingSelection] = useState({});
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

  const handleOptionSelect = (questionIdx, optionIdx) => {
    if (isSaving || submitting || answeredQuestions.has(questionIdx)) return;
    setPendingSelection(prev => ({
      ...prev,
      [questionIdx]: prev[questionIdx] === optionIdx ? undefined : optionIdx
    }));
  };

  const handleConfirmAnswer = async (questionIdx) => {
    const selectedOptionIdx = pendingSelection[questionIdx];
    if (selectedOptionIdx === undefined || isSaving || submitting || answeredQuestions.has(questionIdx)) return;

    const question = station.questions?.[questionIdx];
    if (!question) return;

    const needsCode = requiresCode(question);
    const isUnlocked = unlockedQuestions.has(questionIdx);
    if (needsCode && !isUnlocked) {
      await showAlert("PYTANIE ZABLOKOWANE", "Musisz najpierw odblokować to pytanie za pomocą poprawnego kodu.");
      setActiveQuestionIdx(questionIdx);
      return;
    }

    const isCorrect = selectedOptionIdx === question.correct;

    setAnsweredQuestions(prev => new Set(prev).add(questionIdx));
    setSelectedOptions((prev) => ({ ...prev, [questionIdx]: selectedOptionIdx }));
    if (isCorrect) {
      setAnsweredCorrectly(prev => new Set(prev).add(questionIdx));
    }

    setIsSaving(true);
    setSavedMessage('ZAPISYWANIE...');

    try {
      await handleQuestionAnswered({
        stationId: station.id,
        questionIdx,
        selectedOption: selectedOptionIdx,
        isCorrect,
        pointsEarned: isCorrect ? (question.points || 0) : 0,
        questionCount: station.questions?.length || 0
      });

      await showAlert('SUKCES!', 'Twoja odpowiedź została pomyślnie zapisana.');
      setAnsweredQuestions(prev => new Set(prev).add(questionIdx));
      setSelectedOptions((prev) => ({ ...prev, [questionIdx]: selectedOptionIdx }));
      if (isCorrect) {
        setAnsweredCorrectly(prev => new Set(prev).add(questionIdx));
      }
      setSavedMessage('ODPOWIEDŹ ZAPISANA');

      const nextUnansweredQuestions = new Set(answeredQuestions);
      nextUnansweredQuestions.add(questionIdx);
      const nextIdx = station.questions?.findIndex((q, i) => !nextUnansweredQuestions.has(i));
      if (nextIdx !== undefined && nextIdx !== -1) {
        setTimeout(() => {
          setActiveQuestionIdx(nextIdx);
        }, 1200);
      }
    } catch (err) {
      console.error('Błąd zapisu odpowiedzi w quizie:', err);
      setSavedMessage('BŁĄD ZAPISU');
      const errorMessage = `Nie udało się zapisać odpowiedzi.\n\nPowód:\n${JSON.stringify({ code: err.code, message: err.message }, null, 2)}`;
      await showAlert('BŁĄD ZAPISU', errorMessage);
    } finally {
      setIsSaving(false);
    }
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
          const pendingOption = pendingSelection[idx];
          const isCorrect = selectedOption === question.correct;
          const answerOptions = question.options || [];

          return (
            <div 
              key={idx} 
              ref={el => questionRefs.current[idx] = el} // Przypisanie refa
              className={`${neoCard} bg-white p-6 transition-all duration-300 ${isAnswered ? 'opacity-90' : ''}`}
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
                            const isSelected = isAnswered ? selectedOption === optIdx : pendingOption === optIdx;
                            const isCorrectAnswer = optIdx === question.correct;
                            let btnStyle = isSelected ? 'bg-yellow-200 border-yellow-500' : 'bg-white text-black';

                            if (isAnswered) {
                              if (isCorrectAnswer) {
                                btnStyle = 'bg-green-600 text-white border-green-700';
                              } else if (selectedOption === optIdx) {
                                btnStyle = 'bg-red-600 text-white border-red-700';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                disabled={submitting || isAnswered || isSaving}
                                onClick={() => handleOptionSelect(idx, optIdx)}
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
                      {!isAnswered && pendingOption !== undefined && (
                        <button
                          disabled={isSaving}
                          onClick={() => handleConfirmAnswer(idx)}
                          className={`${neoBtn} w-full py-5 bg-green-600 text-white font-[900] uppercase mt-4`}
                        >
                          {isSaving ? 'ZAPISYWANIE...' : 'ZATWIERDŹ ODPOWIEDŹ'}
                        </button>
                      )}
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