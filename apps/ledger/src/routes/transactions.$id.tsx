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
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { CategoryCombobox } from '~/components/category-combobox';

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
      <h1 className="text-2xl font-bold text-foreground">Transaction Detail</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Date</Label>
              <p className="text-sm font-medium text-foreground mt-1">
                {transaction.date}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">Amount</Label>
              <p
                className={`text-sm font-medium mt-1 ${
                  transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCents(transaction.amount)}
              </p>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground uppercase">
                Description
              </Label>
              <p className="text-sm font-medium text-foreground mt-1">
                {transaction.description}
              </p>
            </div>
            {transaction.rawDescription &&
              transaction.rawDescription !== transaction.description && (
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground uppercase">
                    Raw Description
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {transaction.rawDescription}
                  </p>
                </div>
              )}
            <div>
              <Label className="text-xs text-muted-foreground uppercase">
                Current Category
              </Label>
              <p className="text-sm font-medium text-foreground mt-1">
                {transaction.categoryName ?? 'Uncategorized'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">
                Category Source
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {transaction.categorySource ?? '—'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Update Category
            </h3>
            <CategoryCombobox
              categories={categories}
              value={selectedCategory || null}
              onSelect={(id) => setSelectedCategory(id ?? '')}
              placeholder="Select a category..."
              className="w-full"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={createRule}
                onChange={(e) => setCreateRule(e.target.checked)}
                className="rounded border-input"
              />
              Create rule for future transactions with this description
            </label>
            <Button
              onClick={handleSave}
              disabled={!selectedCategory || saving}
            >
              {saving ? 'Saving...' : 'Save Category'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
