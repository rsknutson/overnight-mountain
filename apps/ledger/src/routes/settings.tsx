import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  getDb,
  getSetting,
  setSetting,
  listAccounts,
  seedCategories,
} from '@om/db';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';

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
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      {/* Auto-categorize Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Auto-categorize on Import
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically categorize transactions using AI when importing CSV
                files.
              </p>
            </div>
            <button
              onClick={handleToggleAutoCategorize}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoCategorize ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoCategorize ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts yet. Import a CSV to create your first account.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="text-sm font-medium text-foreground">
                    {acc.name}
                  </span>
                  <Badge variant="secondary">
                    {acc.type === 'credit_card' ? 'Credit Card' : 'Checking'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
