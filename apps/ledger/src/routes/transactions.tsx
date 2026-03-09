import { createFileRoute, Link, Outlet, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  getDb,
  listTransactions,
  listAccounts,
  listCategoriesHierarchical,
  updateTransactionCategory,
  findCandidateAmazonOrders,
  getLinkedAmazonOrders,
  listUnlinkedAmazonOrders,
  linkAmazonOrder,
  unlinkAmazonOrder,
} from '@om/db';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Package, ExternalLink } from 'lucide-react';
import { CategoryCombobox } from '~/components/category-combobox';
import { TransactionFilters, type Filters } from '~/components/transaction-filters';

const getTransactionsData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    const transactions = listTransactions(db, { includeTransfers: true });
    const accounts = listAccounts(db);
    const categories = listCategoriesHierarchical(db);

    // Pre-load linked Amazon orders for all Amazon transactions
    const amazonTxnIds = transactions
      .filter((t) => /amazon|amzn/i.test(t.description))
      .map((t) => t.id);

    const linkedOrdersMap: Record<string, AmazonOrder[]> = {};
    for (const txnId of amazonTxnIds) {
      const linked = getLinkedAmazonOrders(db, txnId);
      if (linked.length > 0) {
        linkedOrdersMap[txnId] = linked;
      }
    }

    return { transactions, accounts, categories, linkedOrdersMap };
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

const getSuggestionsForTransaction = createServerFn({ method: 'GET' })
  .inputValidator((data: { txnId: string; date: string; amount: number }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    const linked = getLinkedAmazonOrders(db, data.txnId);
    const candidates = findCandidateAmazonOrders(db, data.date, data.amount);
    return { linked, candidates };
  });

const getAllUnlinkedOrders = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    return listUnlinkedAmazonOrders(db);
  }
);

const linkOrderFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { amazonOrderId: string; transactionId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    linkAmazonOrder(db, data.amazonOrderId, data.transactionId);
    return { success: true };
  });

const unlinkOrderFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { amazonOrderId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    unlinkAmazonOrder(db, data.amazonOrderId);
    return { success: true };
  });

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
  loader: () => getTransactionsData(),
});

type AmazonOrder = {
  id: string;
  orderId: string;
  orderDate: string;
  itemName: string;
  category: string | null;
  asin: string | null;
  quantity: number;
  itemTotal: number;
  orderUrl: string | null;
  transactionId: string | null;
  createdAt: string;
};

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function TransactionsPage() {
  const { transactions, accounts, categories, linkedOrdersMap } =
    Route.useLoaderData();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const isDetailView =
    pathname !== '/transactions' && pathname.startsWith('/transactions/');
  const [filters, setFilters] = useState<Filters>({
    search: '',
    accountId: '',
    categoryId: '',
    dateRange: null,
  });
  const [amazonLinkingTxnId, setAmazonLinkingTxnId] = useState<string | null>(
    null
  );

  const filtered = transactions.filter((txn) => {
    if (
      filters.search &&
      !txn.description.toLowerCase().includes(filters.search.toLowerCase())
    )
      return false;
    if (filters.accountId && txn.accountId !== filters.accountId) return false;
    if (filters.categoryId && txn.categoryId !== filters.categoryId)
      return false;
    if (filters.dateRange) {
      if (
        txn.date < filters.dateRange.from ||
        txn.date > filters.dateRange.to
      )
        return false;
    }
    return true;
  });

  if (isDetailView) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <span className="text-sm text-muted-foreground">
          {filtered.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Input
          type="text"
          placeholder="Search descriptions..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-64"
        />
        <TransactionFilters
          filters={filters}
          onFiltersChange={setFilters}
          accounts={accounts}
          categories={categories}
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
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((txn) => {
                const isAmazon = /amazon|amzn/i.test(txn.description);
                const isLinkingThis = amazonLinkingTxnId === txn.id;
                const linkedOrders = linkedOrdersMap[txn.id] ?? [];
                const hasLinkedOrders = linkedOrders.length > 0;

                return (
                  <TableRow key={txn.id}>
                    <TableCell className="text-muted-foreground align-top">
                      {txn.date}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to="/transactions/$id"
                            params={{ id: txn.id }}
                            className="text-sm text-foreground hover:text-primary no-underline"
                          >
                            {txn.description}
                          </Link>
                          {txn.isTransfer && (
                            <Badge
                              variant="outline"
                              className="text-amber-700 border-amber-300 bg-amber-50"
                            >
                              Transfer
                            </Badge>
                          )}
                          {isAmazon && !isLinkingThis && !hasLinkedOrders && (
                            <button
                              className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                              onClick={() => setAmazonLinkingTxnId(txn.id)}
                            >
                              Link Amazon order
                            </button>
                          )}
                        </div>

                        {/* Linked Amazon orders display */}
                        {hasLinkedOrders && !isLinkingThis && (
                          <div className="space-y-1.5">
                            {linkedOrders.map((order) => (
                              <Alert
                                key={order.id}
                                className="py-2 px-3 bg-amber-50/50 border-amber-200"
                              >
                                <Package className="h-3.5 w-3.5 !text-amber-600" />
                                <AlertDescription className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-foreground truncate">
                                      {order.itemName}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>
                                        {formatCents(order.itemTotal)}
                                      </span>
                                      {order.quantity > 1 && (
                                        <span>Qty: {order.quantity}</span>
                                      )}
                                      {order.orderUrl && (
                                        <a
                                          href={order.orderUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                        >
                                          Amazon
                                          <ExternalLink className="h-2.5 w-2.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-muted-foreground hover:text-destructive flex-shrink-0"
                                    onClick={async () => {
                                      await unlinkOrderFn({
                                        data: { amazonOrderId: order.id },
                                      });
                                      router.invalidate();
                                    }}
                                  >
                                    Unlink
                                  </Button>
                                </AlertDescription>
                              </Alert>
                            ))}
                            <button
                              className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                              onClick={() => setAmazonLinkingTxnId(txn.id)}
                            >
                              Link another order
                            </button>
                          </div>
                        )}

                        {/* Linking panel */}
                        {isLinkingThis && (
                          <AmazonLinkingPanel
                            txnId={txn.id}
                            txnDate={txn.date}
                            txnAmount={txn.amount}
                            onClose={() => setAmazonLinkingTxnId(null)}
                            onLinked={() => {
                              setAmazonLinkingTxnId(null);
                              router.invalidate();
                            }}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {txn.isTransfer ? (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      ) : (
                        <CategoryCell
                          txnId={txn.id}
                          categoryId={txn.categoryId}
                          categoryName={txn.categoryName}
                          categoryColor={txn.categoryColor}
                          categories={categories}
                          onAssigned={() => router.invalidate()}
                        />
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium align-top ${
                        txn.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCents(txn.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function AmazonLinkingPanel({
  txnId,
  txnDate,
  txnAmount,
  onClose,
  onLinked,
}: {
  txnId: string;
  txnDate: string;
  txnAmount: number;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [linked, setLinked] = useState<AmazonOrder[]>([]);
  const [candidates, setCandidates] = useState<AmazonOrder[]>([]);
  const [allUnlinked, setAllUnlinked] = useState<AmazonOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load suggestions on mount
  useState(() => {
    getSuggestionsForTransaction({
      data: { txnId, date: txnDate, amount: txnAmount },
    }).then((res) => {
      setLinked(res.linked);
      setCandidates(res.candidates);
      setLoading(false);
    });
  });

  const handleLink = async (amazonOrderId: string) => {
    setLinkingId(amazonOrderId);
    await linkOrderFn({ data: { amazonOrderId, transactionId: txnId } });
    setLinkingId(null);
    onLinked();
  };

  const handleUnlink = async (amazonOrderId: string) => {
    setLinkingId(amazonOrderId);
    await unlinkOrderFn({ data: { amazonOrderId } });
    setLinkingId(null);
    onLinked();
  };

  const handleBrowseAll = async () => {
    setLoading(true);
    const orders = await getAllUnlinkedOrders();
    setAllUnlinked(orders);
    setLoading(false);
  };

  const browseList = allUnlinked
    ? allUnlinked.filter(
        (o) =>
          !searchQuery ||
          o.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.orderId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  if (loading) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Loading suggestions...
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2 max-w-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Amazon Order Linking
        </span>
        <button
          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Already linked */}
      {linked.length > 0 && (
        <div className="space-y-1">
          {linked.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-2 rounded border border-green-200 bg-green-50 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {order.itemName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.orderDate} — {formatCents(order.itemTotal)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground hover:text-destructive flex-shrink-0"
                disabled={linkingId === order.id}
                onClick={() => handleUnlink(order.id)}
              >
                Unlink
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {!allUnlinked && candidates.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Suggested matches:</p>
          {candidates.slice(0, 5).map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              linkingId={linkingId}
              onLink={handleLink}
            />
          ))}
        </div>
      )}

      {/* No suggestions */}
      {!allUnlinked && candidates.length === 0 && linked.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No matching orders found within 7 days.
        </p>
      )}

      {/* Browse all unlinked */}
      {!allUnlinked ? (
        <button
          className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
          onClick={handleBrowseAll}
        >
          Browse all unlinked orders
        </button>
      ) : (
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {browseList && browseList.length > 0 ? (
              browseList.slice(0, 20).map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  linkingId={linkingId}
                  onLink={handleLink}
                />
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No unlinked orders found.
              </p>
            )}
            {browseList && browseList.length > 20 && (
              <p className="text-xs text-muted-foreground">
                Showing 20 of {browseList.length} — use search to narrow down.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  linkingId,
  onLink,
}: {
  order: AmazonOrder;
  linkingId: string | null;
  onLink: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground truncate">
          {order.itemName}
        </p>
        <p className="text-xs text-muted-foreground">
          {order.orderDate} — {formatCents(order.itemTotal)}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="h-6 text-xs flex-shrink-0"
        disabled={linkingId === order.id}
        onClick={() => onLink(order.id)}
      >
        {linkingId === order.id ? '...' : 'Link'}
      </Button>
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
