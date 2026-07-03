import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Zap, Sparkles, ShieldCheck, Rocket, Cpu, Boxes, Wand2, Bot, Code2, Layers,
  Palette, LineChart, Lock, Globe, Github, Twitter, ArrowRight, Check, Play,
  Star, ChevronDown, Menu, X, Mail, Terminal, Package, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/* ---------------- Palette (Neon Cyber) ----------------
   #0A0E1A base   #00E5FF cyan   #B026FF violet
   #FF2E93 magenta   #F5F7FA ink  → maps to app tokens.
--------------------------------------------------------*/

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.floor(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span>{n.toLocaleString()}{suffix}</span>;
}

const features = [
  { icon: Bot, title: "Multi-Agent Pipeline", desc: "Intent → Architect → Codegen → Security → Package. Fully autonomous.", tint: "from-[#00E5FF] to-[#00E5FF]/0", ring: "ring-[#00E5FF]/30" },
  { icon: ShieldCheck, title: "MV3 Security Hardened", desc: "CSP defaults, permission risk analyzer, trusted-sender guards.", tint: "from-[#B026FF] to-[#B026FF]/0", ring: "ring-[#B026FF]/30" },
  { icon: Palette, title: "Theme Studio", desc: "WCAG-audited palettes, brand extractor, contrast auto-fix.", tint: "from-[#FF2E93] to-[#FF2E93]/0", ring: "ring-[#FF2E93]/30" },
  { icon: Package, title: "One-Click Package", desc: "ZIP-ready builds with icons, README, and store listing draft.", tint: "from-emerald-400 to-emerald-400/0", ring: "ring-emerald-400/30" },
  { icon: Layers, title: "Portfolio Factory", desc: "Batch-generate 100+ micro-tools/day with trend discovery.", tint: "from-amber-400 to-amber-400/0", ring: "ring-amber-400/30" },
  { icon: LineChart, title: "Live Control Center", desc: "Telemetry, HMAC-signed kill switches, revenue tracking.", tint: "from-[#00E5FF] to-[#B026FF]/0", ring: "ring-[#00E5FF]/30" },
];

const plans = [
  { name: "Hacker", price: "$0", period: "/forever", desc: "Kick the tires.", features: ["3 extensions / mo", "AI code generation", "Basic QA suite", "Community support"], cta: "Start free", highlight: false },
  { name: "Builder", price: "$29", period: "/mo", desc: "For serious indie devs.", features: ["Unlimited extensions", "Full agent pipeline", "Theme Studio + WCAG audit", "Chrome Store upload", "Priority support"], cta: "Go Builder", highlight: true },
  { name: "Factory", price: "$99", period: "/mo", desc: "Scale to a portfolio.", features: ["Everything in Builder", "Batch queue (100/day)", "Trend discovery agent", "Revenue tracker", "Team seats (5)"], cta: "Scale up", highlight: false },
];

const testimonials = [
  { name: "Maya R.", role: "Indie dev, 12-ext portfolio", quote: "Went from idea → published extension in under 10 minutes. This is unfair." },
  { name: "Devon K.", role: "Growth engineer @ Slate", quote: "The security auto-fix caught 3 permission leaks our team missed. Wild." },
  { name: "Priya S.", role: "Solo SaaS founder", quote: "Batch mode ships 20 tools a day. My conversion funnel has never been fatter." },
];

const clientLogos = ["ACME", "NORTHWIND", "HYPERION", "OCTANE", "PHOTON", "VECTOR"];

const faqs = [
  { q: "Do I need to know how to code?", a: "No. Extension Forge AI writes production-ready Manifest V3 code, hardens it, and packages it. You describe what you want; the agent ships." },
  { q: "Are the extensions store-ready?", a: "Yes. Every build passes 16 Chrome Web Store policy checks, includes a generated listing, icons, and QA report." },
  { q: "Why do I need approval to use the app?", a: "We manually approve every account during early access to maintain a high-signal community and prevent abuse. Approvals typically happen within hours." },
  { q: "What models do you use?", a: "NVIDIA NIM as primary, with OpenAI and Gemini fallbacks. All calls run through Lovable's secure gateway — no keys to manage." },
  { q: "Can I bring my own OAuth?", a: "Yes. Google & Apple work out of the box. Magic-link email is built in. Enterprise SSO on request." },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* 1. NAV */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-lg bg-gradient-cyber flex items-center justify-center relative">
              <Zap className="h-5 w-5 text-primary-foreground" />
              <div className="absolute inset-0 rounded-lg bg-gradient-cyber blur-md opacity-40 -z-10 group-hover:opacity-70 transition" />
            </div>
            <span className="font-bold text-lg tracking-tight">Extension Forge <span className="text-gradient-cyber">AI</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#demo" className="hover:text-foreground transition">Demo</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm" className="bg-gradient-cyber text-primary-foreground hover:opacity-90">
              <Link to="/auth">Get access <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>

          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden h-10 w-10 rounded-lg border border-border flex items-center justify-center"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 px-4 py-4 space-y-3">
            <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm">Features</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="block text-sm">Pricing</a>
            <a href="#demo" onClick={() => setMenuOpen(false)} className="block text-sm">Demo</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="block text-sm">FAQ</a>
            <div className="flex gap-2 pt-2">
              <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm" className="flex-1 bg-gradient-cyber text-primary-foreground"><Link to="/auth">Get access</Link></Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 bg-grid">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-[#00E5FF]/10 blur-3xl animate-pulse" />
          <div className="absolute top-40 right-1/4 h-96 w-96 rounded-full bg-[#B026FF]/15 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-[#FF2E93]/10 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge variant="outline" className="mb-6 border-primary/40 text-primary bg-primary/5">
              <Sparkles className="h-3 w-3 mr-1.5" /> Now in early access · invite-only
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Ship Chrome extensions{" "}
              <span className="text-gradient-cyber">at the speed of thought.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              A multi-agent AI factory that turns one sentence into a hardened, store-ready Manifest V3 extension —
              icons, security, listing, and all.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-cyber text-primary-foreground shadow-lg glow-primary hover:opacity-90">
                <Link to="/auth">Request access <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border">
                <a href="#demo"><Play className="h-4 w-4 mr-1.5" /> Watch 90-sec demo</a>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex -space-x-2">
                {[0,1,2,3].map(i => (
                  <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-gradient-cyber" />
                ))}
              </div>
              <span>Trusted by <b className="text-foreground">2,400+</b> indie devs shipping extensions</span>
            </div>
          </motion.div>

          {/* Hero visual: animated code/preview mock */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl overflow-hidden shadow-2xl glow-primary">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-secondary/40">
                <div className="h-3 w-3 rounded-full bg-[#FF2E93]" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-3 text-xs font-mono text-muted-foreground">forge://agent-pipeline</div>
              </div>
              <div className="p-5 font-mono text-xs space-y-2">
                {[
                  { c: "text-[#00E5FF]", t: "→ Intent parsed: 'YouTube summarizer'" },
                  { c: "text-[#B026FF]", t: "→ Architecture: MV3 + side_panel + gemini API" },
                  { c: "text-emerald-400", t: "✓ Manifest generated (12 permissions → 3 after risk fix)" },
                  { c: "text-emerald-400", t: "✓ 8 files written · CSP hardened" },
                  { c: "text-amber-400",  t: "⚡ Security scan: 0 critical, 1 warn (auto-fixed)" },
                  { c: "text-[#FF2E93]",  t: "◆ Icons rendered · WCAG AA verified" },
                  { c: "text-primary",    t: "✔ Packaged: yt-summarize-v1.0.0.zip (48 KB)" },
                ].map((row, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.15 }}
                    className={row.c}
                  >
                    {row.t}
                  </motion.div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-border bg-secondary/40 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">agent-pipeline · 6.2s</span>
                <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 border">ready to publish</Badge>
              </div>
            </div>
            {/* floating chips */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -top-4 -right-4 rounded-xl border border-[#00E5FF]/40 bg-background/90 backdrop-blur px-3 py-2 text-xs flex items-center gap-2"
            >
              <Cpu className="h-3.5 w-3.5 text-[#00E5FF]" /> NVIDIA NIM
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 3.5 }}
              className="absolute -bottom-4 -left-4 rounded-xl border border-[#B026FF]/40 bg-background/90 backdrop-blur px-3 py-2 text-xs flex items-center gap-2"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#B026FF]" /> MV3 · CSP hardened
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 3. LOGO STRIP */}
      <section className="border-y border-border py-8 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Powering builders at</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center">
            {clientLogos.map(l => (
              <div key={l} className="text-center font-mono text-sm text-muted-foreground/70 hover:text-foreground transition tracking-widest">{l}</div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. STATS COUNTERS */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { n: 48210, s: "+", label: "Extensions generated", color: "text-[#00E5FF]" },
            { n: 2400,  s: "+", label: "Active builders",       color: "text-[#B026FF]" },
            { n: 99,    s: "%", label: "MV3 pass rate",         color: "text-[#FF2E93]" },
            { n: 6,     s: "s", label: "Avg pipeline time",     color: "text-emerald-400" },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-card/50 p-6 text-center"
            >
              <div className={`text-4xl font-bold ${k.color}`}>
                <Counter to={k.n} suffix={k.s} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground uppercase tracking-wider">{k.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. FEATURE GRID */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3 border-[#B026FF]/40 text-[#B026FF]">Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Every stage of the extension lifecycle, automated.</h2>
            <p className="mt-3 text-muted-foreground">Six specialized agents cooperate to turn intent into a shipping product.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`p-6 h-full bg-card/60 border-border hover:border-primary/40 transition group relative overflow-hidden ring-1 ${f.ring} hover:ring-2`}>
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br ${f.tint} pointer-events-none`} />
                  <f.icon className="h-8 w-8 mb-4 text-primary relative" />
                  <h3 className="font-semibold text-lg relative">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 relative">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. RBAC EXPLAINER */}
      <section className="py-20 px-4 sm:px-6 bg-secondary/20 border-y border-border">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <Badge variant="outline" className="mb-3 border-[#FF2E93]/40 text-[#FF2E93]">Access control</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Role-based access, built in.</h2>
            <p className="mt-4 text-muted-foreground">
              Sign up is invite-only. Every new account starts as <b className="text-foreground">pending</b> until a superadmin reviews it
              and assigns roles. No leaks, no rogue seats.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Pending → Active gating on every route",
                "Superadmin console with approve / decline",
                "Row-Level Security enforced at the DB",
                "Google, Apple, Magic Link supported out of the box",
              ].map(x => (
                <li key={x} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { role: "Superadmin", icon: Lock,   color: "border-amber-400/40 bg-amber-400/5 text-amber-400" },
              { role: "Admin",      icon: ShieldCheck, color: "border-[#00E5FF]/40 bg-[#00E5FF]/5 text-[#00E5FF]" },
              { role: "User",       icon: Users,  color: "border-[#B026FF]/40 bg-[#B026FF]/5 text-[#B026FF]" },
            ].map(r => (
              <div key={r.role} className={`rounded-xl border p-4 text-center ${r.color}`}>
                <r.icon className="h-6 w-6 mx-auto mb-2" />
                <div className="text-xs font-semibold">{r.role}</div>
              </div>
            ))}
            <div className="col-span-3 rounded-xl border border-border bg-card p-4 font-mono text-xs text-muted-foreground">
              <div className="text-primary">// route-guard.ts</div>
              if (!status === "active") return &lt;PendingAccess /&gt;;<br />
              if (!hasRole(required)) return &lt;Forbidden /&gt;;
            </div>
          </div>
        </div>
      </section>

      {/* 7. DEMO CTA / SANDBOX */}
      <section id="demo" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto rounded-3xl border border-border bg-gradient-to-br from-[#00E5FF]/10 via-transparent to-[#B026FF]/10 p-8 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
          <Terminal className="h-10 w-10 mx-auto text-primary mb-4 relative" />
          <h2 className="text-3xl sm:text-4xl font-bold relative">Try the pipeline live.</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto relative">
            Watch six agents build a real extension in under 10 seconds. No install, no credit card.
          </p>
          <Button asChild size="lg" className="mt-6 bg-gradient-cyber text-primary-foreground glow-primary relative">
            <Link to="/auth">Launch sandbox <Rocket className="h-4 w-4 ml-1.5" /></Link>
          </Button>
        </div>
      </section>

      {/* 8. PRICING */}
      <section id="pricing" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-3 border-emerald-400/40 text-emerald-400">Pricing</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Simple plans. Ship as much as you want.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {plans.map(p => (
              <Card
                key={p.name}
                className={`p-8 relative ${p.highlight
                  ? "border-primary/60 bg-card ring-2 ring-primary/30 glow-primary"
                  : "border-border bg-card/60"}`}
              >
                {p.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-cyber text-primary-foreground border-0">
                    Most popular
                  </Badge>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                <div className="mt-5">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground text-sm">{p.period}</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full mt-8 ${p.highlight ? "bg-gradient-cyber text-primary-foreground" : ""}`}
                  variant={p.highlight ? "default" : "outline"}
                >
                  <Link to="/auth">{p.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 9. TESTIMONIALS */}
      <section className="py-20 px-4 sm:px-6 bg-secondary/20 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-3 border-[#00E5FF]/40 text-[#00E5FF]">Loved by builders</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Ship-first developers, real receipts.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 h-full bg-card border-border">
                  <div className="flex mb-3">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">"{t.quote}"</p>
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FAQ */}
      <section id="faq" className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-3 border-[#B026FF]/40 text-[#B026FF]">FAQ</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Answered.</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`i-${i}`} className="border-border">
                <AccordionTrigger className="text-left hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 11. FINAL CTA */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E5FF]/10 via-[#B026FF]/10 to-[#FF2E93]/10" />
        <div className="relative max-w-3xl mx-auto text-center">
          <Wand2 className="h-12 w-12 mx-auto text-primary mb-4" />
          <h2 className="text-4xl sm:text-5xl font-bold">Your next extension is 6 seconds away.</h2>
          <p className="mt-4 text-muted-foreground">Join the invite-only early access and start shipping today.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-cyber text-primary-foreground glow-primary">
              <Link to="/auth">Request access <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline"><a href="#features">Explore features</a></Button>
          </div>
        </div>
      </section>

      {/* 12. FOOTER */}
      <footer className="border-t border-border bg-card/40 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-cyber flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">Extension Forge AI</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              The autonomous Chrome extension factory. Built for builders who ship.
            </p>
            <form className="mt-5 flex gap-2 max-w-sm" onSubmit={(e) => e.preventDefault()}>
              <Input type="email" placeholder="you@example.com" className="bg-secondary border-border" />
              <Button type="submit" className="bg-gradient-cyber text-primary-foreground shrink-0">
                <Mail className="h-4 w-4" />
              </Button>
            </form>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><Link to="/auth" className="hover:text-foreground">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Privacy</a></li>
              <li><a href="#" className="hover:text-foreground">Terms</a></li>
              <li><a href="#" className="hover:text-foreground">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Extension Forge AI. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <a href="#" aria-label="Twitter" className="hover:text-foreground"><Twitter className="h-4 w-4" /></a>
            <a href="#" aria-label="GitHub" className="hover:text-foreground"><Github className="h-4 w-4" /></a>
            <a href="#" aria-label="Website" className="hover:text-foreground"><Globe className="h-4 w-4" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
