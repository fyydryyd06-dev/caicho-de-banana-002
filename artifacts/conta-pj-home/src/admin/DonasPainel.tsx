import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';

const TOKEN_KEY = 'donas-admin-token';

type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'authed'; username: string };

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`/api${path}`, init);
}

function DonasLogin({ onLogin }: { onLogin: (username: string, token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await apiFetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.token) {
        onLogin(data.username ?? username, data.token);
      } else {
        setError(data.message ?? 'Não foi possível entrar. Tente novamente.');
      }
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="donas-auth" data-testid="donas-login">
      <aside className="donas-hero" aria-hidden="true">
        <div className="donas-hero-overlay" />
        <div className="donas-hero-footer">
          <span className="donas-badge">
            <ShieldCheck size={13} />
            ACESSO RESTRITO
          </span>
          <p className="donas-quote">
            Painel administrativo — acesso monitorado e restrito a operadores autorizados.
          </p>
        </div>
      </aside>

      <section className="donas-panel">
        <form className="donas-card" onSubmit={handleSubmit}>
          <div className="donas-brand">
            <span className="donas-brand-mark">BB</span>
            <span className="donas-brand-text">
              <strong>Banco do Brasil</strong>
              <small>DONAS PAINEL</small>
            </span>
          </div>

          <h1 className="donas-title">Acessar painel</h1>
          <p className="donas-subtitle">Digite suas credenciais para continuar.</p>

          <label className="donas-label" htmlFor="donas-user">USUÁRIO</label>
          <div className="donas-input-wrap">
            <User size={16} className="donas-input-icon" />
            <input
              id="donas-user"
              className="donas-input"
              type="text"
              autoComplete="username"
              placeholder="seu usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="donas-input-user"
              required
            />
          </div>

          <label className="donas-label" htmlFor="donas-pass">SENHA</label>
          <div className="donas-input-wrap">
            <Lock size={16} className="donas-input-icon" />
            <input
              id="donas-pass"
              className="donas-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="donas-input-pass"
              required
            />
            <button
              type="button"
              className="donas-eye"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              data-testid="donas-toggle-pass"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="donas-error" role="alert" data-testid="donas-error">{error}</p>
          )}

          <button className="donas-submit" type="submit" disabled={loading} data-testid="donas-submit">
            {loading ? 'Entrando…' : 'Entrar'}
            <ArrowRight size={16} />
          </button>

          <p className="donas-footer">
            <ShieldCheck size={13} />
            Conexão segura · Apenas administradores autorizados
          </p>
        </form>
      </section>
    </div>
  );
}

const MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tentativas', label: 'Tentativas de login', icon: ListChecks },
  { key: 'acessos', label: 'Acessos', icon: Activity },
  { key: 'sessoes', label: 'Visitantes/Sessões', icon: Users },
  { key: 'config', label: 'Configurações', icon: Settings },
] as const;

function DonasDashboard({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [active, setActive] = useState<(typeof MENU)[number]['key']>('dashboard');
  const current = MENU.find((m) => m.key === active) ?? MENU[0];

  return (
    <div className="donas-shell" data-testid="donas-dashboard">
      <aside className="donas-sidebar">
        <div className="donas-brand donas-brand--sidebar">
          <span className="donas-brand-mark">BB</span>
          <span className="donas-brand-text">
            <strong>Banco do Brasil</strong>
            <small>DONAS PAINEL</small>
          </span>
        </div>
        <nav className="donas-nav">
          {MENU.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`donas-nav-item${active === item.key ? ' is-active' : ''}`}
                onClick={() => setActive(item.key)}
                data-testid={`donas-menu-${item.key}`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button type="button" className="donas-logout" onClick={onLogout} data-testid="donas-logout">
          <LogOut size={16} />
          Sair
        </button>
      </aside>

      <main className="donas-main">
        <header className="donas-topbar">
          <h1>{current.label}</h1>
          <span className="donas-user">
            <User size={15} />
            {username}
          </span>
        </header>
        <section className="donas-content">
          <div className="donas-empty">
            <current.icon size={30} />
            <h2>{current.label}</h2>
            <p>Estrutura inicial. Os dados desta seção serão implementados nas próximas etapas.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function DonasPainel() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAuth({ status: 'guest' });
      return;
    }
    apiFetch('/admin/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          const d = await r.json();
          setAuth({ status: 'authed', username: d.username });
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setAuth({ status: 'guest' });
        }
      })
      .catch(() => {
        if (!cancelled) setAuth({ status: 'guest' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = (usernameValue: string, token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuth({ status: 'authed', username: usernameValue });
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setAuth({ status: 'guest' });
    try {
      await apiFetch('/admin/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      /* logout é stateless no servidor */
    }
  };

  if (auth.status === 'checking') {
    return <div className="donas-checking" data-testid="donas-checking">Carregando…</div>;
  }
  if (auth.status !== 'authed') {
    return <DonasLogin onLogin={handleLogin} />;
  }
  return <DonasDashboard username={auth.username} onLogout={handleLogout} />;
}
