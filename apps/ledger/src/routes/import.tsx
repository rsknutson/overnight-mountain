import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  detectFormat,
  parseChaseChecking,
  parseChaseCredit,
  type NormalizedTransaction,
} from '@om/csv-parser';
import {
  getDb,
  upsertAccount,
  bulkInsertTransactions,
  getAutoCategorizeSetting,
} from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';

const importTransactions = createServerFn({ method: 'POST' })
  .inputValidator((data: { csvText: string; fileName: string }) => data)
  .handler(async ({ data }) => {
    const { csvText, fileName } = data;

    // Detect format from header row
    const firstLine = csvText.split('\n')[0];
    const headers = firstLine.split(',').map((h) => h.trim().replace(/"/g, ''));
    const format = detectFormat(headers);

    if (!format) {
      throw new Error(
        'Unrecognized CSV format. Please upload a Chase checking or credit card statement.'
      );
    }

    let parsed: NormalizedTransaction[];
    if (format === 'chase-checking') {
      parsed = parseChaseChecking(csvText);
    } else {
      parsed = parseChaseCredit(csvText);
    }

    if (parsed.length === 0) {
      throw new Error('No transactions found in the CSV file.');
    }

    const db = getDb();

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

function ImportPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{
    fileName: string;
    csvText: string;
    lines: number;
  } | null>(null);
  const [result, setResult] = useState<{
    format: string;
    fileName: string;
    totalParsed: number;
    inserted: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    setResult(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim()).length;
      setPreview({ fileName: file.name, csvText: text, lines });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);

    try {
      const res = await importTransactions({
        data: { csvText: preview.csvText, fileName: preview.fileName },
      });
      setResult(res);
      setPreview(null);
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
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
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
      >
        <p className="text-foreground text-lg">
          Drop a Chase CSV file here, or click to browse
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          Supports Chase checking and credit card statements
        </p>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4 text-destructive text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Preview: {preview.fileName}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {preview.lines - 1} transactions found
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading ? 'Importing...' : 'Confirm Import'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6 space-y-2">
            <h2 className="text-lg font-semibold text-green-800">
              Import Complete
            </h2>
            <p className="text-sm text-green-700">
              File: {result.fileName} ({result.format})
            </p>
            <p className="text-sm text-green-700">
              Parsed: {result.totalParsed} | Inserted: {result.inserted} |
              Skipped (duplicates): {result.skipped}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
