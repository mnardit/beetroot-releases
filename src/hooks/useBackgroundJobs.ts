import { useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { submitJob as submitJobIpc, cancelJob as cancelJobIpc } from "../lib/tauri";
import type { SubmitJobParams } from "../lib/tauri";
import type { TFunction } from "../lib/i18n";

export interface JobCompletedPayload {
  id: number;
  result: string;
  source: string;
  prompt_name: string;
  /** True if Rust already sent a native notification (window was hidden). */
  notified: boolean;
}

interface JobFailedPayload {
  id: number;
  error: string;
  prompt_name: string;
  /** True if Rust already sent a native notification (window was hidden). */
  notified: boolean;
}

interface UseBackgroundJobsDeps {
  showInfo: (text: string, action?: { label: string; onClick: () => void }) => void;
  showError: (text: string) => void;
  t: TFunction;
  onJobCompleted?: (payload: JobCompletedPayload) => void;
}

export function useBackgroundJobs({
  showInfo,
  showError,
  t,
  onJobCompleted,
}: UseBackgroundJobsDeps) {
  const onJobCompletedRef = useRef(onJobCompleted);
  const tRef = useRef(t);
  // Toast callbacks accessed via refs so the listener effect doesn't
  // re-register on every parent render (which would briefly run two
  // concurrent Tauri listeners and produce duplicate toasts).
  const showInfoRef = useRef(showInfo);
  const showErrorRef = useRef(showError);
  useEffect(() => {
    onJobCompletedRef.current = onJobCompleted;
    tRef.current = t;
    showInfoRef.current = showInfo;
    showErrorRef.current = showError;
  });

  useEffect(() => {
    let mounted = true;

    const setupListeners = async () => {
      const unlistenCompleted = await listen<JobCompletedPayload>("job-completed", (event) => {
        if (!mounted) return;
        const { prompt_name, notified } = event.payload;
        // Rust sends native notification when hidden — only show toast if not already notified
        if (!notified) {
          showInfoRef.current(tRef.current("toast.aiCompleted", { name: prompt_name }));
        }
        onJobCompletedRef.current?.(event.payload);
      });

      const unlistenFailed = await listen<JobFailedPayload>("job-failed", (event) => {
        if (!mounted) return;
        const { prompt_name, error, notified } = event.payload;
        if (!notified) {
          showErrorRef.current(tRef.current("toast.aiFailed", { name: prompt_name, error }));
        }
      });

      return () => {
        unlistenCompleted();
        unlistenFailed();
      };
    };

    let cleanup: (() => void) | undefined;
    setupListeners().then((fn) => {
      if (mounted) cleanup = fn;
      else fn();
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  const submitJob = useCallback(async (params: SubmitJobParams): Promise<number | null> => {
    try {
      const jobId = await submitJobIpc(params);
      showInfoRef.current(tRef.current("toast.aiProcessing", { name: params.promptName }));
      return jobId;
    } catch (e) {
      // Enqueue failed (invalid endpoint, backend IPC error, malformed
      // payload). The `job-failed` event only fires for jobs that were
      // successfully queued, so the user would otherwise see no feedback.
      const msg = e instanceof Error ? e.message : String(e);
      showErrorRef.current(tRef.current("toast.aiFailed", { name: params.promptName, error: msg }));
      return null;
    }
  }, []);

  const cancelJob = useCallback(async (jobId: number): Promise<boolean> => {
    return cancelJobIpc(jobId);
  }, []);

  return { submitJob, cancelJob };
}
