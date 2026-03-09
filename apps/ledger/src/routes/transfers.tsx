import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  getDb,
  listTransferPairs,
  detectTransfers,
  confirmTransferPair,
  dismissTransferPair,
  undismissTransferPair,
  getTransaction,
} from '@om/db';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';

const getTransfersData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    const pairs = listTransferPairs(db);

    // Enrich with transaction details
    const enriched = pairs.map((pair) => {
      const checkingTxn = getTransaction(db, pair.checkingTxnId);
      const creditTxn = getTransaction(db, pair.creditTxnId);
      return {
        ...pair,
        checkingTxn,
        creditTxn,
      };
    });

    return enriched;
  }
);

const runDetection = createServerFn({ method: 'POST' }).handler(async () => {
  const db = getDb();
  const found = detectTransfers(db);
  return { found };
});

const confirmPair = createServerFn({ method: 'POST' })
  .inputValidator((data: { pairId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    confirmTransferPair(db, data.pairId);
    return { success: true };
  });

const dismissPair = createServerFn({ method: 'POST' })
  .inputValidator((data: { pairId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    dismissTransferPair(db, data.pairId);
    return { success: true };
  });

const undismissPair = createServerFn({ method: 'POST' })
  .inputValidator((data: { pairId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    undismissTransferPair(db, data.pairId);
    return { success: true };
  });

export const Route = createFileRoute('/transfers')({
  component: TransfersPage,
  loader: () => getTransfersData(),
});

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `$${dollars.toLocaleString()}.${String(remainder).padStart(2, '0')}`;
}

function TransfersPage() {
  const pairs = Route.useLoaderData();
  const router = useRouter();

  const pendingPairs = pairs.filter((p) => p.status === 'pending');
  const confirmedPairs = pairs.filter((p) => p.status === 'confirmed');
  const dismissedPairs = pairs.filter((p) => p.status === 'dismissed');

  const handleDetect = async () => {
    const result = await runDetection();
    router.invalidate();
    if (result.found === 0) {
      alert('No new transfer pairs detected.');
    }
  };

  const handleConfirm = async (pairId: string) => {
    await confirmPair({ data: { pairId } });
    router.invalidate();
  };

  const handleDismiss = async (pairId: string) => {
    await dismissPair({ data: { pairId } });
    router.invalidate();
  };

  const handleUndismiss = async (pairId: string) => {
    await undismissPair({ data: { pairId } });
    router.invalidate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Transfers</h1>
        <Button onClick={handleDetect}>Detect Transfers</Button>
      </div>

      {/* Pending */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Pending Review ({pendingPairs.length})
        </h2>
        {pendingPairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending transfer pairs.</p>
        ) : (
          <div className="space-y-3">
            {pendingPairs.map((pair) => (
              <TransferCard
                key={pair.id}
                pair={pair}
                onConfirm={() => handleConfirm(pair.id)}
                onDismiss={() => handleDismiss(pair.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmed */}
      {confirmedPairs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Confirmed ({confirmedPairs.length})
          </h2>
          <div className="space-y-3">
            {confirmedPairs.map((pair) => (
              <TransferCard key={pair.id} pair={pair} />
            ))}
          </div>
        </div>
      )}

      {/* Dismissed */}
      {dismissedPairs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Dismissed ({dismissedPairs.length})
          </h2>
          <div className="space-y-3 opacity-60">
            {dismissedPairs.map((pair) => (
              <TransferCard
                key={pair.id}
                pair={pair}
                onUndismiss={() => handleUndismiss(pair.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransferCard({
  pair,
  onConfirm,
  onDismiss,
  onUndismiss,
}: {
  pair: ReturnType<typeof Route.useLoaderData>[number];
  onConfirm?: () => void;
  onDismiss?: () => void;
  onUndismiss?: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground">
            {formatCents(pair.amount)}
          </span>
          <Badge
            variant={
              pair.status === 'confirmed'
                ? 'default'
                : pair.status === 'dismissed'
                  ? 'secondary'
                  : 'outline'
            }
            className={
              pair.status === 'confirmed'
                ? 'bg-green-600'
                : pair.status === 'pending'
                  ? 'text-amber-700 border-amber-300 bg-amber-50'
                  : ''
            }
          >
            {pair.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Checking (Debit)</p>
            <p className="text-foreground">
              {pair.checkingTxn?.description ?? 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground">{pair.checkingTxn?.date}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Credit Card (Credit)</p>
            <p className="text-foreground">
              {pair.creditTxn?.description ?? 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground">{pair.creditTxn?.date}</p>
          </div>
        </div>
        {onConfirm && onDismiss && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button size="sm" onClick={onConfirm} className="bg-green-600 hover:bg-green-700">
              Confirm Transfer
            </Button>
            <Button variant="secondary" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        )}
        {pair.status === 'dismissed' && onUndismiss && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <Button variant="secondary" size="sm" onClick={onUndismiss}>
              Undismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
