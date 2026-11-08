import * as fs from 'fs';

import type { AgentInfo } from '../../../../../core/src/provider.js';
import { NEEDS_MAX, TICKET_PATTERN, TICKET_SCAN_BYTES, TICKET_TITLE_MAX } from './personal.js';

const cut = (s: string, max: number): string => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

/** Ticket por sesión. Solo se cachea al encontrarlo; los fallos se reintentan pocas veces. */
const ticketCache = new Map<string, { ticket: string; ticketTitle?: string }>();
const misses = new Map<string, number>();
const MAX_MISSES = 5;

/** Texto plano de un mensaje de usuario (ignora tool_result). */
function userText(entry: unknown): string {
  const msg = (entry as { type?: string; message?: { content?: unknown } } | null)?.message;
  if ((entry as { type?: string } | null)?.type !== 'user' || !msg) return '';
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c
    .map((b) =>
      b && typeof b === 'object' && (b as { type?: string }).type === 'text'
        ? String((b as { text?: unknown }).text ?? '')
        : '',
    )
    .join('\n');
}

/** Busca el ticket en los primeros mensajes de usuario del transcript. */
export function findTicket(
  sessionId: string,
  transcriptPath: string | undefined,
): { ticket: string; ticketTitle?: string } | undefined {
  const hit = ticketCache.get(sessionId);
  if (hit) return hit;
  if (!transcriptPath || (misses.get(sessionId) ?? 0) >= MAX_MISSES) return undefined;
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const buf = Buffer.alloc(TICKET_SCAN_BYTES);
      const n = fs.readSync(fd, buf, 0, TICKET_SCAN_BYTES, 0);
      for (const line of buf.toString('utf8', 0, n).split('\n')) {
        if (!line.includes('"user"')) continue;
        let entry: unknown;
        try {
          entry = JSON.parse(line);
        } catch {
          continue; // última línea cortada por el límite de lectura
        }
        const m = TICKET_PATTERN.exec(userText(entry));
        if (m) {
          const found = {
            ticket: m[1],
            ticketTitle: m[2] ? cut(m[2], TICKET_TITLE_MAX) : undefined,
          };
          ticketCache.set(sessionId, found);
          return found;
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    // transcript aún sin crear
  }
  misses.set(sessionId, (misses.get(sessionId) ?? 0) + 1);
  return undefined;
}

/** Qué pide el agente en un permiso: herramienta + comando o archivo. */
export function permissionNeeds(raw: Record<string, unknown>): string {
  const tool = typeof raw.tool_name === 'string' ? raw.tool_name : '';
  const input = (
    typeof raw.tool_input === 'object' && raw.tool_input ? raw.tool_input : {}
  ) as Record<string, unknown>;
  const detail = [input.command, input.file_path, input.url, input.pattern].find(
    (v) => typeof v === 'string',
  ) as string | undefined;
  const msg = typeof raw.message === 'string' ? raw.message : '';
  const what = tool ? `${tool}${detail ? `: ${detail}` : ''}` : msg;
  return `Permiso: ${what || 'aprobar acción'}`.trim().slice(0, NEEDS_MAX);
}

/** Primera línea útil del último mensaje del agente al parar. */
export function stopNeeds(raw: Record<string, unknown>): string | undefined {
  const text =
    typeof raw.last_assistant_message === 'string'
      ? raw.last_assistant_message
      : typeof raw.message === 'string'
        ? raw.message
        : '';
  const t = text.trim();
  return t ? t.slice(-NEEDS_MAX) : undefined; // el final del mensaje suele ser la pregunta
}

export function buildInfo(raw: Record<string, unknown>, eventKind: string): AgentInfo | undefined {
  const sessionId = typeof raw.session_id === 'string' ? raw.session_id : '';
  const transcript = typeof raw.transcript_path === 'string' ? raw.transcript_path : undefined;
  const t = sessionId ? findTicket(sessionId, transcript) : undefined;
  const info: AgentInfo = { ...t };
  if (eventKind === 'permissionRequest') info.needs = permissionNeeds(raw);
  else if (eventKind === 'turnEnd') info.needs = stopNeeds(raw);
  return info.ticket || info.needs || eventKind === 'toolStart' || eventKind === 'turnEnd'
    ? info
    : undefined;
}
