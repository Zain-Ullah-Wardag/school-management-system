import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { schoolApi } from '../../services/schoolApi';
import { queryKeys } from '../../services/queryKeys';
import { useMutationToast } from '../../hooks/useMutationToast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { DataTable } from '../common/DataTable';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Field, SelectInput, TextArea, TextInput } from '../common/FormFields';
import { Tabs } from '../common/Tabs';
import { money, todayInput } from '../../utils/format';
import { financeActionLabel, financeModalTitle, financeSectionLabel, type FinanceKind } from '../../utils/finance';
import { isFailedLoad, isInitialLoad } from '../../utils/queryDisplay';

type Kind = FinanceKind;
type EditorState = { kind: Kind; item: any };
type DeleteState = { kind: Kind; item: any };

const labels = financeSectionLabel;

export function FinancePanel() {
  const [kind, setKind] = useState<Kind>('income');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<EditorState>();
  const [remove, setRemove] = useState<DeleteState>();

  // Load exactly the active ledger. Each tab is backed by its own API endpoint,
  // so income rows can never be rendered in the expense history (or vice versa).
  const { data: entries, isPending: entriesPending } = useQuery({
    queryKey: queryKeys.finance.entries(kind, page),
    queryFn: () => kind === 'income'
      ? schoolApi.fees.income({ page, limit: 25 })
      : schoolApi.fees.expenses({ page, limit: 25 })
  });
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.finance.categories,
    queryFn: schoolApi.fees.categories
  });
  const { data: summary, isPending: summaryPending, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: queryKeys.finance.summary,
    queryFn: schoolApi.fees.financeSummary
  });
  const summaryLoading = isInitialLoad(summaryPending, summary);
  const summaryFailed = isFailedLoad(summaryError, summary);
  const entriesLoading = isInitialLoad(entriesPending, entries);

  const save = useMutationToast(
    ({ body, id, entryKind }: { body: object; id?: number; entryKind: Kind }) => entryKind === 'income'
      ? schoolApi.fees.saveIncome(body, id)
      : schoolApi.fees.saveExpense(body, id),
    {
      success: 'Financial entry saved',
      sync: ['finance'],
      onSuccess: () => setEditor(undefined)
    }
  );
  const deleteEntry = useMutationToast(
    ({ id, entryKind }: { id: number; entryKind: Kind }) => entryKind === 'income'
      ? schoolApi.fees.deleteIncome(id)
      : schoolApi.fees.deleteExpense(id),
    {
      success: 'Financial entry deleted',
      sync: ['finance'],
      onSuccess: () => setRemove(undefined)
    }
  );

  const activeLabel = labels[kind];
  const changeKind = (nextKind: string) => {
    setKind(nextKind as Kind);
    setPage(1);
    // The type is intentionally fixed when a modal opens, but close an open
    // dialog when changing ledgers so a user cannot edit/delete a different tab.
    setEditor(undefined);
    setRemove(undefined);
  };

  return <>
    <div className="grid gap-3 sm:grid-cols-4">
      <Metric label="Fee collection" value={summaryFailed ? 'Unavailable' : summaryLoading ? 'Loading…' : money(summary?.fee_collection)} />
      <Metric label="Other income" value={summaryFailed ? 'Unavailable' : summaryLoading ? 'Loading…' : money(summary?.other_income)} />
      <Metric label="Expenses" value={summaryFailed ? 'Unavailable' : summaryLoading ? 'Loading…' : money(summary?.expenses)} />
      <Metric label="Net income" value={summaryFailed ? 'Unavailable' : summaryLoading ? 'Loading…' : money(summary?.net_income)} />
    </div>
    {summaryFailed && <button type="button" className="mt-3 text-sm font-semibold text-brand-700" onClick={() => void refetchSummary()}>Retry finance totals</button>}

    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <Tabs
        tabs={[{ id: 'income', label: 'Other income' }, { id: 'expense', label: 'Expenses' }]}
        value={kind}
        onChange={changeKind}
      />
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ kind, item: {} })}>
        {financeActionLabel(kind)}
      </Button>
    </div>

    <div className="mt-4">
      <DataTable
        loading={entriesLoading}
        rows={entries?.data}
        pagination={entries?.pagination}
        onPage={setPage}
        emptyText={`No ${activeLabel.toLowerCase()} entries have been recorded.`}
        columns={kind === 'income'
          ? [
            { key: 'date', header: 'Date', render: (row: any) => row.income_date },
            { key: 'category', header: 'Category', render: (row: any) => row.category },
            { key: 'description', header: 'Description', render: (row: any) => row.description || '—' },
            { key: 'amount', header: 'Amount', render: (row: any) => <b className="text-brand-700">{money(row.amount)}</b> },
            actionColumn(kind, setEditor, setRemove)
          ]
          : [
            { key: 'date', header: 'Date', render: (row: any) => row.expense_date },
            { key: 'category', header: 'Category', render: (row: any) => row.category_name || 'Uncategorized' },
            { key: 'description', header: 'Description', render: (row: any) => row.description || '—' },
            { key: 'amount', header: 'Amount', render: (row: any) => <b className="text-rose-700">{money(row.amount)}</b> },
            actionColumn(kind, setEditor, setRemove)
          ]}
      />
    </div>

    <Modal
      open={Boolean(editor)}
      onClose={() => setEditor(undefined)}
      title={financeModalTitle(editor?.kind || kind, Boolean(editor?.item?.id))}
      size="md"
    >
      {editor && <FinanceForm
        kind={editor.kind}
        item={editor.item}
        categories={categories}
        onClose={() => setEditor(undefined)}
        saving={save.isPending}
        onSave={(body) => save.mutate({ entryKind: editor.kind, id: editor.item.id, body })}
      />}
    </Modal>

    <ConfirmDialog
      open={Boolean(remove)}
      onClose={() => setRemove(undefined)}
      onConfirm={() => remove && deleteEntry.mutate({ id: remove.item.id, entryKind: remove.kind })}
      loading={deleteEntry.isPending}
      title={`Delete ${remove ? labels[remove.kind] : activeLabel}`}
      description={`Delete this ${remove ? labels[remove.kind].toLowerCase() : activeLabel.toLowerCase()} entry? This action cannot be undone.`}
      confirmLabel={`Delete ${remove ? labels[remove.kind] : activeLabel}`}
    />
  </>;
}

function actionColumn(kind: Kind, setEditor: (value: EditorState) => void, setRemove: (value: DeleteState) => void) {
  return {
    key: 'actions',
    header: '',
    className: 'w-24 text-right',
    render: (row: any) => <>
      <button
        onClick={() => setEditor({ kind, item: row })}
        className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-700"
        title={`Edit ${labels[kind].toLowerCase()}`}
      >
        <Edit3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => setRemove({ kind, item: row })}
        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
        title={`Delete ${labels[kind].toLowerCase()}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  };
}

function FinanceForm({
  kind,
  item,
  categories,
  onClose,
  onSave,
  saving
}: {
  kind: Kind;
  item: any;
  categories: any[];
  onClose: () => void;
  onSave: (value: any) => void;
  saving: boolean;
}) {
  const dateField = kind === 'income' ? 'income_date' : 'expense_date';
  const { register, handleSubmit } = useForm({
    defaultValues: {
      [dateField]: todayInput(),
      ...item
    }
  });

  return <form onSubmit={handleSubmit(onSave)} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Date" required>
        <TextInput type="date" {...register(dateField, { required: true })} />
      </Field>
      {kind === 'income'
        ? <Field label="Income category" required><TextInput {...register('category', { required: true })} /></Field>
        : <Field label="Expense category"><SelectInput {...register('category_id')}><option value="">Uncategorized</option>{categories.map((category: any) => <option key={category.id} value={category.id}>{category.name}</option>)}</SelectInput></Field>}
      <Field label="Amount (PKR)" required>
        <TextInput type="number" min="0.01" step="0.01" {...register('amount', { required: true })} />
      </Field>
      {kind === 'expense' && <Field label="Payment method"><SelectInput {...register('payment_method')}><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="online">Online</option></SelectInput></Field>}
      <Field label="Reference no."><TextInput {...register('reference_no')} /></Field>
    </div>
    <Field label="Description"><TextArea {...register('description')} /></Field>
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      <Button type="submit" loading={saving}>Save {labels[kind]}</Button>
    </div>
  </form>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card className="p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-extrabold text-slate-800">{value}</p>
  </Card>;
}
