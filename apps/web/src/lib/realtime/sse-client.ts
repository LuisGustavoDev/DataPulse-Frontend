import { BATCH_EVENT_TYPES, BatchEvent, ReadyEvent, RealtimeTicket, SSE_RECONNECT_DELAYS_MS } from "@datapulse/contracts";
import { apiFetch } from "@/lib/api/client";

// Protocolo do §9.4. O ticket é de uso único, então a reconexão automática do
// EventSource falharia: o cliente fecha no primeiro erro, pede ticket novo e reabre
// com last_event_id, com backoff de 1 s, 2 s, 5 s e 10 s.

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

type Handlers = {
  onEvent: (event: BatchEvent) => void;
  /** `ready` (conexão sem last_event_id) ou `resync` (id saiu do stream): refazer snapshot. */
  onResync: () => void;
  onStateChange: (state: ConnectionState) => void;
};

export function reconnectDelay(attempt: number): number {
  return SSE_RECONNECT_DELAYS_MS[Math.min(attempt, SSE_RECONNECT_DELAYS_MS.length - 1)] ?? 10_000;
}

export function createSseClient(handlers: Handlers) {
  let source: EventSource | null = null;
  let lastEventId: string | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  async function connect() {
    if (stopped) return;
    handlers.onStateChange(attempt === 0 ? "connecting" : "reconnecting");

    let ticket: RealtimeTicket;
    try {
      ticket = await apiFetch("/realtime/tickets", { method: "POST", schema: RealtimeTicket });
    } catch {
      scheduleReconnect();
      return;
    }
    if (stopped) return;

    const url = new URL(ticket.stream_url, window.location.origin);
    url.searchParams.set("ticket", ticket.ticket);
    if (lastEventId) url.searchParams.set("last_event_id", lastEventId);

    const es = new EventSource(url);
    source = es;

    es.onopen = () => {
      attempt = 0;
      handlers.onStateChange("open");
    };

    es.addEventListener("ready", (e) => {
      const parsed = ReadyEvent.safeParse(safeJson((e as MessageEvent<string>).data));
      if (parsed.success && parsed.data.last_event_id) lastEventId = parsed.data.last_event_id;
      handlers.onResync();
    });

    es.addEventListener("resync", () => {
      lastEventId = null;
      handlers.onResync();
    });

    for (const type of BATCH_EVENT_TYPES) {
      es.addEventListener(type, (e) => {
        const message = e as MessageEvent<string>;
        if (message.lastEventId) lastEventId = message.lastEventId;
        const parsed = BatchEvent.safeParse(safeJson(message.data));
        if (parsed.success) handlers.onEvent(parsed.data);
      });
    }

    es.onerror = () => {
      es.close();
      if (source === es) source = null;
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (stopped) return;
    handlers.onStateChange("reconnecting");
    const delay = reconnectDelay(attempt);
    attempt++;
    timer = setTimeout(connect, delay);
  }

  return {
    start() {
      stopped = false;
      void connect();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      source?.close();
      source = null;
      handlers.onStateChange("closed");
    },
  };
}

function safeJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}
