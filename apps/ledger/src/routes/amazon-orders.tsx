import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState, useRef, useEffect } from 'react';
import { getDb, listAmazonOrders, getAmazonOrderYears } from '@om/db';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';

const getAmazonOrdersData = createServerFn({ method: 'GET' })
  .inputValidator((data: { year?: number; month?: number }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    const years = getAmazonOrderYears(db);
    const selectedYear = data.year ?? years[0] ?? new Date().getFullYear();
    const selectedMonth = data.month ?? undefined;
    const orders = listAmazonOrders(db, {
      year: selectedYear,
      month: selectedMonth,
    });
    return { orders, years, selectedYear, selectedMonth };
  });

export const Route = createFileRoute('/amazon-orders')({
  component: AmazonOrdersPage,
  validateSearch: (search: Record<string, unknown>) => ({
    year: search.year ? Number(search.year) : undefined,
    month: search.month ? Number(search.month) : undefined,
  }),
  loaderDeps: ({ search }) => ({ year: search.year, month: search.month }),
  loader: ({ deps }) =>
    getAmazonOrdersData({ data: { year: deps.year, month: deps.month } }),
});

type ColumnKey =
  | 'orderDate'
  | 'itemName'
  | 'itemTotal'
  | 'quantity'
  | 'orderId'
  | 'category'
  | 'asin'
  | 'status';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'orderDate', label: 'Date', defaultVisible: true },
  { key: 'itemName', label: 'Item', defaultVisible: true },
  { key: 'itemTotal', label: 'Price', defaultVisible: true },
  { key: 'quantity', label: 'Qty', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'orderId', label: 'Order ID', defaultVisible: false },
  { key: 'category', label: 'Category', defaultVisible: false },
  { key: 'asin', label: 'ASIN', defaultVisible: false },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function AmazonOrdersPage() {
  const { orders, years, selectedYear, selectedMonth } = Route.useLoaderData();
  const navigate = useNavigate();

  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  );
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColumnPickerOpen(false);
      }
    }
    if (columnPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [columnPickerOpen]);

  const yearIndex = years.indexOf(selectedYear);
  const hasPrev = yearIndex < years.length - 1;
  const hasNext = yearIndex > 0;

  const goTo = (year: number, month?: number) => {
    navigate({ to: '/amazon-orders', search: { year, month } });
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const cols = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Amazon Orders</h1>
        <div className="flex items-center gap-3">
          {/* Column picker */}
          <div className="relative" ref={pickerRef}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setColumnPickerOpen(!columnPickerOpen)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Columns
            </Button>
            {columnPickerOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md border bg-popover p-2 shadow-md">
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-input"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Month filter */}
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

          {/* Year filter */}
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
              {years.length === 0 ? (
                <option value={new Date().getFullYear()}>
                  {new Date().getFullYear()}
                </option>
              ) : (
                years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))
              )}
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

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{orders.length} orders</span>
        {orders.length > 0 && (
          <span>
            — Total: {formatCents(orders.reduce((sum, o) => sum + o.itemTotal, 0))}
          </span>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.key === 'itemTotal' ? 'text-right' : ''}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={cols.length}
                  className="text-center text-muted-foreground"
                >
                  No Amazon orders found. Import an order report from the Import
                  page.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  {cols.map((col) => (
                    <TableCell key={col.key}>
                      <OrderCellValue column={col.key} order={order} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function OrderCellValue({
  column,
  order,
}: {
  column: ColumnKey;
  order: ReturnType<typeof Route.useLoaderData>['orders'][number];
}) {
  switch (column) {
    case 'orderDate':
      return <span className="text-muted-foreground">{order.orderDate}</span>;
    case 'itemName':
      return (
        <div className="max-w-md">
          <p className="text-sm text-foreground truncate">{order.itemName}</p>
          {order.orderUrl && (
            <a
              href={order.orderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View on Amazon
            </a>
          )}
        </div>
      );
    case 'itemTotal':
      return (
        <span className="text-right font-medium block">
          {formatCents(order.itemTotal)}
        </span>
      );
    case 'quantity':
      return <span>{order.quantity}</span>;
    case 'status':
      return order.transactionId ? (
        <Link
          to="/transactions/$id"
          params={{ id: order.transactionId }}
          className="no-underline"
        >
          <Badge
            variant="secondary"
            className="text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
          >
            Linked
          </Badge>
        </Link>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Unlinked
        </Badge>
      );
    case 'orderId':
      return (
        <span className="text-xs text-muted-foreground font-mono">
          {order.orderId}
        </span>
      );
    case 'category':
      return (
        <span className="text-sm text-muted-foreground">
          {order.category ?? '—'}
        </span>
      );
    case 'asin':
      return (
        <span className="text-xs text-muted-foreground font-mono">
          {order.asin ?? '—'}
        </span>
      );
  }
}
