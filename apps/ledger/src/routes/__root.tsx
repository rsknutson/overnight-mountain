import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import '@fontsource-variable/inter';
import appCss from '~/styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ledger — Personal Finance Tracker' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
});

const NAV_ITEMS = [
  { to: '/' as const, label: 'Dashboard' },
  { to: '/import' as const, label: 'Import' },
  { to: '/transactions' as const, label: 'Transactions' },
  { to: '/amazon-orders' as const, label: 'Amazon Orders' },
  { to: '/categories' as const, label: 'Categories' },
  { to: '/transfers' as const, label: 'Transfers' },
  { to: '/settings' as const, label: 'Settings' },
];

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-card border-b border-border sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <Link to="/" className="text-xl font-bold text-foreground no-underline">
                  Ledger
                </Link>
                <nav className="flex gap-1">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent no-underline [&.active]:bg-accent [&.active]:text-accent-foreground"
                      activeProps={{ className: 'active bg-accent text-accent-foreground' }}
                      activeOptions={{ exact: item.to === '/' }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
