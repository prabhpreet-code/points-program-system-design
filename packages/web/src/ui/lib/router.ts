import { useEffect, useState } from 'react';

export interface Route {
  page: 'leaderboard' | 'user';
  userId?: string;
}

function parse(hash: string): Route {
  const m = hash.match(/^#\/u\/(.+)$/);
  if (m) return { page: 'user', userId: decodeURIComponent(m[1]!) };
  return { page: 'leaderboard' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: Route): void {
  const hash = to.page === 'user' ? `#/u/${encodeURIComponent(to.userId!)}` : '#/';
  if (window.location.hash !== hash) window.location.hash = hash;
}
