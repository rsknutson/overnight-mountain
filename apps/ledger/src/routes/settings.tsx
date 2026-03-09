import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  getDb,
  getSetting,
  setSetting,
  listAccounts,
  seedCategories,
} from '@om/db';

const getSettingsData = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb();
  seedCategories(db);
  const autoCategorize = getSetting<boolean>(db, 'auto_categorize') ?? true;
  const accounts = listAccounts(db);
  return { autoCategorize, accounts };
});

const updateSetting = createServerFn({ method: 'POST' })
  .inputValidator((data: { key: string; value: unknown }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    setSetting(db, data.key, data.value);
    return { success: true };
  });

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
  loader: () => getSettingsData(),
});

function SettingsPage() {
  const { autoCategorize, accounts } = Route.useLoaderData();
  const router = useRouter();

  const handleToggleAutoCategorize = async () => {
    await updateSetting({
      data: { key: 'auto_categorize', value: !autoCategorize },
    });
    router.invalidate();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Auto-categorize Toggle */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Auto-categorize on Import
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Automatically categorize transactions using AI when importing CSV
              files.
            </p>
          </div>
          <button
            onClick={handleToggleAutoCategorize}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoCategorize ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoCategorize ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Accounts */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Accounts</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No accounts yet. Import a CSV to create your first account.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <span className="text-sm font-medium text-slate-900">
                  {acc.name}
                </span>
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                  {acc.type === 'credit_card' ? 'Credit Card' : 'Checking'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
