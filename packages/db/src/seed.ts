import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from './client.js';
import { categories } from './schema/index.js';

interface CategorySeed {
  name: string;
  color: string;
  isExcluded?: boolean;
  children?: { name: string }[];
}

const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Rental Income',
    color: '#4CAF50',
    children: [
      { name: 'Rent' },
      { name: 'Late Fees' },
      { name: 'Pet Rent' },
      { name: 'Parking' },
    ],
  },
  {
    name: 'Other Income',
    color: '#8BC34A',
    children: [
      { name: 'Laundry Income' },
      { name: 'Application Fees' },
      { name: 'Security Deposits' },
    ],
  },
  {
    name: 'Mortgage & Financing',
    color: '#795548',
    children: [
      { name: 'Mortgage Payment' },
      { name: 'Interest' },
      { name: 'HOA Fees' },
      { name: 'PMI' },
    ],
  },
  {
    name: 'Repairs & Maintenance',
    color: '#FF9800',
    children: [
      { name: 'Electrical' },
      { name: 'Plumbing' },
      { name: 'HVAC' },
      { name: 'Landscaping' },
      { name: 'Appliance Repair' },
      { name: 'Janitorial / House Cleaning' },
      { name: 'Pest Control' },
      { name: 'General Repairs' },
    ],
  },
  {
    name: 'Capital Expenditures',
    color: '#E91E63',
    children: [
      { name: 'Renovations' },
      { name: 'New Appliances' },
      { name: 'Roof' },
      { name: 'Flooring' },
    ],
  },
  {
    name: 'Utilities',
    color: '#607D8B',
    children: [
      { name: 'Electric' },
      { name: 'Gas' },
      { name: 'Water/Sewer' },
      { name: 'Trash' },
      { name: 'Internet' },
    ],
  },
  {
    name: 'Insurance',
    color: '#2196F3',
    children: [
      { name: 'Property Insurance' },
      { name: 'Liability Insurance' },
      { name: 'Flood Insurance' },
    ],
  },
  {
    name: 'Taxes',
    color: '#9C27B0',
    children: [
      { name: 'Property Tax' },
      { name: 'Income Tax' },
    ],
  },
  {
    name: 'Property Management',
    color: '#00BCD4',
    children: [
      { name: 'Management Fees' },
      { name: 'Leasing Fees' },
      { name: 'Advertising' },
    ],
  },
  {
    name: 'Professional Services',
    color: '#673AB7',
    children: [
      { name: 'Legal' },
      { name: 'Accounting' },
      { name: 'Inspection' },
    ],
  },
  {
    name: 'Travel',
    color: '#FF5722',
    children: [
      { name: 'Mileage' },
      { name: 'Lodging' },
      { name: 'Meals' },
    ],
  },
  {
    name: 'Supplies',
    color: '#009688',
    children: [
      { name: 'Cleaning Supplies' },
      { name: 'Tools' },
      { name: 'Office Supplies' },
    ],
  },
  { name: 'Uncategorized', color: '#9E9E9E' },
  { name: 'Exclude', color: '#616161', isExcluded: true },
];

export function seedCategories(db: Db) {
  for (const cat of DEFAULT_CATEGORIES) {
    const parentId = nanoid();
    db.insert(categories)
      .values({
        id: parentId,
        name: cat.name,
        color: cat.color,
        isSystem: true,
        isExcluded: cat.isExcluded ?? false,
        parentId: null,
      })
      .onConflictDoNothing()
      .run();

    if (cat.children) {
      // Look up the actual parent id (might already exist from a previous seed)
      const parent = db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, cat.name))
        .get();
      const resolvedParentId = parent?.id ?? parentId;

      for (const child of cat.children) {
        db.insert(categories)
          .values({
            id: nanoid(),
            name: child.name,
            color: cat.color,
            isSystem: true,
            parentId: resolvedParentId,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  }
}
