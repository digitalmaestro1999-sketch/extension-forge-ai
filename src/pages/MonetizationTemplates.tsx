import { useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Copy, Check, CreditCard, Megaphone, Link2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const TEMPLATES = [
  {
    id: "freemium",
    name: "Freemium Subscription",
    icon: Crown,
    description: "Free basic features with premium upgrade via Stripe or Gumroad",
    revenue: "$5–$10/user/month",
    difficulty: "Medium",
    files: {
      "utils/premium.js": `// Premium feature gate
const PREMIUM_FEATURES = ['advanced_ai', 'bulk_export', 'custom_themes'];

async function isPremium() {
  const { premium } = await chrome.storage.sync.get('premium');
  return !!premium;
}

async function checkFeature(feature) {
  if (!PREMIUM_FEATURES.includes(feature)) return true;
  const premium = await isPremium();
  if (!premium) {
    showUpgradePrompt(feature);
    return false;
  }
  return true;
}

function showUpgradePrompt(feature) {
  chrome.action.openPopup();
  chrome.runtime.sendMessage({ action: 'showUpgrade', feature });
}

async function activatePremium(licenseKey) {
  const res = await fetch('YOUR_API/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: licenseKey })
  });
  const { valid } = await res.json();
  if (valid) {
    await chrome.storage.sync.set({ premium: true, licenseKey });
  }
  return valid;
}`,
      "popup/upgrade.html": `<!DOCTYPE html>
<html>
<head><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"></head>
<body class="bg-gray-900 text-white p-6 w-80">
  <h2 class="text-xl font-bold mb-4">⭐ Upgrade to Premium</h2>
  <div class="space-y-3">
    <div class="p-3 border border-gray-700 rounded-lg">
      <h3 class="font-semibold">Free Plan</h3>
      <ul class="text-sm text-gray-400 mt-1"><li>✓ Basic features</li><li>✓ 10 uses/day</li></ul>
    </div>
    <div class="p-3 border border-blue-500 rounded-lg bg-blue-500/10">
      <h3 class="font-semibold">Premium — $5/mo</h3>
      <ul class="text-sm text-gray-300 mt-1"><li>✓ Unlimited uses</li><li>✓ Advanced AI</li><li>✓ Priority support</li></ul>
      <button id="upgrade-btn" class="mt-3 w-full py-2 bg-blue-600 rounded font-medium hover:bg-blue-700">Upgrade Now</button>
    </div>
  </div>
</body>
</html>`,
    },
  },
  {
    id: "usage",
    name: "API Usage Billing",
    icon: CreditCard,
    description: "Charge per API call — great for AI-powered extensions",
    revenue: "$3–$8/user/month avg",
    difficulty: "Medium",
    files: {
      "utils/usage-tracker.js": `// Track API usage and enforce limits
const FREE_LIMIT = 10;

async function getUsage() {
  const { usage = { count: 0, resetDate: new Date().toDateString() } } = await chrome.storage.sync.get('usage');
  if (usage.resetDate !== new Date().toDateString()) {
    usage.count = 0;
    usage.resetDate = new Date().toDateString();
    await chrome.storage.sync.set({ usage });
  }
  return usage;
}

async function canUseAPI() {
  const { premium } = await chrome.storage.sync.get('premium');
  if (premium) return true;
  const usage = await getUsage();
  return usage.count < FREE_LIMIT;
}

async function trackUsage() {
  const usage = await getUsage();
  usage.count++;
  await chrome.storage.sync.set({ usage });
  return { remaining: Math.max(0, FREE_LIMIT - usage.count), used: usage.count };
}`,
    },
  },
  {
    id: "affiliate",
    name: "Affiliate Revenue",
    icon: Link2,
    description: "Recommend products/services and earn commissions",
    revenue: "$1–$5/user/month",
    difficulty: "Easy",
    files: {
      "utils/affiliate.js": `// Affiliate link injection
const AFFILIATE_LINKS = {
  'amazon.com': { tag: 'YOUR_AMAZON_TAG', param: 'tag' },
  'notion.so': { url: 'https://affiliate.notion.so/YOUR_ID' },
};

function injectAffiliateTag(url) {
  try {
    const u = new URL(url);
    const config = AFFILIATE_LINKS[u.hostname.replace('www.', '')];
    if (config?.param) {
      u.searchParams.set(config.param, config.tag);
      return u.toString();
    }
    return config?.url || url;
  } catch { return url; }
}

// Content script: rewrite links
document.querySelectorAll('a[href]').forEach(link => {
  const newUrl = injectAffiliateTag(link.href);
  if (newUrl !== link.href) link.href = newUrl;
});`,
    },
  },
  {
    id: "ads",
    name: "Lightweight Ads",
    icon: Megaphone,
    description: "Non-intrusive banner ads in popup UI",
    revenue: "$0.50–$2/user/month",
    difficulty: "Easy",
    files: {
      "utils/ads.js": `// Simple ad rotation system
const AD_SLOTS = [
  { text: 'Try ToolX — Boost productivity 10x', url: 'https://toolx.com?ref=YOUR_ID', color: '#3B82F6' },
  { text: 'NoteAI — Smart note-taking', url: 'https://noteai.com?ref=YOUR_ID', color: '#10B981' },
];

function renderAd(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const ad = AD_SLOTS[Math.floor(Math.random() * AD_SLOTS.length)];
  container.innerHTML = \`
    <a href="\${ad.url}" target="_blank" 
       style="display:block;padding:8px 12px;background:\${ad.color}15;border:1px solid \${ad.color}30;border-radius:6px;text-decoration:none;font-size:12px;color:\${ad.color};text-align:center;">
      \${ad.text}
    </a>\`;
}`,
    },
  },
];

export default function MonetizationTemplates() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          Monetization Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop-in revenue code patterns for your Chrome extensions
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TEMPLATES.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="h-full">
              <CardContent className="p-4 text-center">
                <t.icon className="h-6 w-6 mx-auto text-primary mb-2" />
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.revenue}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-6">
        {TEMPLATES.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <template.icon className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{template.difficulty}</Badge>
                  <Badge className="bg-primary/10 text-primary border-0">{template.revenue}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={Object.keys(template.files)[0]}>
                <TabsList className="h-8">
                  {Object.keys(template.files).map((f) => (
                    <TabsTrigger key={f} value={f} className="text-xs">{f}</TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(template.files).map(([filename, code]) => (
                  <TabsContent key={filename} value={filename}>
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-7"
                        onClick={() => copyCode(code, `${template.id}-${filename}`)}
                      >
                        {copiedId === `${template.id}-${filename}` ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto max-h-72 font-mono">
                        {code}
                      </pre>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
