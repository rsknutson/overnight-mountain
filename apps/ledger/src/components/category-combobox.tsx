import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
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

type Category = {
  id: string;
  name: string;
  color: string | null;
  children: { id: string; name: string; color: string | null }[];
};

export function CategoryCombobox({
  categories,
  value,
  onSelect,
  placeholder = 'Select category...',
  className,
}: {
  categories: Category[];
  value: string | null;
  onSelect: (categoryId: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Build a flat lookup for the selected value's label
  const allFlat = categories.flatMap((g) => [
    { id: g.id, name: g.name, color: g.color, parentName: null as string | null },
    ...g.children.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      parentName: g.name,
    })),
  ]);

  const selected = value ? allFlat.find((c) => c.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
        >
          {selected ? (
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selected.color ?? '#9E9E9E' }}
              />
              <span className="truncate">
                {selected.parentName
                  ? `${selected.parentName} / ${selected.name}`
                  : selected.name}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandItem
              value="__uncategorized__"
              onSelect={() => {
                onSelect(null);
                setOpen(false);
              }}
              className="text-muted-foreground"
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  !value ? 'opacity-100' : 'opacity-0'
                )}
              />
              Uncategorized
            </CommandItem>
            {categories.map((group) => (
              <CommandGroup key={group.id} heading={group.name}>
                <CommandItem
                  value={`${group.name} (general)`}
                  onSelect={() => {
                    onSelect(group.id);
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
                      onSelect(child.id);
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
