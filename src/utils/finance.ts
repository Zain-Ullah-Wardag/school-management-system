export type FinanceKind = 'income' | 'expense';

export const financeSectionLabel: Record<FinanceKind, string> = {
  income: 'Income',
  expense: 'Expense'
};

export function financeActionLabel(kind: FinanceKind) {
  return kind === 'expense' ? 'Add Expense' : 'Add Income';
}
