import { Header } from './ui/components/Header';
import { Leaderboard } from './ui/pages/Leaderboard';
import { UserDetail } from './ui/pages/UserDetail';
import { useRoute } from './ui/lib/router';

export function App() {
  const route = useRoute();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Header />
      <main className="flex-1">
        {route.page === 'user' && route.userId ? (
          <UserDetail userId={route.userId} />
        ) : (
          <Leaderboard />
        )}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-5 font-mono text-3xs font-medium uppercase tracking-widest text-ink-faint">
          <span>Mock data · seed 42 · 30d window</span>
          <span>
            docs/<span className="text-ink-muted">POINTS_SPEC.md</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
