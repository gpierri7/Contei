let counter = 0;

/**
 * Identificador curto para agrupar parcelas. Não precisa ser criptográfico:
 * só precisa nunca colidir dentro do mesmo dispositivo.
 */
export function shortId(prefix = 'id'): string {
  counter += 1;
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${counter.toString(36)}${rand}`;
}


export function generateId(prefix = 'id'): string {
  return shortId(prefix);
}
