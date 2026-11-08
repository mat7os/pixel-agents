/**
 * Ajustes personales (OrderManager). Cambia aquí cómo se reconoce el ticket
 * y qué texto se enseña en la etiqueta de cada agente.
 */

/** Ticket en el primer mensaje de la sesión. `npm run tickets:claude` lanza
 *  `/ticket .tickets/<carpeta> - TK-8 Título`: grupo 1 = número, grupo 2 = título. */
export const TICKET_PATTERN = /\b(TK-\d+)\b[\s:\-–]*([^\n<]*)/;

/** Bytes del inicio del transcript donde se busca el ticket. */
export const TICKET_SCAN_BYTES = 256 * 1024;

/** Longitud máxima de cada línea de la etiqueta. */
export const TICKET_TITLE_MAX = 200;
/** El texto completo se guarda (se abre al hacer clic); la etiqueta lo recorta con «…». */
export const NEEDS_MAX = 1500;
