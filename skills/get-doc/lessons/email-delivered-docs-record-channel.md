# Email-delivered docs: record the send channel

Some docs arrive as an **async email reply** (e.g. a council clerk mailing back an אישור תושב).
When you send such a request, the re-check later needs to know **where to look** — which mailbox,
in which client. Don't assume; don't ask the user to re-tell you every time.

## Rule

When a doc is sent by email, record the **send channel** at send time, in the doc's ledger row:
- the email **client/account** used (e.g. "Gmail account yamshargil@…, in Chrome"),
- the **recipient** mailbox (e.g. `ilant@rng.org.il`),
- enough to re-find the **thread** (subject line).

Then on re-check (RESUME or `/get-doc <slug>` on a `requested` email doc), open **that** channel and
read the **thread** — a reply lands in the same conversation. Thread message count / senders is the
definitive signal:
- only your sent message present → **no reply yet**, leave `requested`.
- a message from the recipient present → fetch the attachment, flip to `have`.

## Why

2026-05-29: re-checking the RNG residency cert, the skill defaulted to firing up a fresh Gmail-MCP
OAuth flow. User stopped it: the email had been sent from **their own Gmail in Chrome**, so the
re-check should just reopen that Chrome session and read the thread — no new auth, no guessing.
The miss was that get-doc never recorded *which* client sent the mail.

## How to apply

- **At send (EXECUTE):** note the client + account + recipient + subject in the ledger Next action.
- **At re-check:** reopen the recorded channel via `playwriter` (the user's logged-in Chrome), search
  the recipient/subject, open the thread, count messages from the recipient.
- Gmail mechanics: open a conversation via its subject span `span.bog` (clicking a `tr.zA` row or an
  attachment chip can open a PDF preview instead — URL gains `?projector=1`). Read senders from
  `span.gD[email]` and the message count from `div.adn`.
- Never write the user's ת.ז./address/phone from the email body to disk. Keep service mailboxes.
