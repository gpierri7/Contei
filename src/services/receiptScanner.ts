import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Directory, File, Paths } from 'expo-file-system';

import type { Category, PaymentMethod } from '@/database/types';

export type ParsedReceipt = {
  amountCents: number;
  merchant: string;
  date: number;
  method: PaymentMethod;
  text: string;
};

const categoryRules: { keywords: string[]; categoryNames: string[] }[] = [
  { keywords: ['SUPERMERCADO', 'MERCADO', 'ATACADAO', 'ASSAI', 'CARREFOUR', 'HORTIFRUTI', 'EXTRA HIPER'], categoryNames: ['supermercado', 'mercado'] },
  { keywords: ['PADARIA', 'PANIFICADORA', 'PANIFICIO'], categoryNames: ['padaria'] },
  { keywords: ['FEIRA', 'SACOLAO', 'HORTA', 'FRUTARIA'], categoryNames: ['feira'] },
  { keywords: ['ACOUGUE', 'CASA DE CARNES', 'FRIGORIFICO'], categoryNames: ['acougue'] },
  { keywords: ['RESTAURANTE', 'PIZZARIA', 'CHURRASCARIA', 'LANCHONETE', 'IFOOD', 'BURGER', 'HAMBURGUERIA'], categoryNames: ['restaurante', 'lanches'] },
  { keywords: ['CINEMA', 'TEATRO', 'PARQUE', 'INGRESSO', 'BOLICHE'], categoryNames: ['lazer'] },
  { keywords: ['UBER', '99APP', 'TAXI', 'METRO', 'ONIBUS', 'ESTACIONAMENTO'], categoryNames: ['transporte'] },
  { keywords: ['POSTO', 'COMBUSTIVEL', 'GASOLINA', 'ETANOL', 'IPIRANGA', 'SHELL', 'PETROBRAS'], categoryNames: ['combustivel'] },
  { keywords: ['FARMACIA', 'DROGARIA', 'DROGASIL', 'DROGA RAIA', 'PAGUE MENOS', 'PACHECO'], categoryNames: ['farmacia'] },
  { keywords: ['VESTUARIO', 'ROUPAS', 'CALCADOS', 'SAPATARIA'], categoryNames: ['vestuario'] },
  { keywords: ['BARBEARIA', 'SALAO DE BELEZA', 'CABELEREIRO', 'COSMETICOS'], categoryNames: ['cuidado pessoal'] },
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function normalizeOcrLine(value: string): string {
  return normalize(value)
    .replace(/\bT0TAL\b/g, 'TOTAL')
    .replace(/\bT0TA1\b/g, 'TOTAL')
    .replace(/\bVA10R\b/g, 'VALOR');
}

function parseMoney(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(/[OoQq]/g, '0').replace(/[Il|]/g, '1');
  let reais: number;

  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(normalized)) {
    reais = Number(normalized.replace(/\./g, '').replace(',', '.'));
  } else if (/^\d+,\d{2}$/.test(normalized)) {
    reais = Number(normalized.replace(',', '.'));
  } else if (/^\d+\.\d{2}$/.test(normalized)) {
    reais = Number(normalized);
  } else {
    return null;
  }

  const cents = Math.round(reais * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function findAmount(lines: string[]): number | null {
  const amounts = /(?:R\$\s*)?((?:[\dOoQqIl|]{1,3}(?:\.[\dOoQqIl|]{3})+|[\dOoQqIl|]+)[,.][\dOoQqIl|]{2})/g;
  const excluded = /\b(SUBTOTAL|TROCO|DESCONTO|ECONOMIA|VALOR RECEBIDO|PARCELA|UNITARIO|UNIT|TOTAL DOS PRODUTOS|TOTAL DE ITENS)\b/;
  const candidates: { amount: number; priority: number }[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeOcrLine(lines[index]);
    if (excluded.test(line)) continue;
    const nextLine = normalizeOcrLine(lines[index + 1] ?? '');
    const label = `${line} ${nextLine}`;
    const hasPayableLabel = /\b(VALOR\s+A\s+PAGAR|TOTAL\s+A\s+PAGAR|VALOR\s+DEVIDO|TOTAL\s+DEVIDO)\b/.test(label);
    const hasTotalLabel = /\b(VALOR\s+TOTAL|TOTAL\s+GERAL|TOTAL\s+DA\s+NOTA|TOTAL\s+NOTA|TOTAL)\b/.test(line);
    const hasPaidLabel = /\bVALOR\s+PAGO\b/.test(line);
    const priority = hasPayableLabel ? 4 : hasTotalLabel ? 3 : hasPaidLabel ? 2 : 0;
    if (priority === 0) continue;

    const currentAmounts = [...lines[index].matchAll(amounts)];
    const matches = currentAmounts.length
      ? currentAmounts
      : [...(lines[index + 1] ?? '').matchAll(amounts)];
    for (const match of matches) {
      const amount = parseMoney(match[1]);
      if (amount !== null) candidates.push({ amount, priority });
    }
  }

  if (!candidates.length) return null;
  const bestPriority = Math.max(...candidates.map((candidate) => candidate.priority));
  const bestAmounts = new Set(
    candidates.filter((candidate) => candidate.priority === bestPriority).map((candidate) => candidate.amount)
  );
  return bestAmounts.size === 1 ? [...bestAmounts][0] : null;
}

function findMerchant(lines: string[]): string | null {
  const excluded = /\b(CNPJ|CPF|INSCRICAO|DOCUMENTO AUXILIAR|NOTA FISCAL|CUPOM FISCAL|CHAVE DE ACESSO|CONSUMIDOR|CONSULTA|PROCON|DANFE|RUA|AVENIDA|BAIRRO|CEP|PROTOCOLO|AUTORIZACAO|SERIE|SAT|NFC.?E|EMITIDA|EMITIDO|IMPRESSAO|FISCAL|OPERADOR|CAIXA|PEDIDO|VENDA AO CONSUMIDOR)\b/;
  const businessTerms = /\b(MERCADO|SUPERMERCADO|PADARIA|PANIFICADORA|RESTAURANTE|LANCHONETE|FARMACIA|DROGARIA|POSTO|ACOUGUE|COMERCIO|LOJA|LTDA|ME|EPP|S\.?A\.?)\b/;
  const candidates: { value: string; score: number; index: number }[] = [];

  for (const [index, line] of lines.slice(0, 12).entries()) {
    const candidate = line
      .replace(/^\s*(?:NOME\s+FANTASIA|RAZ[AÃ]O\s+SOCIAL|EMITENTE)\s*[:\-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const normalized = normalizeOcrLine(candidate);
    if (candidate.length < 3 || !/[A-ZÀ-Ý]/i.test(candidate) || excluded.test(normalized)) continue;
    if (/^[\d\s./:-]+$/.test(candidate)) continue;
    if (/\b\d{2,}\b/.test(candidate) && !businessTerms.test(normalized)) continue;
    if (candidate.length > 80) continue;

    const letters = candidate.match(/[A-ZÀ-Ý]/gi)?.length ?? 0;
    const uppercase = candidate.match(/[A-ZÀ-Ý]/g)?.length ?? 0;
    const uppercaseRatio = letters ? uppercase / letters : 0;
    const score =
      (index === 0 ? 3 : 0) +
      (businessTerms.test(normalized) ? 4 : 0) +
      (uppercaseRatio > 0.7 ? 2 : 0) +
      (candidate.length >= 5 && candidate.length <= 45 ? 1 : 0) -
      (candidate.length > 60 ? 2 : 0);
    candidates.push({ value: candidate, score, index });
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const first = candidates[0];
  const second = candidates[1];
  if (!first || (second && first.score === second.score && normalize(first.value) !== normalize(second.value))) {
    return null;
  }
  return first.value.slice(0, 80);
}

function findDate(lines: string[]): number | null {
  for (const line of lines) {
    const match = line.match(/\b([0-3]?\d)[/.-]([01]?\d)[/.-](20\d{2}|\d{2})\b/);
    if (!match) continue;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const date = new Date(year, month - 1, day, 12);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date.getTime();
    }
  }

  return null;
}

function findPaymentMethod(text: string): PaymentMethod {
  const normalized = normalize(text);
  if (/\bPIX\b/.test(normalized)) return 'pix';
  if (/\bCARTAO\s+DEBITO\b|\bDEBITO\b/.test(normalized)) return 'debito';
  if (/\bCARTAO\s+CREDITO\b|\bCREDITO\b/.test(normalized)) return 'credito';
  if (/\bDINHEIRO\b/.test(normalized)) return 'dinheiro';
  return 'pix';
}

export function parseReceiptText(text: string): ParsedReceipt | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const amountCents = findAmount(lines);
  const merchant = findMerchant(lines);
  if (amountCents === null || merchant === null) return null;

  return {
    amountCents,
    merchant,
    date: findDate(lines) ?? Date.now(),
    method: findPaymentMethod(text),
    text,
  };
}

export async function scanReceipt(uri: string): Promise<ParsedReceipt | null> {
  try {
    const result = await TextRecognition.recognize(uri);
    return parseReceiptText(result.text);
  } catch (error) {
    if (error instanceof Error && error.message.includes("doesn't seem to be linked")) {
      throw new Error(
        'O leitor da nota fiscal ainda não está instalado nesta build do app. Instale uma nova build Android ou iOS para usar o OCR.'
      );
    }
    throw error;
  }
}

export function selectReceiptCategory(text: string, categories: Category[]): Category | null {
  const lines = text.split(/\r?\n/).map((line) => normalize(line)).filter(Boolean);
  const merchantText = lines.slice(0, 6).join(' ').replace(/\bMERCADO\s+PAGO\b/g, '');
  const fullText = lines.join(' ').replace(/\bMERCADO\s+PAGO\b/g, '');
  const scores = new Map<number, number>();

  for (const rule of categoryRules) {
    const merchantHits = rule.keywords.filter((keyword) => merchantText.includes(keyword)).length;
    const textHits = rule.keywords.filter((keyword) => fullText.includes(keyword)).length;
    const category = categories.find((item) =>
      rule.categoryNames.includes(normalize(item.name).toLowerCase())
    );
    if (!category || (!merchantHits && !textHits)) continue;
    scores.set(category.id, Math.max(scores.get(category.id) ?? 0, merchantHits * 3 + textHits));
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  if (ranked.length) return categories.find((category) => category.id === ranked[0][0]) ?? null;

  return categories.find((item) => normalize(item.name).includes('OUTROS')) ?? null;
}

export function keepReceiptImage(uri: string, fileName?: string | null): string {
  const extension = fileName?.match(/\.(jpe?g|png|heic|webp)$/i)?.[0] ?? '.jpg';
  const directory = new Directory(Paths.document, 'receipts');
  if (!directory.exists) directory.create();

  const destination = new File(directory, `receipt-${Date.now()}${extension}`);
  new File(uri).copy(destination);
  return destination.uri;
}
