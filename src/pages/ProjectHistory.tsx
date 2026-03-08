import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, Trash2, Download, Code2, Eye,
  Clock, CheckCircle2, Package, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { generateExtensionIcons } from "@/lib/generate-icons";

interface Project {
  id: string;
  name: string;
  description: string;
  spec: any;
  files: any;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generated: "bg-primary/20 text-primary",
  tested: "bg-accent/20 text-accent",
  packaged: "bg-warning/20 text-warning",
  published: "bg-primary/30 text-primary",
};

export default function ProjectHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("extension_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
        setLoading(false);
      });
  }, [user]);

  const openInEditor = (project: Project) => {
    sessionStorage.setItem("extension-spec", JSON.stringify(project.spec));
    sessionStorage.setItem("extension-files", JSON.stringify(project.files));
    navigate("/editor");
  };

  const downloadZip = async (project: Project) => {
    const zip = new JSZip();
    const files = project.files || {};
    Object.entries(files).forEach(([name, content]) => {
      if (typeof content === "string") {
        if (name.includes("/")) {
          const parts = name.split("/");
          const folder = zip.folder(parts[0]);
          folder?.file(parts.slice(1).join("/"), content);
        } else {
          zip.file(name, content);
        }
      }
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${project.name.toLowerCase().replace(/\s+/g, "-")}.zip`);
    toast.success("Downloaded!");
  };

  const deleteProject = async (id: string) => {
    await supabase.from("extension_projects").delete().eq("id", id);
    setProjects(prev => prev.filter(p => p.id !== id));
    toast.success("Project deleted");
  };

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">Sign In to View Projects</h2>
          <p className="text-sm text-muted-foreground mb-3">Your generated extensions are saved to your account</p>
          <Button onClick={() => navigate("/auth")} className="bg-gradient-cyber text-primary-foreground">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          Extension Projects
        </h1>
        <p className="text-muted-foreground mt-1">
          {projects.length} extension{projects.length !== 1 ? "s" : ""} generated
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No Projects Yet</h2>
          <p className="text-sm text-muted-foreground mb-3">Create your first extension using the autonomous agent</p>
          <Button onClick={() => navigate("/create")} className="bg-gradient-cyber text-primary-foreground">
            Create Extension
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                </div>
                <Badge className={`text-[10px] ${statusColors[project.status] || statusColors.draft}`}>
                  {project.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Clock className="h-3 w-3" />
                {new Date(project.created_at).toLocaleDateString()}
                <span>•</span>
                <span>{Object.keys(project.files || {}).length} files</span>
              </div>

              {project.spec?.permissions && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {(project.spec.permissions as string[]).slice(0, 4).map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openInEditor(project)} className="flex-1">
                  <Code2 className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadZip(project)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteProject(project.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
