import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { getDb, listTransactions, listAccounts, listCategoriesHierarchical, updateTransactionCategory } from '@om/db';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { CategoryCombobox } from '~/components/category-combobox';

const getTransactionsData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    const transactions = listTransactions(db, { includeTransfers: true });
    const accounts = listAccounts(db);
    const categories = listCategoriesHierarchical(db);
    return { transactions, accounts, categories };
  }
);

const assignCategory = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { txnId: string; categoryId: string | null }) => data
  )
  .handler(async ({ data }) => {
    const db = getDb();
    if (data.categoryId) {
      updateTransactionCategory(db, data.txnId, data.categoryId, 'user');
    }
    return { success: true };
  });

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
  loader: () => getTransactionsData(),
});

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function TransactionsPage() {
  const { transactions, accounts, categories } = Route.useLoaderData();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = transactions.filter((txn) => {
    if (search && !txn.description.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (accountFilter && txn.accountId !== accountFilter) return false;
    if (categoryFilter && txn.categoryId !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Input
          type="text"
          placeholder="Search descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">All Accounts</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
        <CategoryCombobox
          categories={categories}
          value={categoryFilter || null}
          onSelect={(id) => setCategoryFilter(id ?? '')}
          placeholder="All Categories"
          className="w-[220px]"
        />
      </div>

      {/* Transaction Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="text-muted-foreground">
                    {txn.date}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/transactions/$id"
                      params={{ id: txn.id }}
                      className="text-sm text-foreground hover:text-primary no-underline"
                    >
                      {txn.description}
                    </Link>
                    {txn.isTransfer && (
                      <Badge variant="outline" className="ml-2 text-amber-700 border-amber-300 bg-amber-50">
                        Transfer
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <CategoryCell
                      txnId={txn.id}
                      categoryId={txn.categoryId}
                      categoryName={txn.categoryName}
                      categoryColor={txn.categoryColor}
                      categories={categories}
                      onAssigned={() => router.invalidate()}
                    />
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      txn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCents(txn.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CategoryCell({
  txnId,
  categoryId,
  categoryName,
  categoryColor,
  categories,
  onAssigned,
}: {
  txnId: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categories: ReturnType<typeof Route.useLoaderData>['categories'];
  onAssigned: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CategoryCombobox
        categories={categories}
        value={categoryId}
        onSelect={async (newCategoryId) => {
          if (newCategoryId) {
            await assignCategory({
              data: { txnId, categoryId: newCategoryId },
            });
            onAssigned();
          }
          setEditing(false);
        }}
        placeholder="Select category..."
        className="w-[200px] h-8 text-xs"
      />
    );
  }

  if (categoryId && categoryName) {
    return (
      <Badge
        variant="secondary"
        className="cursor-pointer gap-1.5 hover:bg-secondary/80"
        onClick={() => setEditing(true)}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryColor ?? '#9E9E9E' }}
        />
        {categoryName}
      </Badge>
    );
  }

  return (
    <CategoryCombobox
      categories={categories}
      value={null}
      onSelect={async (newCategoryId) => {
        if (newCategoryId) {
          await assignCategory({
            data: { txnId, categoryId: newCategoryId },
          });
          onAssigned();
        }
      }}
      placeholder="Select category..."
      className="w-[200px] h-8 text-xs"
    />
  );
}
