import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Send, Loader2, Bot, User, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIBuilder() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "👋 Hi! I'm your AI extension builder assistant. Tell me what Chrome extension you want to build, and I'll help you create it step by step.\n\nYou can ask me to:\n- Generate extension code\n- Explain Chrome APIs\n- Fix bugs in your extension\n- Optimize permissions" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("lovable_gateway");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action: 'list' })
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableKeys(data.keys || []);
      }
    };
    fetchKeys();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            provider: selectedProvider 
          }),
        }
      );

      if (response.status === 429) {
        toast.error("Rate limit exceeded, please try again later");
        setIsLoading(false);
        return;
      }
      if (response.status === 402) {
        toast.error("Credits exhausted. Please add funds in Settings → Workspace → Usage.");
        setIsLoading(false);
        return;
      }
      if (!response.ok || !response.body) throw new Error("Failed to stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > newMessages.length) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {}
        }
      }
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <h1 className="font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" /> AI Builder Chat
          {selectedProvider === "lovable_gateway" ? (
            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
              Lovable AI Routed
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-secondary text-secondary-foreground">
              {availableKeys.find(k => k.id === selectedProvider)?.label || "Custom AI"}
            </Badge>
          )}
        </h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Select AI Provider</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setSelectedProvider("lovable_gateway")}
              className="flex items-center justify-between"
            >
              <span>Lovable Gateway</span>
              {selectedProvider === "lovable_gateway" && <Zap className="h-3 w-3 text-primary" />}
            </DropdownMenuItem>
            {availableKeys.length > 0 && <DropdownMenuSeparator />}
            {availableKeys.map(key => (
              <DropdownMenuItem 
                key={key.id} 
                onClick={() => setSelectedProvider(key.id)}
                className="flex items-center justify-between"
              >
                <span className="truncate">{key.label}</span>
                {selectedProvider === key.id && <Zap className="h-3 w-3 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
          >
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-full bg-gradient-cyber flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary/10 text-foreground" : "bg-card border border-border"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-gradient-cyber flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Ask about Chrome extensions..."
            className="bg-secondary border-border min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon" className="bg-gradient-cyber text-primary-foreground shrink-0 h-11 w-11">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
