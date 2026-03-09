import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  getDb,
  getTransaction,
  listCategoriesHierarchical,
  updateTransactionCategory,
  updateTransactionNotes,
  createCategoryRule,
  findCandidateAmazonOrders,
  getLinkedAmazonOrders,
  linkAmazonOrder,
  unlinkAmazonOrder,
} from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Textarea } from '~/components/ui/textarea';
import { CategoryCombobox } from '~/components/category-combobox';

const getTransactionDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    const transaction = getTransaction(db, data.id);
    if (!transaction) throw new Error('Transaction not found');
    const categories = listCategoriesHierarchical(db);

    // Check if this looks like an Amazon transaction
    const isAmazon = /amazon|amzn/i.test(transaction.description);
    let linkedOrders: ReturnType<typeof getLinkedAmazonOrders> = [];
    let candidateOrders: ReturnType<typeof findCandidateAmazonOrders> = [];

    if (isAmazon) {
      linkedOrders = getLinkedAmazonOrders(db, transaction.id);
      candidateOrders = findCandidateAmazonOrders(
        db,
        transaction.date,
        transaction.amount
      );
    }

    return { transaction, categories, isAmazon, linkedOrders, candidateOrders };
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

const saveNotes = createServerFn({ method: 'POST' })
  .inputValidator((data: { txnId: string; notes: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    updateTransactionNotes(db, data.txnId, data.notes || null);
    return { success: true };
  });

const linkOrder = createServerFn({ method: 'POST' })
  .inputValidator((data: { amazonOrderId: string; transactionId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    linkAmazonOrder(db, data.amazonOrderId, data.transactionId);
    return { success: true };
  });

const unlinkOrder = createServerFn({ method: 'POST' })
  .inputValidator((data: { amazonOrderId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    unlinkAmazonOrder(db, data.amazonOrderId);
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
  const { transaction, categories, isAmazon, linkedOrders, candidateOrders } =
    Route.useLoaderData();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(
    transaction.categoryId ?? ''
  );
  const [createRule, setCreateRule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(transaction.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const notesChanged = notes !== (transaction.notes ?? '');
  const [linkingId, setLinkingId] = useState<string | null>(null);

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
            {!transaction.isTransfer && (
              <>
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
              </>
            )}
          </div>

          {!transaction.isTransfer && (
            <>
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
            </>
          )}

          {/* Amazon Order Matching */}
          {isAmazon && (
            <>
              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Amazon Purchase
                </h3>

                {/* Linked orders */}
                {linkedOrders.length > 0 && (
                  <div className="space-y-2">
                    {linkedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-start justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {order.itemName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{order.orderDate}</span>
                            <span>{formatCents(order.itemTotal)}</span>
                            <span>Qty: {order.quantity}</span>
                          </div>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={async () => {
                            await unlinkOrder({ data: { amazonOrderId: order.id } });
                            router.invalidate();
                          }}
                        >
                          Unlink
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Candidate orders to link */}
                {candidateOrders.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Suggested matches (by date and amount):
                    </p>
                    {candidateOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-start justify-between rounded-md border px-4 py-3"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {order.itemName}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{order.orderDate}</span>
                            <span>{formatCents(order.itemTotal)}</span>
                            <span>Qty: {order.quantity}</span>
                            {order.category && (
                              <Badge variant="outline" className="text-xs">
                                {order.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-shrink-0"
                          disabled={linkingId === order.id}
                          onClick={async () => {
                            setLinkingId(order.id);
                            await linkOrder({
                              data: {
                                amazonOrderId: order.id,
                                transactionId: transaction.id,
                              },
                            });
                            setLinkingId(null);
                            router.invalidate();
                          }}
                        >
                          {linkingId === order.id ? 'Linking...' : 'Link'}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : linkedOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Amazon orders found nearby. Import your Amazon order
                    report to match purchases.
                  </p>
                ) : null}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Notes</h3>
            <Textarea
              placeholder="Add notes about this transaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <Button
              onClick={async () => {
                setSavingNotes(true);
                await saveNotes({
                  data: { txnId: transaction.id, notes },
                });
                setSavingNotes(false);
                router.invalidate();
              }}
              disabled={!notesChanged || savingNotes}
              variant={notesChanged ? 'default' : 'secondary'}
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
