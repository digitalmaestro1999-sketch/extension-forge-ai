export interface ExtensionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string[];
  permissions: string[];
  icon: string;
}

export const templates: ExtensionTemplate[] = [
  {
    id: "youtube-summary",
    name: "YouTube Summary AI",
    description: "Auto-summarize YouTube videos with AI, highlight key moments, and save notes.",
    category: "AI Assistants",
    features: ["Auto summarize videos", "Highlight key moments", "Save notes", "Export summaries"],
    permissions: ["activeTab", "storage"],
    icon: "🎬",
  },
  {
    id: "tab-manager",
    name: "Smart Tab Manager",
    description: "Organize, group, and manage browser tabs with AI-powered categorization.",
    category: "Productivity Tools",
    features: ["Auto-group tabs", "Tab search", "Session save/restore", "Memory optimization"],
    permissions: ["tabs", "storage"],
    icon: "📑",
  },
  {
    id: "web-scraper",
    name: "Data Scraper Pro",
    description: "Extract structured data from any webpage with customizable selectors.",
    category: "Scrapers",
    features: ["CSS selector builder", "JSON/CSV export", "Scheduled scraping", "Data preview"],
    permissions: ["activeTab", "storage", "downloads"],
    icon: "🕷️",
  },
  {
    id: "seo-analyzer",
    name: "SEO Analyzer",
    description: "Analyze any webpage's SEO performance with actionable insights.",
    category: "SEO Tools",
    features: ["Meta tag analysis", "Heading structure", "Image alt check", "Performance score"],
    permissions: ["activeTab", "storage"],
    icon: "📊",
  },
  {
    id: "twitter-tools",
    name: "Twitter Power Tools",
    description: "Enhanced Twitter experience with thread reader, bookmark manager, and analytics.",
    category: "Twitter Tools",
    features: ["Thread unroller", "Bookmark organizer", "Tweet scheduler", "Analytics dashboard"],
    permissions: ["activeTab", "storage", "alarms"],
    icon: "🐦",
  },
  {
    id: "password-gen",
    name: "Secure Password Generator",
    description: "Generate and manage strong passwords with clipboard integration.",
    category: "Security",
    features: ["Custom password rules", "Clipboard copy", "Password strength meter", "History"],
    permissions: ["storage", "clipboardWrite"],
    icon: "🔐",
  },
];

export const categories = [...new Set(templates.map((t) => t.category))];
