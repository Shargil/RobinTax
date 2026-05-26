import type { Page } from "playwright-core";

export type StepFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

export interface FlowDeps {
  step: StepFn;
  explain: (reason: string) => void;
  confirm: (action: string, reason: string) => Promise<boolean>;
  outDir: string;
}

export interface Flow {
  domain: string;
  intent: string;
  run: (page: Page, deps: FlowDeps) => Promise<void>;
}

// Errors thrown from inside a step() get these fields attached so the
// runner / future heal-back path knows which step blew up.
export interface StepError extends Error {
  stepName?: string;
  stepIndex?: number;
}
