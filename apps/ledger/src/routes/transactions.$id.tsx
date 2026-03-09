import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  getDb,
  getTransaction,
  listCategoriesHierarchical,
  updateTransactionCategory,
  createCategoryRule,
} from '@om/db';

const getTransactionDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    const transaction = getTransaction(db, data.id);
    if (!transaction) throw new Error('Transaction not found');
    const categories = listCategoriesHierarchical(db);
    return { transaction, categories };
  });

const updateCategory = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { txnId: string; categoryId: string; createRule: boolean }) => data
  )
  .handler(async ({ data }) => {
    const db = getDb();
    updateTransactionCategory(db, data.txnId, data.categoryId, 'user');

    if (data.createRule) {
      const txn = getTransaction(db, data.txnId);
      if (txn) {
        createCategoryRule(db, {
          pattern: txn.description,
          categoryId: data.categoryId,
        });
      }
    }

    return { success: true };
  });

export const Route = createFileRoute('/transactions/$id')({
  component: TransactionDetailPage,
  loader: ({ params }) => getTransactionDetail({ data: { id: params.id } }),
});

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function TransactionDetailPage() {
  const { transaction, categories } = Route.useLoaderData();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(
    transaction.categoryId ?? ''
  );
  const [createRule, setCreateRule] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedCategory) return;
    setSaving(true);
    await updateCategory({
      data: {
        txnId: transaction.id,
        categoryId: selectedCategory,
        createRule,
      },
    });
    setSaving(false);
    router.invalidate();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Transaction Detail</h1>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 uppercase">Date</label>
            <p className="text-sm font-medium text-slate-900">
              {transaction.date}
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase">Amount</label>
            <p
              className={`text-sm font-medium ${
                transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCents(transaction.amount)}
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-500 uppercase">
              Description
            </label>
            <p className="text-sm font-medium text-slate-900">
              {transaction.description}
            </p>
          </div>
          {transaction.rawDescription &&
            transaction.rawDescription !== transaction.description && (
              <div className="col-span-2">
                <label className="text-xs text-slate-500 uppercase">
                  Raw Description
                </label>
                <p className="text-sm text-slate-600">
                  {transaction.rawDescription}
                </p>
              </div>
            )}
          <div>
            <label className="text-xs text-slate-500 uppercase">
              Current Category
            </label>
            <p className="text-sm font-medium text-slate-900">
              {transaction.categoryName ?? 'Uncategorized'}
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase">
              Category Source
            </label>
            <p className="text-sm text-slate-600">
              {transaction.categorySource ?? '—'}
            </p>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Update Category
          </h3>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">Select a category</option>
            {categories.map((group) => (
              <optgroup key={group.id} label={group.name}>
                <option value={group.id}>{group.name} (general)</option>
                {group.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="rounded border-slate-300"
            />
            Create rule for future transactions with this description
          </label>
          <button
            onClick={handleSave}
            disabled={!selectedCategory || saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
