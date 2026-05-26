import type { StepFn, StepError } from "./types.ts";

// Human-pacing delay range between steps. Sub-100ms inter-action timing is
// one of the clearest bot fingerprints — sites watch for constant-rate
// clicks, and gov.il + bank portals will throttle or challenge a session
// that clicks faster than a person can read. The jitter also lets the user
// follow along visually.
const HUMAN_DELAY_MIN_MS = 329;
const HUMAN_DELAY_MAX_MS = 661;

function humanDelay(): Promise<void> {
  const ms =
    HUMAN_DELAY_MIN_MS +
    Math.random() * (HUMAN_DELAY_MAX_MS - HUMAN_DELAY_MIN_MS);
  return new Promise((r) => setTimeout(r, ms));
}

// Per-run factory. The closure tracks a 1-based step counter so the runner
// can print "step 3 ✓" and so failures carry { stepName, stepIndex } for
// heal-back (later) to point at the right place in the flow file.
export function createStep(): StepFn {
  let i = 0;
  return async function step(name, fn) {
    i++;
    const idx = i;
    // Skip the delay on step 1 — no prior UI action to react to.
    if (idx > 1) {
      await humanDelay();
    }
    const label = `  ${String(idx).padStart(2)}. ${name}`;
    process.stdout.write(label);
    try {
      const result = await fn();
      process.stdout.write(" ✓\n");
      return result;
    } catch (err) {
      process.stdout.write(" ✗\n");
      const stepErr = err as StepError;
      if (!stepErr.stepName) stepErr.stepName = name;
      if (!stepErr.stepIndex) stepErr.stepIndex = idx;
      throw stepErr;
    }
  };
}
