import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import {
  getDb,
  listCategoriesWithCounts,
  listCategories,
  createCategory,
  updateCategory as updateCategoryDb,
  deleteCategory as deleteCategoryDb,
  getSetting,
  setSetting,
  getTransactionsInDateRange,
  insertPendingCategorizations,
  listPendingCategorizations,
  acceptPendingCategorization,
  rejectPendingCategorization,
  acceptAllPendingCategorizations,
  rejectAllPendingCategorizations,
} from '@om/db';
import { categorizeTransactions } from '@om/ai';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Separator } from '~/components/ui/separator';

// --- Server Functions ---

const getCategoriesData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = getDb();
    const categories = listCategoriesWithCounts(db);
    const agentInstructions =
      getSetting<string>(db, 'agent_instructions') ?? '';
    const pendingReview = listPendingCategorizations(db);
    return { categories, agentInstructions, pendingReview };
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

const saveAgentInstructions = createServerFn({ method: 'POST' })
  .inputValidator((data: { instructions: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    setSetting(db, 'agent_instructions', data.instructions);
    return { success: true };
  });

const runAiCategorization = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { from: string; to: string; prompt: string }) => data
  )
  .handler(async ({ data }) => {
    const db = getDb();

    const agentInstructions =
      getSetting<string>(db, 'agent_instructions') ?? '';

    const allCategories = listCategories(db);
    const categoryInfo = allCategories.map((c) => ({
      id: c.id,
      name: c.name,
    }));

    // Get categorized transactions in range as examples
    const categorizedTxns = getTransactionsInDateRange(db, data.from, data.to, {
      uncategorizedOnly: false,
    }).filter((t) => t.categoryId && t.categoryName);

    const correctionHistory = categorizedTxns.map((t) => ({
      description: t.description,
      categoryName: t.categoryName!,
    }));

    // Get uncategorized transactions in range
    const uncategorizedTxns = getTransactionsInDateRange(
      db,
      data.from,
      data.to,
      { uncategorizedOnly: true }
    );

    if (uncategorizedTxns.length === 0) {
      return {
        success: true,
        proposed: 0,
        total: 0,
        message: 'No uncategorized transactions found in this date range.',
      };
    }

    const txnsForAi = uncategorizedTxns.map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
    }));

    const assignments = await categorizeTransactions(
      txnsForAi,
      categoryInfo,
      {
        agentInstructions: agentInstructions || undefined,
        userPrompt: data.prompt || undefined,
        correctionHistory:
          correctionHistory.length > 0 ? correctionHistory : undefined,
      }
    );

    // Build category name → id map
    const nameToId = new Map(allCategories.map((c) => [c.name, c.id]));

    // Store as pending proposals instead of applying directly
    const proposals = assignments
      .map((a) => ({
        transactionId: a.transactionId,
        proposedCategoryId: nameToId.get(a.categoryName)!,
        confidence: Math.round(a.confidence * 100),
      }))
      .filter((p) => p.proposedCategoryId);

    if (proposals.length > 0) {
      insertPendingCategorizations(db, proposals);
    }

    return {
      success: true,
      proposed: proposals.length,
      total: uncategorizedTxns.length,
      message: `Generated ${proposals.length} proposals for ${uncategorizedTxns.length} uncategorized transactions. Review them below.`,
    };
  });

const acceptProposal = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    acceptPendingCategorization(db, data.id);
    return { success: true };
  });

const rejectProposal = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb();
    rejectPendingCategorization(db, data.id);
    return { success: true };
  });

const acceptAllProposals = createServerFn({ method: 'POST' }).handler(
  async () => {
    const db = getDb();
    return acceptAllPendingCategorizations(db);
  }
);

const rejectAllProposals = createServerFn({ method: 'POST' }).handler(
  async () => {
    const db = getDb();
    return rejectAllPendingCategorizations(db);
  }
);

// --- Route ---

export const Route = createFileRoute('/categories')({
  component: CategoriesPage,
  loader: () => getCategoriesData(),
});

// --- Page Component ---

function CategoriesPage() {
  const {
    categories,
    agentInstructions: savedInstructions,
    pendingReview,
  } = Route.useLoaderData();
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Agent instructions state
  const [agentInstructions, setAgentInstructions] =
    useState(savedInstructions);
  const [instructionsSaving, setInstructionsSaving] = useState(false);
  const instructionsDirty = agentInstructions !== savedInstructions;

  // AI categorization state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

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

  const handleSaveInstructions = async () => {
    setInstructionsSaving(true);
    await saveAgentInstructions({ data: { instructions: agentInstructions } });
    setInstructionsSaving(false);
    router.invalidate();
  };

  const handleRunAi = async () => {
    if (!dateFrom || !dateTo) return;
    setAiRunning(true);
    setAiResult(null);
    try {
      const result = await runAiCategorization({
        data: { from: dateFrom, to: dateTo, prompt: aiPrompt },
      });
      setAiResult(result.message);
      router.invalidate();
    } catch (err) {
      setAiResult(
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setAiRunning(false);
    }
  };

  const handleAccept = async (id: string) => {
    await acceptProposal({ data: { id } });
    router.invalidate();
  };

  const handleReject = async (id: string) => {
    await rejectProposal({ data: { id } });
    router.invalidate();
  };

  const handleAcceptAll = async () => {
    await acceptAllProposals();
    router.invalidate();
  };

  const handleRejectAll = async () => {
    await rejectAllProposals();
    router.invalidate();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Categories</h1>

      {/* Add Category */}
      <Card className="p-4 flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-48">
          <Label className="text-xs text-muted-foreground uppercase">
            Name
          </Label>
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
          <Label className="text-xs text-muted-foreground uppercase">
            Parent
          </Label>
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
          <Label className="text-xs text-muted-foreground uppercase">
            Color
          </Label>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="mt-1 w-10 h-10 rounded border border-input cursor-pointer"
          />
        </div>
        <Button onClick={handleAdd}>Add</Button>
      </Card>

      {/* Categories List */}
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

      <Separator />

      {/* AI Categorization Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          AI Categorization
        </h2>

        {/* Agent Instructions */}
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-sm font-medium">Agent Instructions</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Persistent context for the AI agent. Describe how your
              transactions should be categorized, any special rules, or context
              about your accounts.
            </p>
          </div>
          <Textarea
            value={agentInstructions}
            onChange={(e) => setAgentInstructions(e.target.value)}
            placeholder={`e.g., "I use my Chase credit card primarily for personal expenses. Any transactions from Whole Foods, Trader Joe's should go under Groceries. Venmo payments to my landlord are Rent."`}
            rows={6}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveInstructions}
              disabled={!instructionsDirty || instructionsSaving}
              variant={instructionsDirty ? 'default' : 'secondary'}
              size="sm"
            >
              {instructionsSaving ? 'Saving...' : 'Save Instructions'}
            </Button>
            {instructionsDirty && (
              <span className="text-xs text-muted-foreground">
                Unsaved changes
              </span>
            )}
          </div>
        </Card>

        {/* Run Categorization */}
        <Card className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">
              Run AI Categorization
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Select a date range and optionally provide a prompt. The AI will
              propose categories for uncategorized transactions. You can review
              and accept/reject each proposal below.
            </p>
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs text-muted-foreground uppercase">
                From
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase">
                To
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase">
              Prompt (optional)
            </Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='e.g., "Focus on categorizing restaurant and food transactions. Be conservative with confidence scores."'
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRunAi}
              disabled={!dateFrom || !dateTo || aiRunning}
            >
              {aiRunning ? 'Categorizing...' : 'Run Categorization'}
            </Button>
            {aiRunning && (
              <span className="text-xs text-muted-foreground">
                This may take a while for large date ranges (rate limits
                require pauses between batches)...
              </span>
            )}
          </div>

          {aiResult && (
            <div
              className={`text-sm p-3 rounded-md ${
                aiResult.startsWith('Error')
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {aiResult}
            </div>
          )}
        </Card>

        {/* Review Pending Proposals */}
        {pendingReview.length > 0 && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  Review Proposals ({pendingReview.length})
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Accept or reject each AI-proposed categorization.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcceptAll}
                >
                  Accept All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleRejectAll}
                >
                  Reject All
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border rounded-md border">
              {pendingReview.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {item.transactionDate}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {item.transactionDescription}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {(item.transactionAmount / 100).toLocaleString(
                          'en-US',
                          {
                            style: 'currency',
                            currency: 'USD',
                          }
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        →
                      </span>
                      <Badge
                        variant="secondary"
                        className="gap-1.5"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              item.proposedCategoryColor ?? '#9E9E9E',
                          }}
                        />
                        {item.proposedCategoryName}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.confidence}% confidence
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleAccept(item.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleReject(item.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// --- Category Row Component ---

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
            {cat.isSystem && <Badge variant="secondary">System</Badge>}
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
