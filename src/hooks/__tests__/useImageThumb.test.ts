import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useImageThumb, _testing } from "../useImageThumb";

vi.mock("../../lib/tauri", () => ({
  readImageBase64: vi.fn(async (path: string) => `b64-of-${path}`),
  readImageThumbnail: vi.fn(
    async (path: string, dim: number) => `data:image/png;base64,thumb-${path}-${dim}`,
  ),
}));

describe("useImageThumb cache routing", () => {
  beforeEach(() => {
    _testing.thumbCache.clear();
    _testing.previewCache.clear();
    _testing.pendingLoads.clear();
  });

  it("does not store full-size results in thumbCache", async () => {
    const { result } = renderHook(() => useImageThumb("/img/a.png", null));
    await waitFor(() => expect(result.current).toBeTruthy());

    expect(_testing.thumbCache.size).toBe(0);
    expect(_testing.previewCache.size).toBe(1);
  });

  it("previewCache holds only the most recent full-size", async () => {
    const { rerender, result } = renderHook(({ p }) => useImageThumb(p, null), {
      initialProps: { p: "/img/a.png" },
    });
    await waitFor(() => expect(result.current).toBeTruthy());

    rerender({ p: "/img/b.png" });
    await waitFor(() => expect(result.current).toMatch(/b\.png/));

    rerender({ p: "/img/c.png" });
    await waitFor(() => expect(result.current).toMatch(/c\.png/));

    expect(_testing.previewCache.size).toBe(1);
    expect([..._testing.previewCache.keys()][0]).toBe("/img/c.png");
  });

  it("thumbnails go into thumbCache, not previewCache", async () => {
    const { result } = renderHook(() => useImageThumb("/img/a.png", 96));
    await waitFor(() => expect(result.current).toBeTruthy());

    expect(_testing.thumbCache.size).toBe(1);
    expect(_testing.previewCache.size).toBe(0);
  });

  it("does not return a stale image when path changes before load resolves", async () => {
    // Load A and let it complete so it's cached.
    const { rerender, result } = renderHook(({ p }) => useImageThumb(p, 96), {
      initialProps: { p: "/img/a.png" },
    });
    await waitFor(() => expect(result.current).toMatch(/a\.png/));

    // Switch to B — B is NOT cached yet. The hook must NOT keep returning A.
    // Until B's load resolves, the result should be null (placeholder), then
    // the new B src.
    rerender({ p: "/img/b.png" });

    // Eventually returns B's src
    await waitFor(() => expect(result.current).toMatch(/b\.png/));
    // And does NOT match A any more
    expect(result.current).not.toMatch(/a\.png/);
  });
});
