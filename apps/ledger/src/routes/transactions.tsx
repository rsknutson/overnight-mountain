import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { getDb, listTransactions, listAccounts, listCategories, updateTransactionCategory } from '@om/db';

const getTransactionsData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    const transactions = listTransactions(db, { includeTransfers: true });
    const accounts = listAccounts(db);
    const categories = listCategories(db);
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
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <span className="text-sm text-slate-500">
          {filtered.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Accounts</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                Category
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No transactions found.
                </td>
              </tr>
            ) : (
              filtered.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {txn.date}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/transactions/$id"
                      params={{ id: txn.id }}
                      className="text-sm text-slate-900 hover:text-blue-600 no-underline"
                    >
                      {txn.description}
                    </Link>
                    {txn.isTransfer && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        Transfer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={txn.categoryId ?? ''}
                      onChange={async (e) => {
                        const categoryId = e.target.value || null;
                        if (categoryId) {
                          await assignCategory({
                            data: { txnId: txn.id, categoryId },
                          });
                          router.invalidate();
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={`px-4 py-3 text-sm font-medium text-right ${
                      txn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCents(txn.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
