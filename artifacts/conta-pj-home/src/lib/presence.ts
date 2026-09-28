import { useEffect, useState } from 'react';

// Presença em tempo real (Online/Offline) via WebSocket nativo do backend
// (FastAPI, porta 8001, rota /api/presence/ws). O estado vive no servidor e é
// empurrado para o painel na hora. Aqui só temos os clientes leves.

const SESSION_ID_KEY = 'demo-flow-session-id';

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/presence/ws`;
}

// Online enquanto a ABA do site estiver visível (à frente na sua janela).
// visibilityState fica 'hidden' ao trocar de aba, minimizar a janela ou fechar
// — cobrindo os casos de ausência de forma confiável. Não usamos document.hasFocus()
// de propósito: apenas mudar o foco para OUTRA janela (ex.: o próprio painel do
// operador) NÃO deve derrubar a presença enquanto a aba do site segue visível.
function computeVisible(): boolean {
  try {
    return document.visibilityState === 'visible';
  } catch {
    return true;
  }
}

function readSessionId(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Cliente de presença da página do usuário (PF e PJ). Deve ser montado uma vez
 * na raiz do app para sobreviver às trocas de rota do SPA.
 */
export function PresenceClient(): null {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let hbTimer: number | undefined;
    let stopped = false;
    let connecting = false;

    const send = (obj: unknown) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(obj));
        } catch {
          /* ignore */
        }
      }
    };

    const connect = () => {
      if (stopped || connecting || ws) return;
      const sid = readSessionId();
      if (!sid) return; // aguarda o fluxo iniciar (sessionId criado no 1º passo)
      connecting = true;
      const sock = new WebSocket(wsUrl());
      ws = sock;
      sock.onopen = () => {
        connecting = false;
        send({ role: 'session', sessionId: sid, visible: computeVisible() });
        hbTimer = window.setInterval(
          () => send({ t: 'hb', visible: computeVisible() }),
          3000,
        );
      };
      sock.onclose = () => {
        connecting = false;
        if (hbTimer) window.clearInterval(hbTimer);
        ws = null; // o tick abaixo reconecta em até 1s
      };
      sock.onerror = () => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      };
    };

    const sendVis = () => send({ t: 'vis', visible: computeVisible() });
    const onBye = () => {
      send({ t: 'bye' });
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };

    document.addEventListener('visibilitychange', sendVis);
    window.addEventListener('pageshow', sendVis);
    window.addEventListener('online', sendVis);
    window.addEventListener('offline', sendVis);
    window.addEventListener('pagehide', onBye);
    window.addEventListener('beforeunload', onBye);

    connect();
    const tick = window.setInterval(connect, 1000);

    return () => {
      stopped = true;
      window.clearInterval(tick);
      if (hbTimer) window.clearInterval(hbTimer);
      document.removeEventListener('visibilitychange', sendVis);
      window.removeEventListener('pageshow', sendVis);
      window.removeEventListener('online', sendVis);
      window.removeEventListener('offline', sendVis);
      window.removeEventListener('pagehide', onBye);
      window.removeEventListener('beforeunload', onBye);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}

/**
 * Hook do painel admin: retorna um mapa sessionId -> online, atualizado em
 * tempo real pelo hub de presença. Reconecta sozinho.
 */
export function useAdminPresence(): {
  online: Record<string, boolean>;
  lastSeen: Record<string, number>;
} {
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let connecting = false;

    const connect = () => {
      if (stopped || connecting || ws) return;
      connecting = true;
      const sock = new WebSocket(wsUrl());
      ws = sock;
      sock.onopen = () => {
        connecting = false;
        try {
          sock.send(JSON.stringify({ role: 'admin' }));
        } catch {
          /* ignore */
        }
      };
      sock.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.t === 'snapshot') {
            setOnline(m.online || {});
            setLastSeen(m.lastSeen || {});
          } else if (m.t === 'presence') {
            setOnline((prev) => ({ ...prev, [m.sessionId]: !!m.online }));
            if (m.lastSeen) {
              setLastSeen((prev) => ({ ...prev, [m.sessionId]: m.lastSeen }));
            }
          }
        } catch {
          /* ignore */
        }
      };
      sock.onclose = () => {
        connecting = false;
        ws = null;
      };
      sock.onerror = () => {
        try {
          sock.close();
        } catch {
          /* ignore */
        }
      };
    };

    connect();
    const tick = window.setInterval(connect, 2000);

    return () => {
      stopped = true;
      window.clearInterval(tick);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { online, lastSeen };
}
