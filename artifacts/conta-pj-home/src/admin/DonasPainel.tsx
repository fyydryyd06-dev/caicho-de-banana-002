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

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
};

interface AccessItem {
  id: string;
  route: string;
  ip: string | null;
  browser: string | null;
  deviceType: string | null;
  os: string | null;
  language: string | null;
  timezone: string | null;
  screen: string | null;
  referrer: string | null;
  userAgent: string | null;
  location: string | null;
  createdAt: string;
}
interface Stats {
  total: number;
  today: number;
  lastHour: number;
  last7days: number;
  byHour: { hour: string; count: number }[];
  topRoutes: { route: string; count: number }[];
  recent: AccessItem[];
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
};

function AccessDetailModal({ item, onClose }: { item: AccessItem; onClose: () => void }) {
  return (
    <div className="donas-modal-backdrop" onClick={onClose} data-testid="access-detail-modal">
      <div className="donas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="donas-modal-head">
          <h3>● Detalhes do acesso</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" data-testid="access-detail-close">×</button>
        </div>
        <dl className="donas-modal-body">
          <div><dt>Rota</dt><dd>{item.route}</dd></div>
          <div><dt>Quando</dt><dd>{new Date(item.createdAt).toLocaleString('pt-BR')}</dd></div>
          <div><dt>IP</dt><dd>{item.ip ?? '-'}</dd></div>
          <div><dt>Local (aprox.)</dt><dd>{item.location ?? '-'}</dd></div>
          <div><dt>Navegador</dt><dd>{item.browser ?? '-'}</dd></div>
          <div><dt>Dispositivo</dt><dd>{item.deviceType ?? '-'}</dd></div>
          <div><dt>Sistema</dt><dd>{item.os ?? '-'}</dd></div>
          <div><dt>User-Agent</dt><dd className="donas-ua">{item.userAgent ?? '-'}</dd></div>
          <div><dt>Tela</dt><dd>{item.screen ?? '-'}</dd></div>
          <div><dt>Idioma</dt><dd>{item.language ?? '-'}</dd></div>
          <div><dt>Fuso</dt><dd>{item.timezone ?? '-'}</dd></div>
          <div><dt>Referrer</dt><dd>{item.referrer || '(direto)'}</dd></div>
        </dl>
        <div className="donas-modal-foot">
          <button type="button" className="donas-mini-btn" onClick={() => navigator.clipboard?.writeText(JSON.stringify(item, null, 2))}>Copiar JSON</button>
          <button type="button" className="donas-submit donas-submit--sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ onOpen }: { onOpen: (a: AccessItem) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/access/stats', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setStats(d); })
      .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const max = Math.max(1, ...(stats?.byHour.map((b) => b.count) ?? [1]));
  const topMax = Math.max(1, ...(stats?.topRoutes.map((t) => t.count) ?? [1]));
  return (
    <div className="donas-dash" data-testid="dash-view">
      <div className="donas-cards">
        {[
          { l: 'TOTAL DE ACESSOS', v: stats?.total, s: 'All-time' },
          { l: 'HOJE', v: stats?.today, s: 'Ao vivo' },
          { l: 'ÚLTIMA HORA', v: stats?.lastHour, s: '60 min' },
          { l: 'ÚLTIMOS 7 DIAS', v: stats?.last7days, s: 'Semana' },
        ].map((c) => (
          <div className="donas-card-stat" key={c.l}>
            <span className="donas-card-label">{c.l}</span>
            <strong data-testid={`stat-${c.l}`}>{c.v ?? '—'}</strong>
            <small>{c.s}</small>
          </div>
        ))}
      </div>
      <div className="donas-panels">
        <div className="donas-block">
          <h3>Tráfego nas últimas 24h</h3>
          <div className="donas-bars">
            {(stats?.byHour ?? []).map((b, i) => (
              <div className="donas-bar-col" key={i} title={`${b.hour}: ${b.count}`}>
                <div className="donas-bar" style={{ height: `${(b.count / max) * 100}%` }} />
                <span>{b.hour}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="donas-block">
          <h3>Páginas mais acessadas</h3>
          <ul className="donas-top">
            {(stats?.topRoutes ?? []).map((t) => (
              <li key={t.route}>
                <span className="donas-top-route">{t.route}</span>
                <span className="donas-top-bar"><i style={{ width: `${(t.count / topMax) * 100}%` }} /></span>
                <span className="donas-top-count">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="donas-block">
        <h3>Acessos recentes <small>clique para ver detalhes</small></h3>
        <ul className="donas-recent">
          {(stats?.recent ?? []).map((a) => (
            <li key={a.id} onClick={() => onOpen(a)} data-testid="recent-row">
              <span className="donas-recent-route">{a.route}</span>
              <span className="donas-recent-meta">{a.browser} · {a.ip} · {timeAgo(a.createdAt)}</span>
              <span className="donas-tag">{a.location}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AcessosView({ onOpen }: { onOpen: (a: AccessItem) => void }) {
  const [items, setItems] = useState<AccessItem[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/access/list?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setItems(d.items); })
      .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [q]);
  const exportCsv = async () => {
    const r = await fetch('/api/access/export', { headers: authHeaders() });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'acessos.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="donas-acessos" data-testid="acessos-view">
      <div className="donas-toolbar">
        <input
          className="donas-search"
          placeholder="Buscar IP, rota, navegador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="acessos-search"
        />
        <button type="button" className="donas-mini-btn" onClick={exportCsv} data-testid="acessos-export">Exportar CSV</button>
      </div>
      <div className="donas-table-wrap">
        <table className="donas-table">
          <thead>
            <tr><th>#</th><th>Rota</th><th>IP</th><th>Navegador</th><th>Dispositivo</th><th>Idioma</th><th>Fuso</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={a.id} onClick={() => onOpen(a)} data-testid="acessos-row">
                <td>{i + 1}</td><td>{a.route}</td><td>{a.ip}</td><td>{a.browser}</td>
                <td>{a.deviceType}</td><td>{a.language}</td><td>{a.timezone}</td><td>{timeAgo(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DonasDashboard({ username, onLogout }: { username: string; onLogout: () => void }) {
  const [active, setActive] = useState<(typeof MENU)[number]['key']>('dashboard');
  const [detail, setDetail] = useState<AccessItem | null>(null);
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
          <span className="donas-live">● Ao vivo · atualizando a cada 5s</span>
          <span className="donas-user"><User size={15} />{username}</span>
        </header>
        <section className="donas-content">
          {active === 'dashboard' && <DashboardView onOpen={setDetail} />}
          {active === 'acessos' && <AcessosView onOpen={setDetail} />}
          {active !== 'dashboard' && active !== 'acessos' && (
            <div className="donas-empty">
              <current.icon size={30} />
              <h2>{current.label}</h2>
              <p>Estrutura inicial. Esta seção será implementada nas próximas etapas.</p>
            </div>
          )}
        </section>
      </main>
      {detail && <AccessDetailModal item={detail} onClose={() => setDetail(null)} />}
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
