import type { QueryIntent, Source } from '@/types/nova.types';
import { makeAgent } from './base';
export default makeAgent({
  id: '08-weather', name: 'Weather API', priority: 8, timeout: 4000,
  shouldActivate: (_q: string, intent: QueryIntent) => intent === 'weather',
  run: async (query, signal) => {
    const locationMatch = query.match(/(?:in|for|at)\s+([A-Za-z\s,]+?)(?:\?|$)/i);
    // FIX: wrap ?? + || in parens — Turbopack requires this
    const location = (locationMatch?.[1]?.trim() ?? query.replace(/weather|forecast|temperature/gi, '').trim()) || 'auto';
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, { signal });
      if (!res.ok) return [];
      const data = await res.json() as {
        current_condition?: Array<{
          temp_C?: string; temp_F?: string;
          weatherDesc?: Array<{ value?: string }>;
          humidity?: string; windspeedKmph?: string;
        }>
      };
      const cond = data.current_condition?.[0];
      if (!cond) return [];
      const desc = `${location}: ${cond.weatherDesc?.[0]?.value ?? 'Unknown'}, ${cond.temp_C}°C / ${cond.temp_F}°F, Humidity: ${cond.humidity}%, Wind: ${cond.windspeedKmph}km/h`;
      return [{ id: 1, title: `Weather in ${location}`, url: `https://wttr.in/${location}`, snippet: desc, domain: 'wttr.in', date: new Date().toISOString() }] as Source[];
    } catch { return []; }
  },
});
