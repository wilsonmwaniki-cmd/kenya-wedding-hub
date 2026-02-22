import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MessageSquare, Send, Loader2, Heart } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Habari! 🌸 I'm your wedding planning assistant. Ask me anything about planning your Kenyan wedding — from budget tips to vendor recommendations, traditions, and timelines." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Placeholder response — connect to your Lambda/AI endpoint
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm not connected to a live AI backend yet. Once you configure the AI endpoint, I'll be able to help with personalized wedding planning advice, vendor suggestions across Kenya, budget breakdowns, and cultural tradition guidance!\n\nIn the meantime, feel free to explore the other planning tools.",
        },
      ]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.32))] flex-col">
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground">Your personal wedding planning advisor</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-card">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-secondary text-secondary-foreground rounded-bl-sm'
              }`}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none text-inherit">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="border-t border-border p-4 flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about venues, traditions, budgets..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
