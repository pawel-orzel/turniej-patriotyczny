import { useState, useCallback, useEffect } from 'react';
import { Coffee, Shield, Heart, Zap, Info } from 'lucide-react';

const STATIONS_CACHE_KEY = 'stations_cache';
const CACHE_EXPIRATION_MS = 2 * 60 * 1000; // 2 minuty

const GOOGLE_SCRIPT_URL = typeof window !== 'undefined'
  ? (window.__stations_url || import.meta.env.VITE_STATIONS_URL || 'https://script.google.com/macros/s/AKfycbzVoBjRhKnw9bMdRdGQe6wFrtKicSCd-S-ulA4IuxXv_-X1ikTH4zoAeSGs-GjDoYVkZQ/exec')
  : (import.meta.env.VITE_STATIONS_URL || 'https://script.google.com/macros/s/AKfycbzVoBjRhKnw9bMdRdGQe6wFrtKicSCd-S-ulA4IuxXv_-X1ikTH4zoAeSGs-GjDoYVkZQ/exec');

const iconMap = { coffee: Coffee, shield: Shield, heart: Heart, zap: Zap };

export function useStations() {
  const [stations, setStations] = useState(null);
  const [stationsError, setStationsError] = useState(null);

  const fetchStations = useCallback(async () => {
    setStationsError(null);
    // 1. Sprawdź cache
    try {
      const cachedItem = localStorage.getItem(STATIONS_CACHE_KEY);
      if (cachedItem) {
        const { timestamp, data } = JSON.parse(cachedItem);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
          Object.keys(data).forEach((key) => {
            data[key].icon = iconMap[(data[key].iconName || '').toLowerCase()] || Info;
          });
          setStations(data);
          return; // Zakończ, jeśli dane z cache są świeże
        }
      }
    } catch (cacheError) {
      console.warn('Nie udało się odczytać cache stacji.', cacheError);
    }

    // Pokaż loader tylko jeśli nie ma nic w cache
    setStations(null);

    if (!GOOGLE_SCRIPT_URL) {
      setStationsError('Brak adresu źródła danych stacji. Ustaw VITE_STATIONS_URL lub window.__stations_url.');
      return;
    }

    // 2. Pobierz z sieci
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Błąd sieci: ${response.status} ${response.statusText}`);

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
                ? q.options.filter(Boolean).map(String)
                : [q.option1, q.option2, q.option3, q.option4].filter(Boolean).map(String);
              const rawCorrect = Number(q.correct);
              const normalizedCorrect = Number.isFinite(rawCorrect) && rawCorrect > 0 ? rawCorrect - 1 : 0;
              return {
                question: String(q.question || '').trim(),
                options,
                correct: normalizedCorrect,
                points: Number(q.points) || 0,
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
          icon: iconMap[(station.iconName || '').toLowerCase()] || Info,
        };
      });

      setStations(processedStations);
      localStorage.setItem(STATIONS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: processedStations }));
    } catch (error) {
      console.error('Błąd podczas pobierania danych ze źródła zewnętrznego:', error);
      setStationsError(error.message || 'Nie udało się załadować danych stacji z arkusza.');
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  return { stations, stationsError, refetchStations: fetchStations };
}