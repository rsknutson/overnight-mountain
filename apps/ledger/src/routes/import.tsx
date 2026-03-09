import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  detectFormat,
  parseHeaderLine,
  parseChaseChecking,
  parseChaseCredit,
  parseAmazonOrders,
  type NormalizedTransaction,
} from '@om/csv-parser';
import {
  getDb,
  upsertAccount,
  bulkInsertTransactions,
  bulkInsertAmazonOrders,
  getAutoCategorizeSetting,
} from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';

const importCsv = createServerFn({ method: 'POST' })
  .inputValidator((data: { csvText: string; fileName: string }) => data)
  .handler(async ({ data }) => {
    const { csvText, fileName } = data;

    // Detect format from header row
    const firstLine = csvText.split('\n')[0];
    const headers = parseHeaderLine(firstLine);
    const format = detectFormat(headers);

    if (!format) {
      throw new Error(
        'Unrecognized CSV format. Supports Chase statements and Amazon order reports.'
      );
    }

    const db = getDb();

    // Handle Amazon orders separately
    if (format === 'amazon-orders') {
      const parsed = parseAmazonOrders(csvText);
      if (parsed.length === 0) {
        throw new Error('No orders found in the Amazon CSV file.');
      }
      const result = bulkInsertAmazonOrders(db, parsed);
      return {
        format,
        fileName,
        totalParsed: parsed.length,
        inserted: result.inserted,
        skipped: result.skipped,
      };
    }

    // Handle bank transactions
    let parsed: NormalizedTransaction[];
    if (format === 'chase-checking') {
      parsed = parseChaseChecking(csvText);
    } else {
      parsed = parseChaseCredit(csvText);
    }

    if (parsed.length === 0) {
      throw new Error('No transactions found in the CSV file.');
    }

    // Upsert account
    const accountType = format === 'chase-checking' ? 'checking' : 'credit_card';
    const accountName =
      accountType === 'checking' ? 'Chase Checking' : 'Chase Credit Card';
    const account = upsertAccount(db, { name: accountName, type: accountType as 'checking' | 'credit_card' });

    // Bulk insert transactions
    const result = bulkInsertTransactions(
      db,
      parsed.map((txn) => ({
        ...txn,
        accountId: account.id,
      }))
    );

    const autoCategorize = getAutoCategorizeSetting(db);

    return {
      format,
      fileName,
      totalParsed: parsed.length,
      inserted: result.inserted,
      skipped: result.skipped,
      autoCategorize,
    };
  });

export const Route = createFileRoute('/import')({
  component: ImportPage,
});

type FilePreview = {
  fileName: string;
  csvText: string;
  lines: number;
  isAmazon: boolean;
};

type ImportResult = {
  format: string;
  fileName: string;
  totalParsed: number;
  inserted: number;
  skipped: number;
};

function ImportPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = (files: File[]) => {
    setError(null);
    setResults([]);

    const invalidFiles = files.filter(
      (f) => !f.name.toLowerCase().endsWith('.csv')
    );
    if (invalidFiles.length > 0) {
      setError(
        `Not a CSV file: ${invalidFiles.map((f) => f.name).join(', ')}`
      );
      return;
    }

    const readPromises = files.map(
      (file) =>
        new Promise<FilePreview>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter((l) => l.trim()).length;
            const firstLine = text.split('\n')[0];
            const headers = parseHeaderLine(firstLine);
            const format = detectFormat(headers);
            resolve({ fileName: file.name, csvText: text, lines, isAmazon: format === 'amazon-orders' });
          };
          reader.readAsText(file);
        })
    );

    Promise.all(readPromises).then((newPreviews) => {
      setPreviews((prev) => {
        const existingNames = new Set(prev.map((p) => p.fileName));
        const unique = newPreviews.filter(
          (p) => !existingNames.has(p.fileName)
        );
        return [...prev, ...unique];
      });
    });
  };

  const removePreview = (fileName: string) => {
    setPreviews((prev) => prev.filter((p) => p.fileName !== fileName));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  };

  const handleConfirm = async () => {
    if (previews.length === 0) return;
    setLoading(true);
    setError(null);

    const importResults: ImportResult[] = [];
    const errors: string[] = [];

    for (const preview of previews) {
      try {
        const res = await importCsv({
          data: { csvText: preview.csvText, fileName: preview.fileName },
        });
        importResults.push(res);
      } catch (err) {
        errors.push(
          `${preview.fileName}: ${err instanceof Error ? err.message : 'Import failed'}`
        );
      }
    }

    if (importResults.length > 0) {
      setResults(importResults);
      router.invalidate();
    }
    if (errors.length > 0) {
      setError(errors.join('\n'));
    }
    setPreviews([]);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Import Transactions</h1>

      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv';
          input.multiple = true;
          input.onchange = (e) => {
            const files = Array.from(
              (e.target as HTMLInputElement).files || []
            );
            if (files.length > 0) handleFiles(files);
          };
          input.click();
        }}
      >
        <p className="text-foreground text-lg">
          Drop CSV files here, or click to browse
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          Supports Chase statements and Amazon order reports
        </p>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4 text-destructive text-sm whitespace-pre-line">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Previews */}
      {previews.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {previews.length} file{previews.length > 1 ? 's' : ''} ready to
                import
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPreviews([])}
                >
                  Cancel All
                </Button>
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading
                    ? 'Importing...'
                    : `Import ${previews.length} File${previews.length > 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {previews.map((p) => (
              <div
                key={p.fileName}
                className="flex items-center justify-between rounded-md border px-4 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {p.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.lines - 1} {p.isAmazon ? 'orders' : 'transactions'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePreview(p.fileName)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-lg font-semibold text-green-800">
              Import Complete
            </h2>
            {results.map((r) => (
              <div key={r.fileName} className="text-sm text-green-700">
                <p className="font-medium">{r.fileName} ({r.format})</p>
                <p>
                  Parsed: {r.totalParsed} | Inserted: {r.inserted} | Skipped
                  (duplicates): {r.skipped}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
