import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import { findTicket, permissionNeeds, stopNeeds } from '../src/providers/hook/claude/ticketInfo.js';

describe('ticketInfo', () => {
  it('saca ticket y titulo del primer mensaje de la sesion', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-')), 's.jsonl');
    const prompt = '/ticket .tickets/2026-11-08-abc - TK-8 Impresora no imprime';
    fs.writeFileSync(file, JSON.stringify({ type: 'user', message: { content: prompt } }) + '\n');
    expect(findTicket('s1', file)).toEqual({ ticket: 'TK-8', ticketTitle: 'Impresora no imprime' });
  });

  it('sin ticket devuelve undefined', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tk-')), 's.jsonl');
    fs.writeFileSync(file, JSON.stringify({ type: 'user', message: { content: 'hola' } }) + '\n');
    expect(findTicket('s2', file)).toBeUndefined();
  });

  it('describe el permiso y el final del mensaje', () => {
    expect(permissionNeeds({ tool_name: 'Bash', tool_input: { command: 'npm test' } })).toBe(
      'Permiso: Bash: npm test',
    );
    expect(stopNeeds({ last_assistant_message: 'Hecho.\n¿Aplico la migración?' })).toContain(
      '¿Aplico la migración?',
    );
  });
});
