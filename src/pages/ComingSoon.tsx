import { motion } from "framer-motion";
import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/api-manager": "API Manager",
  "/test": "Test Extension",
  "/package": "Package Extension",
  "/publish": "Publish to Chrome Store",
  "/settings": "Settings",
};

export default function ComingSoon() {
  const location = useLocation();
  const title = titles[location.pathname] || "This Feature";

  return (
    <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
          <Construction className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground max-w-sm">
          This module is coming soon. We're building something amazing.
        </p>
      </motion.div>
    </div>
  );
}
