import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  getDb,
  listCategoriesWithCounts,
  createCategory,
  updateCategory as updateCategoryDb,
  deleteCategory as deleteCategoryDb,
} from '@om/db';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';

const getCategoriesData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    return listCategoriesWithCounts(db);
  }
);

const addCategory = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { name: string; color: string; parentId: string | null }) => data
  )
  .handler(async ({ data }) => {
    const db = getDb();
    return createCategory(db, data);
  });

const editCategory = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      color?: string | null;
      parentId?: string | null;
    }) => data
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { id, ...updates } = data;
    updateCategoryDb(db, id, updates);
    return { success: true };
  });

const removeCategory = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    deleteCategoryDb(db, data.id);
    return { success: true };
  });

export const Route = createFileRoute('/categories')({
  component: CategoriesPage,
  loader: () => getCategoriesData(),
});

function CategoriesPage() {
  const categories = Route.useLoaderData();
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const parents = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addCategory({
      data: { name: newName.trim(), color: newColor, parentId: newParentId },
    });
    setNewName('');
    setNewParentId(null);
    router.invalidate();
  };

  const handleEdit = async (id: string) => {
    await editCategory({
      data: { id, name: editName, color: editColor },
    });
    setEditingId(null);
    router.invalidate();
  };

  const handleDelete = async (id: string) => {
    await removeCategory({ data: { id } });
    router.invalidate();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Categories</h1>

      {/* Add Category */}
      <Card className="p-4 flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-48">
          <Label className="text-xs text-muted-foreground uppercase">Name</Label>
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="mt-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Parent</Label>
          <select
            value={newParentId ?? ''}
            onChange={(e) => setNewParentId(e.target.value || null)}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">None (top-level)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Color</Label>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="mt-1 w-10 h-10 rounded border border-input cursor-pointer"
          />
        </div>
        <Button onClick={handleAdd}>Add</Button>
      </Card>

      {/* Categories List - Hierarchical */}
      <Card className="divide-y divide-border">
        {parents.map((cat) => (
          <div key={cat.id}>
            <CategoryRow
              cat={cat}
              indent={0}
              editingId={editingId}
              editName={editName}
              editColor={editColor}
              setEditingId={setEditingId}
              setEditName={setEditName}
              setEditColor={setEditColor}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
            {childrenOf(cat.id).map((child) => (
              <CategoryRow
                key={child.id}
                cat={child}
                indent={1}
                editingId={editingId}
                editName={editName}
                editColor={editColor}
                setEditingId={setEditingId}
                setEditName={setEditName}
                setEditColor={setEditColor}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}

function CategoryRow({
  cat,
  indent,
  editingId,
  editName,
  editColor,
  setEditingId,
  setEditName,
  setEditColor,
  onEdit,
  onDelete,
}: {
  cat: {
    id: string;
    name: string;
    color: string | null;
    isSystem: boolean;
    transactionCount: number;
  };
  indent: number;
  editingId: string | null;
  editName: string;
  editColor: string;
  setEditingId: (id: string | null) => void;
  setEditName: (name: string) => void;
  setEditColor: (color: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const paddingLeft = indent === 1 ? 'pl-10' : 'pl-4';

  return (
    <div
      className={`${paddingLeft} pr-4 py-3 flex items-center justify-between`}
    >
      {editingId === cat.id ? (
        <div className="flex gap-2 items-center flex-1">
          <input
            type="color"
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            className="w-8 h-8 rounded border border-input cursor-pointer"
          />
          <Input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && onEdit(cat.id)}
          />
          <Button variant="ghost" size="sm" onClick={() => onEdit(cat.id)}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color ?? '#9E9E9E' }}
            />
            <span
              className={`text-sm font-medium ${indent === 1 ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              {cat.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {cat.transactionCount} transactions
            </span>
            {cat.isSystem && (
              <Badge variant="secondary">System</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingId(cat.id);
                setEditName(cat.name);
                setEditColor(cat.color ?? '#9E9E9E');
              }}
            >
              Edit
            </Button>
            {!cat.isSystem && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(cat.id)}
              >
                Delete
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
