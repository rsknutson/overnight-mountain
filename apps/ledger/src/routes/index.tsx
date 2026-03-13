import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { getDb, getTransactionYears, getYearlySummary, getMonthlySummary, seedCategories } from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
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
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const yearIndex = years.indexOf(selectedYear);
  const hasPrev = yearIndex < years.length - 1;
  const hasNext = yearIndex > 0;

  const goTo = (year: number, month?: number) => {
    navigate({ to: '/', search: { year, month } });
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasSelection = selectedCategories.size > 0;

  // Compute filtered totals when categories are selected
  const filteredSummary = hasSelection
    ? (() => {
        const selected = summary.byCategory.filter((c) =>
          selectedCategories.has(c.categoryId ?? 'uncategorized')
        );
        const totalIncome = selected.reduce(
          (sum, c) => sum + Math.max(c.total, 0),
          0
        );
        const totalExpenses = selected.reduce(
          (sum, c) => sum + Math.min(c.total, 0),
          0
        );
        return {
          totalIncome,
          totalExpenses,
          net: totalIncome + totalExpenses,
          transactionCount: selected.reduce((sum, c) => sum + c.count, 0),
        };
      })()
    : null;

  const displaySummary = filteredSummary ?? summary;

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
          label={hasSelection ? 'Income (selected)' : 'Income'}
          value={formatCents(displaySummary.totalIncome)}
          className="text-green-600"
        />
        <SummaryCard
          label={hasSelection ? 'Expenses (selected)' : 'Expenses'}
          value={formatCents(displaySummary.totalExpenses)}
          className="text-red-600"
        />
        <SummaryCard
          label={hasSelection ? 'Net (selected)' : 'Net'}
          value={formatCents(displaySummary.net)}
          className={displaySummary.net >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          label={hasSelection ? 'Transactions (selected)' : 'Transactions'}
          value={String(displaySummary.transactionCount)}
          className="text-foreground"
        />
      </div>

      {/* Category Breakdown */}
      {summary.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Spending by Category</CardTitle>
              {hasSelection && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setSelectedCategories(new Set())}
                >
                  Clear selection
                </Button>
              )}
            </div>
            {!hasSelection && (
              <p className="text-xs text-muted-foreground">
                Click categories to filter the summary cards
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            {summary.byCategory
              .filter((c) => c.total < 0)
              .map((cat) => {
                const catKey = cat.categoryId ?? 'uncategorized';
                const isSelected = selectedCategories.has(catKey);
                const isDimmed = hasSelection && !isSelected;

                return (
                  <button
                    key={catKey}
                    className={`flex items-center justify-between w-full rounded-md px-3 py-2 text-left transition-colors cursor-pointer border-none bg-transparent ${
                      isSelected
                        ? 'bg-accent'
                        : isDimmed
                          ? 'opacity-40 hover:opacity-70'
                          : 'hover:bg-accent/50'
                    }`}
                    onClick={() => toggleCategory(catKey)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.categoryColor ?? '#9E9E9E' }}
                      />
                      <span className="text-sm text-foreground">
                        {cat.categoryName ?? 'Uncategorized'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({cat.count})
                      </span>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {formatCents(cat.total)}
                    </span>
                  </button>
                );
              })}
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
