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

const getCategoriesData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    return listCategoriesWithCounts(db);
  }
);

const addCategory = createServerFn({ method: 'POST' })
  .inputValidator((data: { name: string; color: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    return createCategory(db, data);
  });

const editCategory = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { id: string; name?: string; color?: string | null }) => data
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addCategory({ data: { name: newName.trim(), color: newColor } });
    setNewName('');
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
      <h1 className="text-2xl font-bold text-slate-900">Categories</h1>

      {/* Add Category */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-slate-500 uppercase">Name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase">Color</label>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
          />
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Add
        </button>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {categories.map((cat) => (
          <div key={cat.id} className="px-4 py-3 flex items-center justify-between">
            {editingId === cat.id ? (
              <div className="flex gap-2 items-center flex-1">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit(cat.id)}
                />
                <button
                  onClick={() => handleEdit(cat.id)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: cat.color ?? '#9E9E9E' }}
                  />
                  <span className="text-sm font-medium text-slate-900">
                    {cat.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {cat.transactionCount} transactions
                  </span>
                  {cat.isSystem && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      System
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                      setEditColor(cat.color ?? '#9E9E9E');
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Edit
                  </button>
                  {!cat.isSystem && (
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
