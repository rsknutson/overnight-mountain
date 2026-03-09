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
      <h1 className="text-2xl font-bold text-slate-900">Import Transactions</h1>

      {/* Dropzone */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
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
        <p className="text-slate-600 text-lg">
          Drop a Chase CSV file here, or click to browse
        </p>
        <p className="text-slate-400 text-sm mt-2">
          Supports Chase checking and credit card statements
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Preview: {preview.fileName}
              </h2>
              <p className="text-sm text-slate-500">
                {preview.lines - 1} transactions found
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-2">
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
        </div>
      )}
    </div>
  );
}
