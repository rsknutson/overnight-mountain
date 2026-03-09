import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getDb, getTransactionYears, getYearlySummary, getMonthlySummary, seedCategories } from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getDashboardData = createServerFn({ method: 'GET' })
  .inputValidator((data: { year?: number; month?: number }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    seedCategories(db);

    const years = getTransactionYears(db);
    const selectedYear = data.year ?? years[0] ?? new Date().getFullYear();
    const selectedMonth = data.month ?? undefined;

    const summary = selectedMonth
      ? getMonthlySummary(db, `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`)
      : getYearlySummary(db, selectedYear);

    return { summary, years, selectedYear, selectedMonth };
  });

export const Route = createFileRoute('/')({
  component: Dashboard,
  validateSearch: (search: Record<string, unknown>) => ({
    year: search.year ? Number(search.year) : undefined,
    month: search.month ? Number(search.month) : undefined,
  }),
  loaderDeps: ({ search }) => ({ year: search.year, month: search.month }),
  loader: ({ deps }) => getDashboardData({ data: { year: deps.year, month: deps.month } }),
});

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function Dashboard() {
  const { summary, years, selectedYear, selectedMonth } = Route.useLoaderData();
  const navigate = useNavigate();

  const yearIndex = years.indexOf(selectedYear);
  const hasPrev = yearIndex < years.length - 1;
  const hasNext = yearIndex > 0;

  const goTo = (year: number, month?: number) => {
    navigate({ to: '/', search: { year, month } });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              goTo(selectedYear, val ? Number(val) : undefined);
            }}
            className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All Months</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!hasPrev}
              onClick={() => hasPrev && goTo(years[yearIndex + 1], selectedMonth)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <select
              value={selectedYear}
              onChange={(e) => goTo(Number(e.target.value), selectedMonth)}
              className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!hasNext}
              onClick={() => hasNext && goTo(years[yearIndex - 1], selectedMonth)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
