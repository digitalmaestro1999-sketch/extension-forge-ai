// Small persistence helper for saving user work into `extension_projects`.
// Every module that mutates files (Import, Clone, Editor Save, Naming Studio,
// Wizard finish) should route through here so history/analytics stay honest.
import { supabase } from "@/integrations/supabase/client";

export type PersistProjectInput = {
  id?: string | null;
  userId: string;
  name: string;
  description?: string;
  spec?: Record<string, unknown>;
  files: Record<string, string>;
  status?: "draft" | "generated" | "tested" | "packaged" | "published";
  source: "imported" | "cloned" | "editor" | "wizard" | "intel-scan" | "generated";
  extras?: Record<string, unknown>; // free-form metadata stored inside `spec`
};

export type PersistProjectResult = { id: string };

/** Upsert a project row. If `id` is provided we UPDATE; else INSERT and return the new id. */
export async function persistProject(input: PersistProjectInput): Promise<PersistProjectResult> {
  const spec = {
    source: input.source,
    ...(input.spec ?? {}),
    ...(input.extras ?? {}),
  } as Record<string, unknown>;

  if (input.id) {
    const { error } = await supabase
      .from("extension_projects")
      .update({
        name: input.name,
        description: input.description ?? null,
        spec: spec as never,
        files: input.files as never,
        status: input.status ?? "draft",
      })
      .eq("id", input.id)
      .eq("user_id", input.userId);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("extension_projects")
    .insert({
      user_id: input.userId,
      name: input.name,
      description: input.description ?? null,
      spec: spec as never,
      files: input.files as never,
      status: input.status ?? "draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Insert failed");
  return { id: data.id as string };
}
