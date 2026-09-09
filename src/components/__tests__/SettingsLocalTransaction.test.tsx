import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "../Settings";
import { TransformMenu } from "../TransformMenu";
import { defaultSettings, keySettingsProps, makeEntry } from "../../test/fixtures";
import { loadSettings, saveSettings, type AppSettings } from "../../lib/settings";
import { en } from "../../lib/i18n";
import { submitJob } from "../../lib/tauri";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function Harness({ initial }: { initial: AppSettings }) {
  const [settings, setSettings] = useState(initial);
  const [open, setOpen] = useState(true);
  return open ? (
    <Settings
      {...keySettingsProps()}
      settings={settings}
      onClose={() => setOpen(false)}
      onSave={(next) => {
        if (!saveSettings(next)) throw new Error("Settings persistence failed");
        setSettings(next);
        setOpen(false);
      }}
    />
  ) : (
    <TransformMenu
      item={makeEntry(1)}
      contentType="text"
      onApply={vi.fn()}
      onClose={vi.fn()}
      submitJob={submitJob}
      aiPrompts={[{ id: "fixture", name: "Summarize", prompt: "Summarize" }]}
      aiConfig={{ provider: "local", hasKey: keySettingsProps().keyStatuses, ...settings }}
    />
  );
}

async function openAI(initial: Partial<AppSettings> = {}) {
  const view = render(
    <Harness initial={{ ...defaultSettings(), aiProvider: "local", ...initial }} />,
  );
  await act(async () => {
    fireEvent.click(within(view.container).getByRole("tab", { name: "AI" }));
  });
  return view;
}

describe("local settings transaction", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(invoke)
      .mockReset()
      .mockImplementation(async (command) => {
        if (command === "test_local_endpoint") return { ok: true, model: "first-model" };
        if (command === "list_local_models") return ["first-model", "chosen-model"];
        if (command === "db_get_item") return makeEntry(1);
        if (command === "submit_job") return 1;
        return {};
      });
  });

  it.each([true, false])(
    "uses one endpoint through Test(%s), Save, transform and reload",
    async (testFirst) => {
      const { container } = await openAI({ localEndpoint: "localhost:4321/" });
      if (testFirst)
        await act(async () => {
          fireEvent.click(
            within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
          );
        });
      await act(async () => {
        fireEvent.click(within(container).getByRole("button", { name: "Save" }));
      });
      await act(async () => {
        fireEvent.click(within(container).getByRole("button", { name: /Summarize/ }));
      });
      expect(invoke).toHaveBeenCalledWith("submit_job", {
        params: expect.objectContaining({ endpoint: "http://localhost:4321/" }),
      });
      expect(loadSettings().localEndpoint).toBe("http://localhost:4321/");
      if (testFirst)
        expect(invoke).toHaveBeenCalledWith("test_local_endpoint", {
          endpoint: "http://localhost:4321/",
        });
    },
  );

  it.each([
    "https://example.com",
    "http://user@localhost:4321",
    "ftp://localhost",
    "not a url",
    `localhost:4321/${"x".repeat(183)}`,
  ])("rejects invalid endpoint %s without saving or testing it", async (endpoint) => {
    const { container } = await openAI({ localEndpoint: endpoint });
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    expect(invoke).not.toHaveBeenCalledWith("test_local_endpoint", expect.anything());
    await act(async () => {
      fireEvent.click(within(container).getByRole("button", { name: "Save" }));
    });
    expect(within(container).getByRole("alert")).toHaveTextContent(/endpoint/i);
    expect(within(container).getByRole("button", { name: "Save" })).toBeEnabled();
    expect(loadSettings().localEndpoint).toBe("http://127.0.0.1:1234");
  });

  it.each(["chosen-model", "", "missing-model"])(
    "keeps an installed choice or discovers a missing choice: %j",
    async (model) => {
      const { container } = await openAI({
        localEndpoint: "http://127.0.0.1:11434",
        localModel: model,
      });
      await act(async () => {
        fireEvent.click(
          within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
        );
      });
      expect(within(container).getByLabelText(en["settings.localModel"])).toHaveValue(
        model === "chosen-model" ? "chosen-model" : "first-model",
      );
    },
  );

  it("does not replace the selected model when listing fails", async () => {
    const { container } = await openAI({
      localEndpoint: "http://127.0.0.1:11434",
      localModel: "chosen-model",
    });
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "test_local_endpoint") return { ok: true, model: "first-model" };
      if (command === "list_local_models") throw new Error("list unavailable");
      return {};
    });
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    expect(within(container).getByLabelText(en["settings.localModel"])).toHaveValue("chosen-model");
  });

  it.each([
    ["http://127.0.0.1:11434/", "http://127.0.0.1:11434/"],
    ["localhost:11434", "http://localhost:11434"],
    ["http://[::1]:11434", "http://[::1]:11434"],
    ["http://127.0.0.1:4321", "http://127.0.0.1:4321"],
  ])("preserves model choices after saving and reloading %s", async (endpoint, canonical) => {
    const first = await openAI({ localEndpoint: endpoint, localModel: "chosen-model" });
    await act(async () => {
      fireEvent.click(within(first.container).getByRole("button", { name: "Save" }));
    });
    expect(loadSettings().localEndpoint).toBe(canonical);
    first.unmount();
    const { container } = await openAI(loadSettings());
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    expect(within(container).getByLabelText(en["settings.localModel"])).toHaveValue("chosen-model");
    expect(invoke).toHaveBeenCalledWith("list_local_models", { endpoint: canonical });
    await act(async () => {
      fireEvent.click(within(container).getByRole("button", { name: "Save" }));
    });
    expect(loadSettings().localModel).toBe("chosen-model");
    expect(loadSettings().localEndpoint).toBe(canonical);
  });

  it.each(["chosen-model", "", "missing-model"])(
    "retains %j when a custom endpoint model list fails after reload",
    async (model) => {
      const first = await openAI({ localEndpoint: "http://localhost:4321/", localModel: model });
      await act(async () => {
        fireEvent.click(within(first.container).getByRole("button", { name: "Save" }));
      });
      first.unmount();
      const { container } = await openAI(loadSettings());
      vi.mocked(invoke).mockImplementation(async (command) => {
        if (command === "test_local_endpoint") return { ok: true, model: "first-model" };
        if (command === "list_local_models") throw new Error("list unavailable");
        return {};
      });
      await act(async () => {
        fireEvent.click(
          within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
        );
      });
      expect(within(container).getByLabelText(en["settings.localModel"])).toHaveValue(model);
      expect(invoke).toHaveBeenCalledWith("list_local_models", {
        endpoint: "http://localhost:4321/",
      });
      await act(async () => {
        fireEvent.click(within(container).getByRole("button", { name: "Save" }));
      });
      expect(loadSettings().localModel).toBe(model);
    },
  );

  it.each(["", "missing-model"])(
    "discovers an available custom endpoint model for %j",
    async (model) => {
      const { container } = await openAI({
        localEndpoint: "http://localhost:4321",
        localModel: model,
      });
      await act(async () => {
        fireEvent.click(
          within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
        );
      });
      expect(within(container).getByLabelText(en["settings.localModel"])).toHaveValue(
        "first-model",
      );
    },
  );

  it("ignores an older Test after a preset change and a newer Test", async () => {
    const old = deferred<{ ok: boolean; model: string }>();
    const { container } = await openAI({
      localEndpoint: "http://127.0.0.1:11434",
      localModel: "chosen-model",
    });
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "test_local_endpoint")
        return (args as { endpoint: string }).endpoint.includes("11434")
          ? old.promise
          : { ok: true, model: "new-server-model" };
      if (command === "list_local_models")
        return (args as { endpoint: string }).endpoint.includes("11434")
          ? ["old-server-model"]
          : ["new-server-model"];
      return {};
    });
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    await act(async () => {
      fireEvent.click(within(container).getByRole("radio", { name: "LM Studio" }));
    });
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: en["settings.localTestConnect"] }),
      );
    });
    await act(async () => {
      old.resolve({ ok: true, model: "old-server-model" });
    });
    expect(container.querySelector(".settings__ai-model-info")).toHaveTextContent(
      "new-server-model",
    );
  });
});
