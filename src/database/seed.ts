import { categoryColors, incomeSourceColors, investmentColors } from '@/theme/colors';
import { atDay } from '@/utils/date';

import type { SQLiteDatabase } from 'expo-sqlite';

type SeedRow = { count: number };

/**
 * Dados de referência que o app espera existir: as categorias de exemplo do
 * enunciado e os tipos de investimento. Sem isso o primeiro lançamento
 * aconteceria contra uma lista vazia.
 *
 * Só roda quando a tabela está realmente vazia — nunca sobrescreve o que o
 * usuário já configurou.
 */
export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();

  const categoryCount = await db.getFirstAsync<SeedRow>('SELECT COUNT(*) AS count FROM categories');
  if (!categoryCount?.count) {
    const fixed = [
      { name: 'Aluguel', icon: 'house' },
      { name: 'Parcela do apartamento', icon: 'building' },
      { name: 'Energia', icon: 'zap' },
      { name: 'Internet', icon: 'wifi' },
      { name: 'Celular', icon: 'smartphone' },
      { name: 'Escola', icon: 'graduationCap' },
      { name: 'Plano de saúde', icon: 'heartPulse' },
      { name: 'Seguro', icon: 'shield' },
      { name: 'Mensalidade', icon: 'creditCard' },
      { name: 'Financiamento', icon: 'banknote' },
    ];
    const variable = [
      { name: 'Supermercado', icon: 'shoppingCart' },
      { name: 'Padaria', icon: 'croissant' },
      { name: 'Feira', icon: 'carrot' },
      { name: 'Açougue', icon: 'beef' },
      { name: 'Lanches', icon: 'utensils' },
      { name: 'Lazer', icon: 'ticket' },
      { name: 'Restaurante', icon: 'utensilsCrossed' },
      { name: 'Transporte', icon: 'bus' },
      { name: 'Combustível', icon: 'fuel' },
      { name: 'Farmácia', icon: 'pill' },
      { name: 'Vestuário', icon: 'shirt' },
      { name: 'Cuidado pessoal', icon: 'scissors' },
    ];

    for (const [index, item] of fixed.entries()) {
      await db.runAsync(
        'INSERT INTO categories (name, color, icon, kind, archived, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        item.name,
        categoryColors[index % categoryColors.length],
        item.icon,
        'fixed',
        now
      );
    }
    for (const [index, item] of variable.entries()) {
      await db.runAsync(
        'INSERT INTO categories (name, color, icon, kind, archived, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        item.name,
        categoryColors[(index + 4) % categoryColors.length],
        item.icon,
        'variable',
        now
      );
    }
  }

  const typeCount = await db.getFirstAsync<SeedRow>('SELECT COUNT(*) AS count FROM investment_types');
  if (!typeCount?.count) {
    const types = [
      { name: 'Poupança', icon: 'piggyBank', color: investmentColors[0] },
      { name: 'CDB', icon: 'landmark', color: investmentColors[1] },
      { name: 'Tesouro', icon: 'shieldCheck', color: investmentColors[2] },
      { name: 'Ações', icon: 'trendingUp', color: investmentColors[3] },
      { name: 'Cripto', icon: 'bitcoin', color: investmentColors[4] },
      { name: 'FIIs', icon: 'building', color: investmentColors[5] },
      { name: 'Previdência', icon: 'umbrella', color: investmentColors[6] },
    ];
    for (const item of types) {
      await db.runAsync(
        'INSERT INTO investment_types (name, color, icon, archived, created_at) VALUES (?, ?, ?, 0, ?)',
        item.name,
        item.color,
        item.icon,
        now
      );
    }
  }
}

/**
 * Fontes de renda de exemplo coerentes com o caso de uso descrito: dois
 * salários em dias diferentes do mesmo mês.
 */
export async function seedDefaultIncomeSources(db: SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<SeedRow>('SELECT COUNT(*) AS count FROM income_sources');
  if (count?.count) return;

  const now = new Date();
  const sources = [
    { name: 'Salário dia 5', icon: 'briefcase', day: 5, color: incomeSourceColors[0] },
    { name: 'Salário dia 20', icon: 'briefcaseBusiness', day: 20, color: incomeSourceColors[1] },
    { name: 'Extra', icon: 'sparkles', day: null, color: incomeSourceColors[2] },
  ];

  for (const source of sources) {
    await db.runAsync(
      `INSERT INTO income_sources (name, color, icon, recurrence, day_of_month, expected_cents, archived, created_at)
       VALUES (?, ?, ?, 'monthly_day', ?, 0, 0, ?)`,
      source.name,
      source.color,
      source.icon,
      source.day,
      atDay(now.getFullYear(), now.getMonth(), source.day ?? 1)
    );
  }
}
