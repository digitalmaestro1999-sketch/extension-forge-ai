import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, ChevronDown, ChevronRight, Zap, LayoutDashboard,
  TrendingUp, Wand2, Code2, Layers, FolderOpen, Blocks, Plug,
  TestTube2, Package, Upload, Briefcase, BarChart3, DollarSign,
  Search, Settings, Shield, ArrowRight, User, LogOut
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

function SectionBlock({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/50 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <section.icon className={`h-4 w-4 shrink-0 ${open ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`text-sm font-semibold ${open ? "text-foreground" : "text-muted-foreground"}`}>
          {section.title}
        </span>
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-5 pb-5 pt-0 text-sm text-muted-foreground leading-relaxed space-y-3"
        >
          {section.content}
        </motion.div>
      )}
    </div>
  );
}

const sections: Section[] = [
  {
    id: "overview",
    title: "1. Overview — What is Extension Forge AI?",
    icon: Zap,
    content: (
      <>
        <p>
          <strong className="text-foreground">Extension Forge AI</strong> is an autonomous, AI-powered platform that lets you discover trends, generate complete Chrome extensions, test them, and prepare Chrome Web Store listings — all from a single prompt.
        </p>
        <p>The platform is built around an <strong className="text-foreground">agent pipeline</strong> that chains multiple AI stages together:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Intent Analysis</strong> — extracts features, permissions, and architecture from your idea.</li>
          <li><strong className="text-foreground">Architecture Design</strong> — plans the file structure (manifest, background, popup, content scripts, etc.).</li>
          <li><strong className="text-foreground">Code Generation</strong> — produces production-ready Manifest V3 extension code.</li>
          <li><strong className="text-foreground">Security Audit</strong> — audits permissions, CSP, and data handling.</li>
          <li><strong className="text-foreground">Store Compliance</strong> — validates against Chrome Web Store policies.</li>
          <li><strong className="text-foreground">Package Ready</strong> — bundles everything into a downloadable .zip.</li>
        </ul>
        <p>All generated extensions use <strong className="text-foreground">Manifest V3</strong>, the latest Chrome extension standard.</p>
      </>
    ),
  },
  {
    id: "auth",
    title: "2. Authentication — Signing Up & Signing In",
    icon: User,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/auth</Badge> or click <strong className="text-foreground">"Sign In"</strong> in the sidebar footer.</p>
        <h4 className="font-semibold text-foreground mt-2">Sign Up Options</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Google OAuth</strong> — Click "Continue with Google" for one-click sign-up.</li>
          <li><strong className="text-foreground">Email &amp; Password</strong> — Enter your email and a password (minimum 6 characters). You'll receive a confirmation email — click the link to activate your account.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Sign In</h4>
        <p>Toggle to "Sign In" mode using the link at the bottom. Enter your credentials and click "Sign In". On success you're redirected to the Dashboard.</p>
        <h4 className="font-semibold text-foreground mt-2">Sign Out</h4>
        <p>Click the <LogOut className="h-3 w-3 inline" /> icon in the sidebar footer to sign out.</p>
        <h4 className="font-semibold text-foreground mt-2">Why Sign In?</h4>
        <p>An account is required to: save projects to the database, use the Batch Queue, view Project History, and access the Portfolio and Revenue Tracker. You can still use Create Extension, AI Builder, Templates, and the Code Editor without signing in (data will be stored in your browser session only).</p>
      </>
    ),
  },
  {
    id: "dashboard",
    title: "3. Dashboard — Home Screen",
    icon: LayoutDashboard,
    content: (
      <>
        <p>The Dashboard (<Badge variant="secondary" className="font-mono text-[10px]">/</Badge>) is your home base. It shows:</p>
        <h4 className="font-semibold text-foreground mt-2">Stats Bar (signed-in users)</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Extensions Built</strong> — total extensions saved to your account.</li>
          <li><strong className="text-foreground">Trends Discovered</strong> — total trend opportunities saved.</li>
          <li><strong className="text-foreground">Queue Items</strong> — items currently queued for batch generation.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Agent Modules</h4>
        <p>Six quick-action cards link to the core modules:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Discover Trends</strong> → <Badge variant="secondary" className="font-mono text-[10px]">/trends</Badge></li>
          <li><strong className="text-foreground">Create Extension</strong> → <Badge variant="secondary" className="font-mono text-[10px]">/create</Badge></li>
          <li><strong className="text-foreground">Batch Generate</strong> → <Badge variant="secondary" className="font-mono text-[10px]">/batch</Badge></li>
          <li><strong className="text-foreground">View Projects</strong> → <Badge variant="secondary" className="font-mono text-[10px]">/projects</Badge></li>
          <li><strong className="text-foreground">Use Template</strong> → <Badge variant="secondary" className="font-mono text-[10px]">/templates</Badge></li>
          <li><strong className="text-foreground">AI Chat Builder</strong> → <Badge variant="secondary" className="font-mono text-[10px]">/ai-builder</Badge></li>
        </ul>
      </>
    ),
  },
  {
    id: "trends",
    title: "4. Trend Discovery — Find Profitable Extension Ideas",
    icon: TrendingUp,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/trends</Badge>. This AI agent analyzes markets to find profitable Chrome extension opportunities.</p>
        <h4 className="font-semibold text-foreground mt-2">How to Use</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Type a niche or market into the search box (e.g., "productivity", "AI tools", "SEO").</li>
          <li>Or click one of the quick-tag badges below the input: <em>productivity, AI tools, SEO, social media, developer tools, e-commerce</em>.</li>
          <li>Click <strong className="text-foreground">"Discover Trends"</strong> or press Enter.</li>
          <li>The AI agent scans the market and returns opportunity cards.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Opportunity Cards</h4>
        <p>Each result card shows:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Opportunity Name</strong> — the suggested extension concept.</li>
          <li><strong className="text-foreground">Category</strong> — which market it falls in.</li>
          <li><strong className="text-foreground">Revenue Potential</strong> — low / medium / high badge.</li>
          <li><strong className="text-foreground">Demand Score</strong> — 0–100% bar showing market demand.</li>
          <li><strong className="text-foreground">Competition Score</strong> — 0–100% bar showing existing competition.</li>
          <li><strong className="text-foreground">Features</strong> — suggested features for the extension.</li>
          <li><strong className="text-foreground">"Build" button</strong> — click to auto-fill the Create Extension page with this idea.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Credit Status Banner</h4>
        <p>If AI credits are unavailable, a yellow warning banner appears at the top. Results will use fallback data in this case. The banner disappears once credits are restored.</p>
        <h4 className="font-semibold text-foreground mt-2">Data Persistence</h4>
        <p>If you're signed in, all discovered trends are automatically saved to your account and counted in your Dashboard stats.</p>
      </>
    ),
  },
  {
    id: "create",
    title: "5. Create Extension — Autonomous Agent Pipeline",
    icon: Wand2,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/create</Badge>. This is the core of Extension Forge — a 6-stage autonomous pipeline that turns a single prompt into a full Chrome extension.</p>
        <h4 className="font-semibold text-foreground mt-2">Step-by-Step</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong className="text-foreground">Describe your idea</strong> in the text area. Be as detailed as you want — mention target websites, features, API integrations, etc.</li>
          <li>Click <strong className="text-foreground">"Launch Agent"</strong>.</li>
          <li>Watch the 6-stage pipeline execute in real time.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Pipeline Stages (in order)</h4>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong className="text-foreground">Intent Analysis</strong> — AI extracts the extension name, features list, required permissions, and host permissions from your description.</li>
          <li><strong className="text-foreground">Architecture Design</strong> — plans the file structure: manifest.json, background.js, content.js, popup.html/js/css, options.html/js, and utility modules.</li>
          <li><strong className="text-foreground">Code Generation</strong> — AI generates production-ready code for every file. The system merges AI-generated code with high-quality local templates, using AI code where it's substantial and falling back to templates otherwise. The manifest is always generated locally for correctness.</li>
          <li><strong className="text-foreground">Security Audit</strong> — AI audits permissions, CSP policies, and data handling. If credits are exhausted, this stage is skipped gracefully.</li>
          <li><strong className="text-foreground">Store Compliance</strong> — AI validates the extension against Chrome Web Store policies. Also skippable if credits run out.</li>
          <li><strong className="text-foreground">Package Ready</strong> — finalizes the package for download.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Progress Tracking</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>A progress bar shows overall completion (0–100%).</li>
          <li>Each stage shows a status icon: ○ idle, ⟳ running, ✓ done, ⚠ error.</li>
          <li>Duration badges show how long each stage took (e.g., "4.2s").</li>
          <li>Click any completed stage to expand and see detailed JSON results.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">After Completion</h4>
        <p>A success card appears with three action buttons:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Open in Editor</strong> → navigate to the Code Editor with all files loaded.</li>
          <li><strong className="text-foreground">Test &amp; Validate</strong> → navigate to the Testing Engine.</li>
          <li><strong className="text-foreground">Publish Assets</strong> → navigate to the Publish Assistant.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Rate Limiting</h4>
        <p>If the AI rate-limits your request, the system automatically retries up to 3 times with exponential backoff (5s → 10s → 20s). A toast notification keeps you informed.</p>
        <h4 className="font-semibold text-foreground mt-2">Pre-filled Ideas</h4>
        <p>If you clicked "Build" from a Trend Discovery result, the idea text area is automatically pre-filled with that opportunity.</p>
      </>
    ),
  },
  {
    id: "ai-builder",
    title: "6. AI Builder Chat — Interactive Extension Assistant",
    icon: Zap,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/ai-builder</Badge>. This is a conversational AI assistant specialized in Chrome extension development.</p>
        <h4 className="font-semibold text-foreground mt-2">Capabilities</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Generate extension code snippets on demand.</li>
          <li>Explain Chrome APIs (tabs, storage, alarms, webRequest, etc.).</li>
          <li>Debug and fix issues in your extension code.</li>
          <li>Optimize permissions and suggest best practices.</li>
          <li>Answer any Chrome extension development question.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">How to Use</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Type your question or request in the text area at the bottom.</li>
          <li>Press Enter or click the send button.</li>
          <li>The AI responds in real-time via streaming — you'll see the response appear word by word.</li>
          <li>The conversation maintains full context, so you can ask follow-up questions.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Keyboard Shortcuts</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Enter</kbd> — Send message.</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Shift + Enter</kbd> — New line (doesn't send).</li>
        </ul>
      </>
    ),
  },
  {
    id: "batch",
    title: "7. Batch Queue — Mass Extension Generation",
    icon: Layers,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/batch</Badge>. Queue multiple extension ideas and generate them all in sequence. <strong className="text-foreground">Requires sign-in.</strong></p>
        <h4 className="font-semibold text-foreground mt-2">How to Use</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Enter extension ideas in the text area, <strong className="text-foreground">one idea per line</strong>.</li>
          <li>Click <strong className="text-foreground">"Add to Queue"</strong> — ideas are saved to your account.</li>
          <li>Click <strong className="text-foreground">"Process Queue"</strong> to start generating all queued items.</li>
          <li>Watch as each item progresses: queued → processing → completed/failed.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Queue Item Statuses</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Queued</strong> (clock icon) — waiting to be processed.</li>
          <li><strong className="text-foreground">Processing</strong> (spinning icon) — currently being generated.</li>
          <li><strong className="text-foreground">Completed</strong> (green check) — extension generated and saved. Click the arrow to view the project.</li>
          <li><strong className="text-foreground">Failed</strong> (red X) — generation failed. Error message shown below.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Managing the Queue</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">"Clear Done"</strong> button removes all completed and failed items from the list.</li>
          <li>The queue header shows total count and badges for queued/done counts.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Processing Details</h4>
        <p>Each item goes through: spec generation → code generation → project save. The button shows real-time progress (e.g., "Processing 2/5...").</p>
      </>
    ),
  },
  {
    id: "editor",
    title: "8. Code Editor — Edit Extension Files",
    icon: Code2,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/editor</Badge>. A full Monaco-based code editor (same engine as VS Code) for viewing and editing your extension files.</p>
        <h4 className="font-semibold text-foreground mt-2">Layout</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Left panel</strong> — file tree showing all extension files with emoji icons (📋 manifest, ⚡ popup.js, 🎨 CSS, ⚙️ background, etc.).</li>
          <li><strong className="text-foreground">Right panel</strong> — Monaco editor with syntax highlighting for JSON, HTML, CSS, and JavaScript.</li>
          <li><strong className="text-foreground">Top bar</strong> — file/line count badges, Reset button, and Download .zip button.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Features</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Syntax highlighting</strong> — automatic language detection based on file extension.</li>
          <li><strong className="text-foreground">Word wrap</strong> — enabled by default for readability.</li>
          <li><strong className="text-foreground">Dark theme</strong> — uses VS Dark theme for comfortable editing.</li>
          <li><strong className="text-foreground">Font</strong> — JetBrains Mono at 13px.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Actions</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Reset</strong> — regenerates all files from the original spec (discards your edits).</li>
          <li><strong className="text-foreground">Download .zip</strong> — packages all files plus auto-generated icons into a Chrome-loadable .zip file.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">File Sources</h4>
        <p>Files are loaded from session storage in this priority: AI-generated files (from pipeline) → spec-based template files → demo placeholder files.</p>
      </>
    ),
  },
  {
    id: "templates",
    title: "9. Templates — Start from Proven Patterns",
    icon: Blocks,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/templates</Badge>. Browse pre-built extension templates organized by category.</p>
        <h4 className="font-semibold text-foreground mt-2">How to Use</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Browse templates or filter by category using the badge filters at the top.</li>
          <li>Each template card shows: name, description, category, and required permissions.</li>
          <li>Click <strong className="text-foreground">"Use Template"</strong> to load the template into the Code Editor with all files pre-generated.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">What's Included</h4>
        <p>Each template generates a complete extension with: manifest.json, background.js, content.js, popup (HTML/JS/CSS), options page (5-tab layout with General, Shortcuts, Automation, Data, About), and utility modules.</p>
        <h4 className="font-semibold text-foreground mt-2">Template Categories</h4>
        <p>Templates span categories like Productivity, AI, SEO, Social Media, E-commerce, and more. Use the "All" badge to see every template.</p>
      </>
    ),
  },
  {
    id: "projects",
    title: "10. Projects — Saved Extension History",
    icon: FolderOpen,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/projects</Badge>. View all extensions you've generated and saved to your account. <strong className="text-foreground">Requires sign-in.</strong></p>
        <h4 className="font-semibold text-foreground mt-2">Project Cards</h4>
        <p>Each project card shows:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Name &amp; description</strong> of the extension.</li>
          <li><strong className="text-foreground">Status badge</strong> — draft, generated, tested, packaged, or published.</li>
          <li><strong className="text-foreground">Created date</strong> and file count.</li>
          <li><strong className="text-foreground">Permissions</strong> — up to 4 permission badges shown.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Actions per Project</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Edit</strong> — loads the project's spec and files into the Code Editor.</li>
          <li><strong className="text-foreground">Download</strong> — downloads the extension as a .zip file with icons.</li>
          <li><strong className="text-foreground">Delete</strong> — permanently removes the project from your account.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Empty State</h4>
        <p>If you have no projects, a prompt guides you to the Create Extension page.</p>
      </>
    ),
  },
  {
    id: "test",
    title: "11. Test Extension — Validation Engine",
    icon: TestTube2,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/test</Badge>. Runs automated tests against your generated extension to validate quality.</p>
        <h4 className="font-semibold text-foreground mt-2">Test Categories</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">Manifest Tests</strong> — validates JSON validity, Manifest V3, name/version/description fields, service worker config, popup action config.</li>
          <li><strong className="text-foreground">Permission Tests</strong> — checks permission count (≤5 pass, ≤10 warn, &gt;10 fail), flags dangerous permissions (webRequestBlocking, debugger, proxy), warns about &lt;all_urls&gt; host permissions.</li>
          <li><strong className="text-foreground">Security Tests</strong> — checks for custom Content Security Policy.</li>
          <li><strong className="text-foreground">Compliance Tests</strong> — validates description length (≥10 chars) and name length (≤45 chars) for Chrome Web Store.</li>
          <li><strong className="text-foreground">Code Tests</strong> — verifies required files exist (background.js, popup.html) with line counts.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Test Score</h4>
        <p>A percentage score is calculated: (passed tests ÷ total tests) × 100. The progress bar and summary badges (X passed, Y warnings, Z failed) give you a quick overview.</p>
        <h4 className="font-semibold text-foreground mt-2">AI Security Audit</h4>
        <p>If a security audit was performed during the Create Extension pipeline, it appears below the tests with a letter grade (A/B/C) and detailed findings with severity levels and recommendations.</p>
      </>
    ),
  },
  {
    id: "package",
    title: "12. Package Extension — Build & Download",
    icon: Package,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/package</Badge>. Review your extension package and download it as a .zip ready to load into Chrome.</p>
        <h4 className="font-semibold text-foreground mt-2">Package Overview</h4>
        <p>Three stat cards show: total file count, total lines of code, and package size in KB.</p>
        <h4 className="font-semibold text-foreground mt-2">AI Icon Generation</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Click <strong className="text-foreground">"AI Icons"</strong> to generate a custom icon for your extension using AI.</li>
          <li>The AI creates a base icon which is automatically resized to 16×16, 48×48, and 128×128 pixels.</li>
          <li>A preview section shows all three sizes.</li>
          <li>Click <strong className="text-foreground">"Regenerate"</strong> for a different icon design.</li>
          <li>If you skip AI icons, solid-color placeholder icons are used instead.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Package Contents</h4>
        <p>A file list shows every file in the package with line count and size in KB.</p>
        <h4 className="font-semibold text-foreground mt-2">Download</h4>
        <p>Click <strong className="text-foreground">"Download .zip"</strong> to get the complete Chrome extension package. The .zip is structured correctly for Chrome's "Load unpacked" developer mode.</p>
      </>
    ),
  },
  {
    id: "publish",
    title: "13. Publish Assistant — Chrome Store Listing",
    icon: Upload,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/publish</Badge>. Generate all the assets you need to publish your extension to the Chrome Web Store.</p>
        <h4 className="font-semibold text-foreground mt-2">Generate Store Assets</h4>
        <p>Click <strong className="text-foreground">"Generate Store Assets"</strong> to have AI create:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Store Title</strong> — optimized for search visibility.</li>
          <li><strong className="text-foreground">Summary</strong> — short tagline for the store listing.</li>
          <li><strong className="text-foreground">Category</strong> — suggested Chrome Web Store category.</li>
          <li><strong className="text-foreground">SEO Keywords</strong> — keyword badges for discoverability.</li>
          <li><strong className="text-foreground">Full Description</strong> — editable store description (can be modified in the text area).</li>
          <li><strong className="text-foreground">Privacy Policy</strong> — auto-generated, editable privacy policy text.</li>
          <li><strong className="text-foreground">Terms of Use</strong> — auto-generated terms document.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Copy Buttons</h4>
        <p>Every generated text has a copy button for easy pasting into the Chrome Developer Dashboard.</p>
        <h4 className="font-semibold text-foreground mt-2">Publishing Checklist</h4>
        <p>A checklist tracks your readiness: extension package, store description, privacy policy, icons, screenshots, and SEO keywords. Items turn green as they're completed.</p>
        <h4 className="font-semibold text-foreground mt-2">How to Publish (Step-by-Step)</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Download your .zip from the Code Editor or Package page.</li>
          <li>Go to the Chrome Developer Dashboard.</li>
          <li>Pay the $5 one-time developer registration fee.</li>
          <li>Click "New Item" and upload your .zip.</li>
          <li>Fill in the store listing using the generated assets.</li>
          <li>Add your privacy policy URL and submit for review.</li>
        </ol>
      </>
    ),
  },
  {
    id: "api-manager",
    title: "14. API Manager — Manage Integration Keys",
    icon: Plug,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/api-manager</Badge>. Store and manage API keys for services your extensions integrate with.</p>
        <h4 className="font-semibold text-foreground mt-2">Supported Services</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">OpenAI</strong> — GPT models for AI-powered features.</li>
          <li><strong className="text-foreground">Google</strong> — YouTube, Maps, and other Google APIs.</li>
          <li><strong className="text-foreground">NVIDIA NIM</strong> — NVIDIA inference microservices.</li>
          <li><strong className="text-foreground">Twitter/X</strong> — Twitter API for social features.</li>
          <li><strong className="text-foreground">Custom REST API</strong> — any REST API endpoint.</li>
        </ul>
        <p>Each service card includes a link to the provider's API key/console page.</p>
        <h4 className="font-semibold text-foreground mt-2">Adding a Key</h4>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Select the service from the dropdown.</li>
          <li>Enter a label (e.g., "My OpenAI Key").</li>
          <li>Paste your API key.</li>
          <li>Click <strong className="text-foreground">"Add Key"</strong>.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-2">Managing Keys</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Show/Hide</strong> — toggle key visibility with the eye icon.</li>
          <li><strong className="text-foreground">Delete</strong> — remove a stored key.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">⚠️ Storage Note</h4>
        <p>Keys are stored in your browser's localStorage. They are NOT uploaded to any server. For production extensions, store API keys securely in your extension's backend or environment variables.</p>
      </>
    ),
  },
  {
    id: "portfolio",
    title: "15. Portfolio — Extension Network Overview",
    icon: Briefcase,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/portfolio</Badge>. A high-level view of your extension portfolio organized by category. <strong className="text-foreground">Requires sign-in.</strong></p>
        <h4 className="font-semibold text-foreground mt-2">Stats Cards</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Total Extensions</strong> — all extensions in your account.</li>
          <li><strong className="text-foreground">Published</strong> — extensions marked as published.</li>
          <li><strong className="text-foreground">In Development</strong> — draft-status extensions.</li>
          <li><strong className="text-foreground">Categories</strong> — number of categories your extensions span.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Category Groups</h4>
        <p>Extensions are auto-categorized based on their name and description into: YouTube Tools, Productivity, SEO Tools, AI Assistants, E-commerce, Automation, and Other. Each category shows a card grid of extensions. Click any extension to open it in the Code Editor.</p>
      </>
    ),
  },
  {
    id: "revenue",
    title: "16. Revenue Tracker — Analytics & Projections",
    icon: BarChart3,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/revenue</Badge>. Portfolio-level analytics with revenue projections. <strong className="text-foreground">Requires sign-in.</strong></p>
        <h4 className="font-semibold text-foreground mt-2">⚠️ Simulated Data</h4>
        <p>All analytics are <strong className="text-foreground">estimated projections</strong> based on your real project count. A "Simulated" badge is shown. Actual revenue depends on real Chrome Web Store performance.</p>
        <h4 className="font-semibold text-foreground mt-2">Metrics</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Extensions</strong> — total count.</li>
          <li><strong className="text-foreground">Est. Installs</strong> — projected based on ~1,250 per extension.</li>
          <li><strong className="text-foreground">Active Users</strong> — ~20% of installs.</li>
          <li><strong className="text-foreground">Premium Users</strong> — ~3% conversion rate.</li>
          <li><strong className="text-foreground">Est. MRR</strong> — monthly recurring revenue at $6/premium user.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Charts</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Revenue Growth</strong> — 6-month bar chart showing projected revenue growth.</li>
          <li><strong className="text-foreground">Category Split</strong> — pie chart showing distribution across categories.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Extension Performance Table</h4>
        <p>Top 10 extensions listed with: name, installs, active users, premium users, MRR, and star rating (all simulated).</p>
      </>
    ),
  },
  {
    id: "monetization",
    title: "17. Monetization Templates — Revenue Code Patterns",
    icon: DollarSign,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/monetization</Badge>. Drop-in code templates for adding revenue to your extensions.</p>
        <h4 className="font-semibold text-foreground mt-2">Available Templates</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Freemium Subscription</strong> — Premium feature gating with license key validation. Includes upgrade popup UI. Revenue: $5–$10/user/month. Difficulty: Medium.
          </li>
          <li>
            <strong className="text-foreground">API Usage Billing</strong> — Tracks API calls per day with free tier limits. Great for AI-powered extensions. Revenue: $3–$8/user/month. Difficulty: Medium.
          </li>
          <li>
            <strong className="text-foreground">Affiliate Revenue</strong> — Injects affiliate tags into product links (Amazon, etc.). Revenue: $1–$5/user/month. Difficulty: Easy.
          </li>
          <li>
            <strong className="text-foreground">Lightweight Ads</strong> — Non-intrusive banner ad rotation in popup UI. Revenue: $0.50–$2/user/month. Difficulty: Easy.
          </li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">How to Use</h4>
        <p>Each template shows the source code in tabbed views (one tab per file). Click the copy button on any file to copy the code, then paste it into your extension via the Code Editor.</p>
      </>
    ),
  },
  {
    id: "store-seo",
    title: "18. Store SEO Optimizer — Maximize Visibility",
    icon: Search,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/store-seo</Badge>. AI-powered tool to optimize your Chrome Web Store listing for maximum search visibility.</p>
        <h4 className="font-semibold text-foreground mt-2">Input Fields</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Extension Name</strong> — your extension's name.</li>
          <li><strong className="text-foreground">Description</strong> — what your extension does.</li>
          <li><strong className="text-foreground">Key Features</strong> — comma-separated list of features.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">AI-Generated Output</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Optimized Title</strong> — SEO-optimized title with character count (max 45).</li>
          <li><strong className="text-foreground">Short Summary</strong> — tagline with character count (max 132).</li>
          <li><strong className="text-foreground">SEO Keywords</strong> — keyword badges for your listing.</li>
          <li><strong className="text-foreground">Full Description</strong> — complete store description.</li>
          <li><strong className="text-foreground">SEO Tips</strong> — numbered actionable tips to improve ranking.</li>
        </ul>
        <p>Every output has a copy button for quick pasting into the Chrome Developer Dashboard.</p>
      </>
    ),
  },
  {
    id: "settings",
    title: "19. Settings — Configure Your Environment",
    icon: Settings,
    content: (
      <>
        <p>Navigate to <Badge variant="secondary" className="font-mono text-[10px]">/settings</Badge>. Configure platform-wide preferences.</p>
        <h4 className="font-semibold text-foreground mt-2">AI Agent Settings</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Auto-Debug Mode</strong> — when ON, the AI automatically attempts to fix errors in generated code.</li>
          <li><strong className="text-foreground">Smart Permission Detection</strong> — when ON, the system automatically detects and minimizes required permissions.</li>
          <li><strong className="text-foreground">Notifications</strong> — when ON, you get toast notifications when the agent pipeline completes.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">About</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Version: 1.0.0</li>
          <li>AI Model: gemini-3-flash</li>
          <li>Manifest Version: V3</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Data Management</h4>
        <p><strong className="text-foreground">"Clear Session Data"</strong> — removes all temporary session data (current extension files, spec, audit results) from your browser. Does NOT delete saved projects from the database.</p>
      </>
    ),
  },
  {
    id: "sidebar",
    title: "20. Sidebar Navigation — Getting Around",
    icon: ArrowRight,
    content: (
      <>
        <p>The collapsible sidebar on the left organizes all modules into four groups:</p>
        <h4 className="font-semibold text-foreground mt-2">Factory</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Dashboard — home screen with stats and quick actions.</li>
          <li>Trend Discovery — AI market analysis.</li>
          <li>Create Extension — autonomous pipeline.</li>
          <li>AI Builder — conversational assistant.</li>
          <li>Batch Queue — mass generation.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Revenue</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Portfolio — extension network overview.</li>
          <li>Revenue Tracker — analytics &amp; projections.</li>
          <li>Monetization — revenue code templates.</li>
          <li>Store SEO — listing optimizer.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Tools</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Projects — saved extension history.</li>
          <li>Code Editor — Monaco-based file editor.</li>
          <li>Templates — pre-built extension patterns.</li>
          <li>API Manager — API key storage.</li>
          <li>Test Extension — validation engine.</li>
          <li>Package — build &amp; download .zip.</li>
          <li>Publish — Chrome Store assets.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">System</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Settings — preferences and data management.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-2">Collapsing</h4>
        <p>The sidebar can be collapsed to icon-only mode for more screen space. The toggle is at the top of the sidebar.</p>
      </>
    ),
  },
  {
    id: "workflow",
    title: "21. Recommended Workflow — End-to-End",
    icon: Shield,
    content: (
      <>
        <p>Here's the recommended workflow for going from idea to published Chrome extension:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong className="text-foreground">Sign Up / Sign In</strong> — Create an account to persist your work.</li>
          <li><strong className="text-foreground">Discover Trends</strong> — Use Trend Discovery to find a profitable niche. Click "Build" on a promising opportunity.</li>
          <li><strong className="text-foreground">Create Extension</strong> — The idea is pre-filled. Launch the agent pipeline. Wait for all 6 stages to complete.</li>
          <li><strong className="text-foreground">Review Code</strong> — Open in the Code Editor. Review manifest.json, popup, background scripts. Make any edits.</li>
          <li><strong className="text-foreground">Run Tests</strong> — Go to Test Extension. Run all tests. Fix any failures.</li>
          <li><strong className="text-foreground">Generate Icons</strong> — Go to Package. Click "AI Icons" for a professional icon. Download the .zip.</li>
          <li><strong className="text-foreground">Test in Chrome</strong> — Open chrome://extensions, enable Developer Mode, click "Load unpacked", select your extracted .zip folder.</li>
          <li><strong className="text-foreground">Generate Store Assets</strong> — Go to Publish Assistant. Generate store description, privacy policy, and SEO keywords.</li>
          <li><strong className="text-foreground">Optimize SEO</strong> — Use Store SEO to refine your title and description for maximum visibility.</li>
          <li><strong className="text-foreground">Add Monetization</strong> — Browse Monetization Templates. Copy relevant code into your extension via the Code Editor.</li>
          <li><strong className="text-foreground">Publish</strong> — Follow the publishing guide to submit to the Chrome Web Store.</li>
          <li><strong className="text-foreground">Track Performance</strong> — Use Revenue Tracker to monitor projections and Portfolio to manage your extension network.</li>
        </ol>
      </>
    ),
  },
  {
    id: "tips",
    title: "22. Tips & Troubleshooting",
    icon: Zap,
    content: (
      <>
        <h4 className="font-semibold text-foreground">Common Issues</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">"Payment required" error</strong> — AI credits are exhausted. The platform will use fallback data where possible. Wait for credits to replenish.</li>
          <li><strong className="text-foreground">Rate limiting</strong> — The system auto-retries up to 3 times with increasing delays. If it still fails, wait a few minutes and try again.</li>
          <li><strong className="text-foreground">Extension not loading in Chrome</strong> — Make sure you extracted the .zip first. Chrome needs a folder, not a .zip file. Check chrome://extensions for error messages.</li>
          <li><strong className="text-foreground">Missing files in editor</strong> — Click "Reset" in the Code Editor to regenerate all files from the spec.</li>
          <li><strong className="text-foreground">Session data lost</strong> — If you refreshed the page, session data may be cleared. Use a signed-in account to persist projects to the database.</li>
        </ul>
        <h4 className="font-semibold text-foreground mt-4">Best Practices</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>Be specific in your extension idea — mention target websites, specific features, and APIs.</li>
          <li>Always run the Testing Engine before loading into Chrome.</li>
          <li>Review the manifest.json permissions — remove any you don't actually need.</li>
          <li>Use the minimum necessary host permissions (avoid &lt;all_urls&gt; if possible).</li>
          <li>Generate AI icons for a professional look before publishing.</li>
          <li>Run Store SEO optimization to maximize your Chrome Web Store ranking.</li>
          <li>Sign in to save all your work — session storage is temporary.</li>
        </ul>
      </>
    ),
  },
];

export default function UserManual() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-gradient-cyber flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Manual</h1>
            <p className="text-sm text-muted-foreground">
              Complete guide to every feature in Extension Forge AI
            </p>
          </div>
        </div>
      </motion.div>

      <div className="rounded-xl border border-primary/20 bg-card p-4 text-sm text-muted-foreground">
        <p>Click any section below to expand it. This manual covers all {sections.length} modules, the recommended workflow, and troubleshooting tips.</p>
      </div>

      <div className="space-y-2">
        {sections.map((section, i) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
          >
            <SectionBlock section={section} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
