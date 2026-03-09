import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getDb, getLatestTransactionMonth, getMonthlySummary, listTransactions, seedCategories } from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';

const getDashboardData = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb();
  seedCategories(db);

  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = getLatestTransactionMonth(db) ?? fallbackMonth;
  const summary = getMonthlySummary(db, currentMonth);
  const recentTransactions = listTransactions(db, { includeTransfers: false }).slice(0, 10);

  return { summary, recentTransactions, currentMonth };
});

export const Route = createFileRoute('/')({
  component: Dashboard,
  loader: () => getDashboardData(),
});

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function Dashboard() {
  const { summary, recentTransactions, currentMonth } = Route.useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {new Date(currentMonth + '-01').toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Income"
          value={formatCents(summary.totalIncome)}
          className="text-green-600"
        />
        <SummaryCard
          label="Expenses"
          value={formatCents(summary.totalExpenses)}
          className="text-red-600"
        />
        <SummaryCard
          label="Net"
          value={formatCents(summary.net)}
          className={summary.net >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          label="Transactions"
          value={String(summary.transactionCount)}
          className="text-foreground"
        />
      </div>

      {/* Category Breakdown */}
      {summary.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.byCategory
              .filter((c) => c.total < 0)
              .map((cat) => (
                <div key={cat.categoryId ?? 'uncategorized'} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.categoryColor ?? '#9E9E9E' }}
                    />
                    <span className="text-sm text-foreground">
                      {cat.categoryName ?? 'Uncategorized'}
                    </span>
                    <span className="text-xs text-muted-foreground">({cat.count})</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatCents(cat.total)}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No transactions yet. Import a CSV to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {txn.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{txn.date}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${
                        txn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCents(txn.amount)}
                    </p>
                    {txn.categoryName && (
                      <p className="text-xs text-muted-foreground">{txn.categoryName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${className}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
