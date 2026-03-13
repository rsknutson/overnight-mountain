import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useRef, useState, useEffect } from 'react';
import {
  getDb,
  getMonthlySummary,
  getLatestTransactionMonth,
  listTransactions,
  listCategoriesWithCounts,
  listAmazonOrders,
  getSetting,
} from '@om/db';
import { chat, type ChatMessage, type FinancialContext } from '@om/ai';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';

// --- Server Functions ---

const sendMessage = createServerFn({ method: 'POST' })
  .inputValidator((data: { messages: ChatMessage[] }) => data)
  .handler(async ({ data }) => {
    const db = getDb();

    // Build financial context for the AI
    const latestMonth = getLatestTransactionMonth(db);
    const monthlySummary = latestMonth
      ? getMonthlySummary(db, latestMonth)
      : undefined;

    const recentTxns = listTransactions(db, {
      month: latestMonth ?? undefined,
    }).slice(0, 50);

    const categories = listCategoriesWithCounts(db);

    const recentAmazon = listAmazonOrders(db).slice(0, 30);

    const agentInstructions =
      getSetting<string>(db, 'agent_instructions') ?? undefined;

    const context: FinancialContext = {
      monthlySummary: monthlySummary
        ? {
            month: monthlySummary.month,
            totalIncome: monthlySummary.totalIncome,
            totalExpenses: monthlySummary.totalExpenses,
            net: monthlySummary.net,
            transactionCount: monthlySummary.transactionCount,
            byCategory: monthlySummary.byCategory.map((c) => ({
              categoryName: c.categoryName,
              total: c.total,
              count: c.count,
            })),
          }
        : undefined,
      recentTransactions: recentTxns.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        categoryName: t.categoryName,
      })),
      categories: categories.map((c) => ({
        name: c.name,
        transactionCount: c.transactionCount,
      })),
      amazonOrders: recentAmazon.map((o) => ({
        orderDate: o.orderDate,
        itemName: o.itemName,
        itemTotal: o.itemTotal,
        category: o.category,
        linked: !!o.transactionId,
      })),
      agentInstructions,
    };

    const response = await chat(data.messages, context);
    return { response };
  });

// --- Route ---

export const Route = createFileRoute('/chat')({
  component: ChatPage,
});

// --- Page Component ---

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const result = await sendMessage({ data: { messages: updatedMessages } });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.response },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Chat</h1>
          <p className="text-sm text-muted-foreground">
            Ask about your transactions, spending, categories, and Amazon orders
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear Chat
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3 max-w-md">
              <p className="text-muted-foreground text-sm">
                Start a conversation about your finances. Try asking:
              </p>
              <div className="space-y-2">
                {[
                  'How much did I spend this month?',
                  'What are my top spending categories?',
                  'Show me my recent Amazon orders',
                  'How many uncategorized transactions do I have?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="block w-full text-left text-sm px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2.5 text-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* Input Area */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your finances..."
          rows={1}
          className="resize-none min-h-[44px] max-h-[120px]"
          disabled={loading}
          autoFocus
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="self-end"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
