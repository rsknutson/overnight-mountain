import { useState } from 'react';
import { CalendarIcon, Check, ListFilter, Tag, Wallet, X } from 'lucide-react';
import { type DateRange } from 'react-day-picker';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import { Calendar } from '~/components/ui/calendar';
import { Separator } from '~/components/ui/separator';

// ── Types ──

type Account = { id: string; name: string };
type Category = {
  id: string;
  name: string;
  color: string | null;
  children: { id: string; name: string; color: string | null }[];
};

export type Filters = {
  search: string;
  accountId: string;
  categoryId: string;
  dateRange: { from: string; to: string } | null;
};

type FilterType = 'account' | 'category' | 'dateRange';

// ── Main Component ──

export function TransactionFilters({
  filters,
  onFiltersChange,
  accounts,
  categories,
}: {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  accounts: Account[];
  categories: Category[];
}) {
  // Which filter types are already active — hide from "add filter" menu
  const activeTypes = new Set<FilterType>();
  if (filters.accountId) activeTypes.add('account');
  if (filters.categoryId) activeTypes.add('category');
  if (filters.dateRange) activeTypes.add('dateRange');

  const availableTypes: { type: FilterType; label: string; icon: React.ReactNode }[] = [
    { type: 'account', label: 'Account', icon: <Wallet className="h-4 w-4" /> },
    { type: 'category', label: 'Category', icon: <Tag className="h-4 w-4" /> },
    { type: 'dateRange', label: 'Date Range', icon: <CalendarIcon className="h-4 w-4" /> },
  ].filter((t) => !activeTypes.has(t.type));

  // Lookup helpers
  const accountName = filters.accountId
    ? accounts.find((a) => a.id === filters.accountId)?.name
    : null;

  const allCatsFlat = categories.flatMap((g) => [
    { id: g.id, name: g.name, color: g.color, parentName: null as string | null },
    ...g.children.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      parentName: g.name,
    })),
  ]);
  const selectedCat = filters.categoryId
    ? allCatsFlat.find((c) => c.id === filters.categoryId)
    : null;

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {/* Active filter pills */}
      {filters.accountId && accountName && (
        <AccountFilterPill
          accountName={accountName}
          accounts={accounts}
          value={filters.accountId}
          onChange={(v) => onFiltersChange({ ...filters, accountId: v })}
          onRemove={() => onFiltersChange({ ...filters, accountId: '' })}
        />
      )}

      {filters.categoryId && selectedCat && (
        <CategoryFilterPill
          selectedCat={selectedCat}
          categories={categories}
          value={filters.categoryId}
          onChange={(v) => onFiltersChange({ ...filters, categoryId: v })}
          onRemove={() => onFiltersChange({ ...filters, categoryId: '' })}
        />
      )}

      {filters.dateRange && (
        <DateRangeFilterPill
          dateRange={filters.dateRange}
          onChange={(dr) => onFiltersChange({ ...filters, dateRange: dr })}
          onRemove={() => onFiltersChange({ ...filters, dateRange: null })}
        />
      )}

      {/* Add Filter button */}
      {availableTypes.length > 0 && (
        <AddFilterButton
          availableTypes={availableTypes}
          accounts={accounts}
          categories={categories}
          onAddFilter={(type, value) => {
            if (type === 'account') {
              onFiltersChange({ ...filters, accountId: value as string });
            } else if (type === 'category') {
              onFiltersChange({ ...filters, categoryId: value as string });
            } else if (type === 'dateRange') {
              onFiltersChange({ ...filters, dateRange: value as { from: string; to: string } });
            }
          }}
        />
      )}
    </div>
  );
}

// ── Add Filter Button ──

function AddFilterButton({
  availableTypes,
  accounts,
  categories,
  onAddFilter,
}: {
  availableTypes: { type: FilterType; label: string; icon: React.ReactNode }[];
  accounts: Account[];
  categories: Category[];
  onAddFilter: (type: FilterType, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'pick-type' | FilterType>('pick-type');

  const handleClose = () => {
    setOpen(false);
    // Delay reset so animation completes
    setTimeout(() => setStep('pick-type'), 150);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else setOpen(true);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <ListFilter className="h-3.5 w-3.5 mr-1.5" />
          Add Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        {step === 'pick-type' && (
          <Command>
            <CommandInput placeholder="Filter by..." />
            <CommandList>
              <CommandEmpty>No filter types.</CommandEmpty>
              <CommandGroup>
                {availableTypes.map((t) => (
                  <CommandItem
                    key={t.type}
                    value={t.label}
                    onSelect={() => setStep(t.type)}
                  >
                    {t.icon}
                    <span className="ml-2">{t.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {step === 'account' && (
          <Command>
            <CommandInput placeholder="Search accounts..." />
            <CommandList>
              <CommandEmpty>No accounts found.</CommandEmpty>
              <CommandGroup heading="Accounts">
                {accounts.map((acc) => (
                  <CommandItem
                    key={acc.id}
                    value={acc.name}
                    onSelect={() => {
                      onAddFilter('account', acc.id);
                      handleClose();
                    }}
                  >
                    <Wallet className="h-4 w-4 mr-2 text-muted-foreground" />
                    {acc.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {step === 'category' && (
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No category found.</CommandEmpty>
              {categories.map((group) => (
                <CommandGroup key={group.id} heading={group.name}>
                  <CommandItem
                    value={`${group.name} (general)`}
                    onSelect={() => {
                      onAddFilter('category', group.id);
                      handleClose();
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-1.5"
                      style={{ backgroundColor: group.color ?? '#9E9E9E' }}
                    />
                    {group.name} (general)
                  </CommandItem>
                  {group.children.map((child) => (
                    <CommandItem
                      key={child.id}
                      value={`${group.name} ${child.name}`}
                      onSelect={() => {
                        onAddFilter('category', child.id);
                        handleClose();
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-1.5"
                        style={{ backgroundColor: child.color ?? '#9E9E9E' }}
                      />
                      {child.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}

        {step === 'dateRange' && (
          <DateRangePicker
            onSelect={(range) => {
              onAddFilter('dateRange', range);
              handleClose();
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Filter Pills ──

function AccountFilterPill({
  accountName,
  accounts,
  value,
  onChange,
  onRemove,
}: {
  accountName: string;
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center">
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors">
            <Wallet className="h-3 w-3 text-muted-foreground" />
            Account
            <Separator orientation="vertical" className="mx-1 h-3.5" />
            <span className="font-semibold">{accountName}</span>
          </button>
        </PopoverTrigger>
        <button
          onClick={onRemove}
          className="flex items-center rounded-r-md border border-input bg-background px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts..." />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup>
              {accounts.map((acc) => (
                <CommandItem
                  key={acc.id}
                  value={acc.name}
                  onSelect={() => {
                    onChange(acc.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === acc.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {acc.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CategoryFilterPill({
  selectedCat,
  categories,
  value,
  onChange,
  onRemove,
}: {
  selectedCat: { name: string; color: string | null; parentName: string | null };
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const displayName = selectedCat.parentName
    ? `${selectedCat.parentName} / ${selectedCat.name}`
    : selectedCat.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center">
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors">
            <Tag className="h-3 w-3 text-muted-foreground" />
            Category
            <Separator orientation="vertical" className="mx-1 h-3.5" />
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: selectedCat.color ?? '#9E9E9E' }}
            />
            <span className="font-semibold max-w-[140px] truncate">{displayName}</span>
          </button>
        </PopoverTrigger>
        <button
          onClick={onRemove}
          className="flex items-center rounded-r-md border border-input bg-background px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            {categories.map((group) => (
              <CommandGroup key={group.id} heading={group.name}>
                <CommandItem
                  value={`${group.name} (general)`}
                  onSelect={() => {
                    onChange(group.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === group.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-1.5"
                    style={{ backgroundColor: group.color ?? '#9E9E9E' }}
                  />
                  {group.name} (general)
                </CommandItem>
                {group.children.map((child) => (
                  <CommandItem
                    key={child.id}
                    value={`${group.name} ${child.name}`}
                    onSelect={() => {
                      onChange(child.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === child.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 mr-1.5"
                      style={{ backgroundColor: child.color ?? '#9E9E9E' }}
                    />
                    {child.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DateRangeFilterPill({
  dateRange,
  onChange,
  onRemove,
}: {
  dateRange: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center">
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-l-md border border-r-0 border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors">
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
            Date
            <Separator orientation="vertical" className="mx-1 h-3.5" />
            <span className="font-semibold">
              {formatDate(dateRange.from)} – {formatDate(dateRange.to)}
            </span>
          </button>
        </PopoverTrigger>
        <button
          onClick={onRemove}
          className="flex items-center rounded-r-md border border-input bg-background px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <DateRangePicker
          initialRange={dateRange}
          onSelect={(range) => {
            onChange(range);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Date Range Picker ──

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function DateRangePicker({
  initialRange,
  onSelect,
}: {
  initialRange?: { from: string; to: string };
  onSelect: (range: { from: string; to: string }) => void;
}) {
  const [range, setRange] = useState<DateRange | undefined>(
    initialRange
      ? {
          from: new Date(initialRange.from + 'T00:00:00'),
          to: new Date(initialRange.to + 'T00:00:00'),
        }
      : undefined
  );

  const presets = [
    {
      label: 'Last 7 days',
      range: () => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);
        return { from, to };
      },
    },
    {
      label: 'Last 30 days',
      range: () => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 30);
        return { from, to };
      },
    },
    {
      label: 'This month',
      range: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from, to: now };
      },
    },
    {
      label: 'Last month',
      range: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from, to };
      },
    },
    {
      label: 'This year',
      range: () => {
        const now = new Date();
        const from = new Date(now.getFullYear(), 0, 1);
        return { from, to: now };
      },
    },
  ];

  const handleApply = () => {
    if (range?.from && range?.to) {
      onSelect({ from: toDateStr(range.from), to: toDateStr(range.to) });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex">
        <div className="border-r border-border p-2 space-y-1">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-7"
              onClick={() => {
                const r = preset.range();
                setRange(r);
                onSelect({ from: toDateStr(r.from), to: toDateStr(r.to) });
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="p-2">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
          />
        </div>
      </div>
      {range?.from && range?.to && (
        <div className="border-t border-border p-2 flex justify-end">
          <Button size="sm" className="h-7 text-xs" onClick={handleApply}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
