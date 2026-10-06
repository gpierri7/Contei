export const PAYMENT_METHODS = ['pix', 'debito', 'credito', 'dinheiro'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  dinheiro: 'Dinheiro',
};

export const PAYMENT_METHOD_SHORT: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  dinheiro: 'Dinheiro',
};

export const CATEGORY_KINDS = ['fixed', 'variable'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  fixed: 'Fixas',
  variable: 'Variáveis',
};

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  kind: CategoryKind;
  archived: number;
  created_at: number;
}

export interface IncomeSource {
  id: number;
  name: string;
  color: string;
  icon: string;
  /** 'monthly_day' repete todo mês no dia definido; 'oneoff' é avulso. */
  recurrence: 'monthly_day' | 'oneoff';
  day_of_month: number | null;
  expected_cents: number;
  archived: number;
  created_at: number;
}

export interface Income {
  id: number;
  source_id: number;
  amount_cents: number;
  date: number;
  description: string | null;
  method: PaymentMethod;
  created_at: number;
}

export interface FixedExpense {
  id: number;
  category_id: number;
  amount_cents: number;
  due_day: number;
  method: PaymentMethod;
  income_source_id: number | null;
  description: string | null;
  archived: number;
  created_at: number;
}

export interface FixedPayment {
  fixed_id: number;
  month_key: string;
  is_paid: number;
  paid_at: number | null;
}

export interface VariableExpense {
  id: number;
  category_id: number;
  amount_cents: number;
  date: number;
  method: PaymentMethod;
  description: string | null;
  is_paid: number;
  paid_at: number | null;
  receipt_uri: string | null;
  receipt_ocr_text: string | null;
  created_at: number;
}

export interface Installment {
  id: number;
  group_id: number;
  total_count: number;
  current_number: number;
  amount_cents: number;
  due_date: number;
  category_id: number;
  method: PaymentMethod;
  description: string | null;
  income_source_id: number | null;
  is_paid: number;
  paid_at: number | null;
  created_at: number;
}

export interface InvestmentType {
  id: number;
  name: string;
  color: string;
  icon: string;
  archived: number;
  created_at: number;
}

export interface Investment {
  id: number;
  name: string;
  type_id: number;
  note: string | null;
  archived: number;
  created_at: number;
}

export interface InvestmentMovement {
  id: number;
  investment_id: number;
  kind: 'aporte' | 'resgate';
  amount_cents: number;
  date: number;
  note: string | null;
  created_at: number;
}

export interface Goal {
  id: number;
  name: string;
  target_cents: number;
  deadline: number | null;
  color: string;
  icon: string;
  archived: number;
  created_at: number;
}

export interface GoalDeposit {
  id: number;
  goal_id: number;
  amount_cents: number;
  date: number;
  note: string | null;
  created_at: number;
}

export type ScheduledRecurrence = 'once' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface ScheduledExpense {
  id: number;
  name: string;
  amount_cents: number;
  category_id: number;
  method: PaymentMethod;
  billing_date: number;
  recurrence: ScheduledRecurrence;
  recurrence_interval: number;
  reminder_days: number;
  reminder_hour: number;
  reminder_minute: number;
  auto_launch: number;
  linked_salary_source_id?: number | null;
  ends_at?: number | null;
  total_occurrences?: number | null;
  occurrences_created: number;
  next_billing_date: number;
  paused: number;
  archived: number;
  created_at: number;
  updated_at: number;
}

export interface ScheduledNotification {
  id: number;
  scheduled_id: number;
  notification_id: number;
  scheduled_for: number;
  month_key?: string | null;
  occurrence_index?: number | null;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  created_at: number;
}

export type SettingValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | null;
