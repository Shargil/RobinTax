# ADR-010: Explain the reason before any action; gate "very scary" actions on explicit consent

**Date:** 2026-05-22
**Status:** accepted

## Context

The Collector takes real-world actions on the user's machine and inside their accounts: relaunching their Chrome (which closes their tabs), navigating into their bank/email/ITA session, triggering downloads to disk. Even when the action is benign, all of these share one property — the user did not just click a button to start them. The same action that feels helpful *with* context reads as hostile *without* it.

[ADR-001](ADR-001-no-credential-proxy.md) and [ADR-009](ADR-009-user-owns-login-and-captcha.md) draw the line at the **credential** boundary. This ADR draws the line at the **action** boundary: even when no credential is touched, automated actions still need to be legible and, for the disruptive subset, gated.

## Decision

1. **Before any non-trivial action, state the reason in one sentence**, in the user's frame ("I need to relaunch Chrome with a debugger port so I can drive your existing session — otherwise the site sees us as a bot"). This applies to every step that is not a pure local read.
2. **For "very scary" actions, additionally require an explicit y/n consent** *before* the action runs. The current list of "very scary" actions:
   - Relaunching the user's Chrome (closes their open tabs / restarts their session).
   - Navigating to a banking, email, or government-credential page inside their session.
   - Triggering a download to disk.
3. **Don't re-ask within the same session for the same action.** After the first `y`, the action is authorized for the remainder of that run — but the one-sentence reason still prints each time so the user sees what is happening.

## Why

- The trust posture we are selling is "RobinTax helps; it does not surveil or surprise." A silent Chrome relaunch reads as malware behavior even when the code is innocent.
- Explaining the reason turns a black-box action into a collaborative one — the user can stop us before damage, and they build a mental model of what the system does.
- Gating only the *genuinely disruptive* subset (not every click) keeps the prompt rate low enough that users still read the prompts. Consent fatigue kills consent.

## Alternatives considered

- **Silent execution, log to a file.** Rejected — the user is sitting in front of the browser; the log is invisible at exactly the moment they'd want it.
- **Always ask for everything.** Rejected — consent fatigue. Users stop reading and start auto-pressing `y`, which is worse than no prompt at all.
- **Only explain, never gate.** Rejected — for actions like Chrome relaunch the user must be able to say "not now, I have unsaved tabs." Pure narration is not enough.

## Consequences

- Easier: writing flows becomes more honest — if you can't write the one-line reason for a step, that's a signal the step is wrong.
- Harder: every flow step needs a `reason` string, and the runner has to know which actions are "very scary" and gate them. New "very scary" actions must be added to the list above as the surface grows.
- Tradeoff: a small number of extra y/n prompts in the run loop. Acceptable for the trust win.

## Related

- [ADR-001](ADR-001-no-credential-proxy.md) — trust at the credential boundary; this ADR extends the same posture to the action boundary.
- [ADR-009](ADR-009-user-owns-login-and-captcha.md) — the user owns login and CAPTCHA. This ADR keeps the user aware of the automated steps that bracket those manual ones.
