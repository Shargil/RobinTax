// Shared sanitizer for Smart Replay flow files.
//
// Used by:
//   - the record-flow dev skill (cleans `playwright codegen` output before it
//     becomes a canonical flow at flows/<domain>.ts)
//   - the contribute-flow user skill (defense-in-depth pass on candidate
//     flows produced by get-doc's LLM exploration, before they're shared)
//
// Apply order matters — credential / session-param stripping runs BEFORE
// PII regex so we don't leak a 9-digit ID hidden in a session token.
//
// Anything the sanitizer can't safely auto-rewrite is surfaced as a Warning
// (with line numbers when possible) so a human can fix it explicitly.
//
// PII LEAK IS THE WORST FAILURE MODE OF THE CONTRIBUTION LOOP — when in
// doubt, warn instead of auto-replacing. False positives are cheap; false
// negatives leak personal data into a public PR.

export interface SanitizeWarning {
  line?: number;
  kind:
    | "login-block-heuristic-failed"
    | "credential-fill"
    | "wait-for-timeout"
    | "brittle-selector"
    | "possible-name"
    | "possible-id"
    | "possible-tik"
    | "high-entropy-token"
    | "step-wrapper-missing";
  message: string;
}

export interface SanitizeOptions {
  // Caller-known PII to hard-strip (e.g. the user's first name). The
  // contribute-flow skill collects these from the user before running.
  knownNames?: string[];
  knownEmails?: string[];
}

export interface SanitizeResult {
  sanitized: string;
  warnings: SanitizeWarning[];
}

const RE_ISRAELI_ID = /\b\d{9}\b/g;
const RE_PHONE = /\b05\d-?\d{7}\b/g;
const RE_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const RE_OTP_FILL = /\.fill\(\s*['"`]\d{4,8}['"`]\s*\)/g;
const RE_AUTH_URL_PARAM = /([?&])(code|token|sid|session|state|access_token|id_token)=([^&'"`\s]+)/gi;
const RE_TIK_HEBREW = /(?:תיק\s*ניכויים|תיק)\s*[:#]?\s*(\d{9})/g;
const RE_NTH_CHILD = /:nth-(?:child|of-type)\(\d+\)/g;
const RE_WAIT_FOR_TIMEOUT = /\.waitForTimeout\(\s*\d+\s*\)/g;
const RE_HIGH_ENTROPY = /\b[a-zA-Z0-9_-]{24,}\b/g;
// Service mailboxes whose addresses are NOT PII and should NOT be replaced.
const PRESERVE_EMAIL_DOMAINS = new Set([
  "rng.org.il",
  "piba.gov.il",
  "gov.il",
  "taxes.gov.il",
  "btl.gov.il",
]);

function isServiceEmail(addr: string): boolean {
  const lc = addr.toLowerCase();
  for (const dom of PRESERVE_EMAIL_DOMAINS) {
    if (lc.endsWith("@" + dom) || lc.endsWith("." + dom)) return true;
  }
  return false;
}

function stripLoginBlock(src: string, warnings: SanitizeWarning[]): string {
  // Heuristic: codegen recordings of an authenticated flow usually start with
  // a `page.goto(<login-page>)` then a sequence of `getByLabel(.../id|user|
  // password|הזדהות|כניסה|תעודת זהות|סיסמה/).fill(...)` and `click(...)`
  // actions ending with a post-login navigation.
  //
  // We blunt-instrument this by stripping the contiguous block from the
  // FIRST goto whose URL looks like a login/auth page down to but not
  // including the next goto that lands elsewhere. If we can't find that
  // shape we just warn — better than deleting the wrong thing.
  const lines = src.split("\n");
  let firstAuthGoto = -1;
  for (let i = 0; i < lines.length; i++) {
    if (
      /page\.goto\(.*(login|signin|sign-in|auth|logon|otp|tmindex|hzdh|הזדהות)/i.test(
        lines[i],
      )
    ) {
      firstAuthGoto = i;
      break;
    }
  }
  if (firstAuthGoto === -1) return src;

  let nextGoto = -1;
  for (let i = firstAuthGoto + 1; i < lines.length; i++) {
    if (/page\.goto\(/.test(lines[i])) {
      nextGoto = i;
      break;
    }
  }

  if (nextGoto === -1) {
    warnings.push({
      kind: "login-block-heuristic-failed",
      message:
        "Found a login-page goto but no follow-up navigation; cannot safely auto-strip. Review lines manually.",
      line: firstAuthGoto + 1,
    });
    return src;
  }

  const before = lines.slice(0, firstAuthGoto);
  const after = lines.slice(nextGoto);
  const stripped = [
    ...before,
    "  // [LOGIN STRIPPED — user authenticates themselves at runtime per repo ADR-009.",
    "  //  At runtime, wait on a post-login DOM signal (selector to be confirmed).]",
    "",
    ...after,
  ];
  return stripped.join("\n");
}

function warnCredentialFills(src: string, warnings: SanitizeWarning[]): string {
  // Replace string-arg of any .fill(...) that LOOKS like credentials with
  // <STRIPPED> and warn so reviewer notices.
  const lines = src.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let replaced = line;
    // Password / OTP-context fills
    if (/(password|סיסמה|אימות|otp|code|תעודת זהות|ת\.ז)/i.test(line)) {
      replaced = replaced.replace(
        /\.fill\(\s*(['"`])(.*?)\1\s*\)/g,
        `.fill('<STRIPPED>')`,
      );
      if (replaced !== line) {
        warnings.push({
          line: i + 1,
          kind: "credential-fill",
          message: "Credential-shaped fill() replaced with <STRIPPED>.",
        });
      }
    }
    // Numeric OTP-shaped fills regardless of context
    if (RE_OTP_FILL.test(line)) {
      RE_OTP_FILL.lastIndex = 0;
      replaced = replaced.replace(RE_OTP_FILL, `.fill('<OTP>')`);
      warnings.push({
        line: i + 1,
        kind: "credential-fill",
        message: "OTP-shaped digit fill() replaced with '<OTP>'.",
      });
    }
    out.push(replaced);
  }
  return out.join("\n");
}

function stripAuthUrlParams(src: string): string {
  return src.replace(RE_AUTH_URL_PARAM, (_m, sep) => `${sep}`);
}

function scrubPII(
  src: string,
  warnings: SanitizeWarning[],
  opts: SanitizeOptions,
): string {
  let out = src;
  // Known names from caller — hard replace
  for (const name of opts.knownNames ?? []) {
    if (!name.trim()) continue;
    const re = new RegExp(escapeRegExp(name), "g");
    out = out.replace(re, "<NAME>");
  }
  for (const email of opts.knownEmails ?? []) {
    if (!email.trim()) continue;
    const re = new RegExp(escapeRegExp(email), "gi");
    out = out.replace(re, "<EMAIL>");
  }
  // Tiks (employer file ids) — these are 9-digit too, scrub before generic
  // ID rule so they get the more specific tag.
  out = out.replace(RE_TIK_HEBREW, (_m, _digits) => `תיק <TIK>`);
  // Generic 9-digit IDs
  out = out.replace(RE_ISRAELI_ID, "<ID>");
  // Phones
  out = out.replace(RE_PHONE, "<PHONE>");
  // Emails — preserve service mailboxes
  out = out.replace(RE_EMAIL, (m) => (isServiceEmail(m) ? m : "<EMAIL>"));
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function flagManualReview(src: string, warnings: SanitizeWarning[]): void {
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (RE_NTH_CHILD.test(lines[i])) {
      RE_NTH_CHILD.lastIndex = 0;
      warnings.push({
        line: i + 1,
        kind: "brittle-selector",
        message:
          "nth-child / nth-of-type selector — replace with get_by_role / get_by_text.",
      });
    }
    if (RE_WAIT_FOR_TIMEOUT.test(lines[i])) {
      RE_WAIT_FOR_TIMEOUT.lastIndex = 0;
      warnings.push({
        line: i + 1,
        kind: "wait-for-timeout",
        message:
          "waitForTimeout — replace with a content wait (waitFor / waitForResponse).",
      });
    }
    if (RE_HIGH_ENTROPY.test(lines[i])) {
      RE_HIGH_ENTROPY.lastIndex = 0;
      // Don't auto-replace — could be a legitimate test id or aria-ref.
      warnings.push({
        line: i + 1,
        kind: "high-entropy-token",
        message:
          "High-entropy token — check it's not a session id or user-specific identifier.",
      });
    }
  }
  // Step wrapper check — every top-level await on `page.<verb>(...)` outside
  // a `step(...)` call is a candidate for wrapping.
  const stepCount = (src.match(/\bstep\s*\(\s*["'`]/g) || []).length;
  const topActions = (src.match(/^\s*await\s+page\./gm) || []).length;
  if (topActions > 0 && stepCount === 0) {
    warnings.push({
      kind: "step-wrapper-missing",
      message: `Found ${topActions} top-level page.* action(s) and zero step("name", ...) wrappers. Wrap each action so failures point at the right place.`,
    });
  }
}

export function sanitizeFlow(
  source: string,
  opts: SanitizeOptions = {},
): SanitizeResult {
  const warnings: SanitizeWarning[] = [];
  let s = source;
  s = stripLoginBlock(s, warnings);
  s = warnCredentialFills(s, warnings);
  s = stripAuthUrlParams(s);
  s = scrubPII(s, warnings, opts);
  flagManualReview(s, warnings);
  return { sanitized: s, warnings };
}

// Strict re-check used by the contribute-flow skill RIGHT BEFORE sharing.
// Returns the list of patterns still present — should be empty.
export function leakCheck(source: string): string[] {
  const hits: string[] = [];
  if (RE_ISRAELI_ID.test(source)) hits.push("9-digit ID still present");
  RE_ISRAELI_ID.lastIndex = 0;
  if (RE_PHONE.test(source)) hits.push("phone still present");
  RE_PHONE.lastIndex = 0;
  const emails = source.match(RE_EMAIL) || [];
  for (const e of emails) {
    if (!isServiceEmail(e)) {
      hits.push(`personal email still present: ${e}`);
    }
  }
  if (/\.fill\(\s*['"`][^'"`<][^'"`]{2,}/.test(source)) {
    // any fill() that isn't <STRIPPED>/<OTP>/etc.
    hits.push("non-placeholder fill() argument — possible credential");
  }
  return hits;
}
