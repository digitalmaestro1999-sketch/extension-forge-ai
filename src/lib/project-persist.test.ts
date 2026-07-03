import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client BEFORE importing the module under test.
// Each test provides its own `.from()` implementation via `fromMock`.
const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { persistProject } from "./project-persist";

/** Builder for the chainable Supabase query mock. */
function buildInsertChain(returned: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(returned);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { insert, select, single, from: vi.fn(() => ({ insert })) };
}

function buildUpdateChain(returned: { error: unknown }) {
  const eq2 = vi.fn().mockResolvedValue(returned);
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const update = vi.fn(() => ({ eq: eq1 }));
  return { update, eq1, eq2, from: vi.fn(() => ({ update })) };
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("persistProject — insert paths", () => {
  it("import: inserts a new row and returns the new id", async () => {
    const chain = buildInsertChain({ data: { id: "new-id-1" }, error: null });
    fromMock.mockImplementation(chain.from);

    const result = await persistProject({
      userId: "user-1",
      name: "Imported Ext",
      description: "from a zip",
      files: { "manifest.json": "{}", "background.js": "// noop" },
      source: "imported",
    });

    expect(result).toEqual({ id: "new-id-1" });
    expect(chain.from).toHaveBeenCalledWith("extension_projects");
    expect(chain.insert).toHaveBeenCalledTimes(1);
    const payload = chain.insert.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: "user-1",
      name: "Imported Ext",
      description: "from a zip",
      status: "draft",
    });
    // spec must record `source` provenance so History/analytics stay honest.
    expect((payload.spec as Record<string, unknown>).source).toBe("imported");
    expect(payload.files).toEqual({ "manifest.json": "{}", "background.js": "// noop" });
  });

  it("clone: forwards status override and merges extras into spec", async () => {
    const chain = buildInsertChain({ data: { id: "clone-1" }, error: null });
    fromMock.mockImplementation(chain.from);

    await persistProject({
      userId: "user-42",
      name: "Cloned Ext",
      files: { "manifest.json": "{}" },
      source: "cloned",
      status: "generated",
      extras: { origin: "chrome-store", originalId: "abc123" },
      spec: { version: "1.2.3" },
    });

    const payload = chain.insert.mock.calls[0][0];
    expect(payload.status).toBe("generated");
    const spec = payload.spec as Record<string, unknown>;
    expect(spec.source).toBe("cloned");
    expect(spec.version).toBe("1.2.3");
    expect(spec.origin).toBe("chrome-store");
    expect(spec.originalId).toBe("abc123");
  });

  it("wizard-finish: passes the generated status and description through", async () => {
    const chain = buildInsertChain({ data: { id: "wiz-1" }, error: null });
    fromMock.mockImplementation(chain.from);

    const files = {
      "manifest.json": '{"manifest_version":3}',
      "popup.html": "<html></html>",
      "background.js": "// sw",
    };
    const out = await persistProject({
      userId: "user-7",
      name: "Wizard Output",
      description: "3-step wizard result",
      files,
      spec: { permissions: ["storage"] },
      status: "generated",
      source: "wizard",
    });

    expect(out.id).toBe("wiz-1");
    const payload = chain.insert.mock.calls[0][0];
    expect(payload.status).toBe("generated");
    expect(payload.description).toBe("3-step wizard result");
    expect(payload.files).toBe(files);
    expect((payload.spec as Record<string, unknown>).source).toBe("wizard");
  });

  it("throws when the insert returns no row and no error", async () => {
    const chain = buildInsertChain({ data: null, error: null });
    fromMock.mockImplementation(chain.from);

    await expect(
      persistProject({
        userId: "u",
        name: "n",
        files: {},
        source: "imported",
      })
    ).rejects.toThrow(/insert failed/i);
  });

  it("propagates the database error message on insert failure", async () => {
    const chain = buildInsertChain({ data: null, error: { message: "duplicate name" } });
    fromMock.mockImplementation(chain.from);

    await expect(
      persistProject({
        userId: "u", name: "n", files: {}, source: "generated",
      })
    ).rejects.toThrow("duplicate name");
  });
});

describe("persistProject — update paths", () => {
  it("editor-save: updates the existing row scoped to (id, user_id)", async () => {
    const chain = buildUpdateChain({ error: null });
    fromMock.mockImplementation(chain.from);

    const result = await persistProject({
      id: "row-abc",
      userId: "user-9",
      name: "Edited Ext",
      files: { "popup.js": "console.log('saved')" },
      source: "editor",
      status: "draft",
    });

    expect(result).toEqual({ id: "row-abc" });
    expect(chain.update).toHaveBeenCalledTimes(1);
    // The RLS-safe update MUST filter by both id and user_id, in that order.
    expect(chain.eq1).toHaveBeenCalledWith("id", "row-abc");
    expect(chain.eq2).toHaveBeenCalledWith("user_id", "user-9");
    const payload = chain.update.mock.calls[0][0];
    expect(payload.name).toBe("Edited Ext");
    expect(payload.files).toEqual({ "popup.js": "console.log('saved')" });
  });

  it("throws when the update reports an error", async () => {
    const chain = buildUpdateChain({ error: { message: "row locked" } });
    fromMock.mockImplementation(chain.from);

    await expect(
      persistProject({
        id: "row-1", userId: "u", name: "n", files: {}, source: "editor",
      })
    ).rejects.toThrow("row locked");
  });
});
