# Tutorial · Connect the Google Calendar API (PSI-060, part 2 of 2)

> **This is a tutorial for the operator.** No agent performs these steps — contract C-15 in
> [`README_AI_AGENT.md`](../../README_AI_AGENT.md) forbids touching your GCP resources.
> Companion runbook for the code side once this is done:
> [`backend-architecture/google-integration.md`](../backend-architecture/google-integration.md) § "Google Cloud setup (human, once)".
> Schema: [m6-google.md](../database-architecture/m6-google.md) · UI: [calendar.md](../frontend-architecture/features/calendar.md)

## What you are building

One **service account (SA)** that can read and write calendars you explicitly share with it.
There is no per-user OAuth and no Google app verification, because the SA is the only identity
the app ever uses.

**PSI-060 is two independent halves — do them in either order:**

| Half | Enables |
|---|---|
| **Part 1:** Drive API + share folders | PSI-062 (`/sync`), PSI-063/064 (Documents) |
| **Part 2 (this doc):** Calendar API + share calendars | PSI-065 (`/pull`), PSI-066 (`/push`) |

Both halves share the **same project, the same service account, and the same key**. If you
already created `p3md-sync` for Drive, skip to [Step 3](#step-3--enable-the-google-calendar-api).

**Time:** ~15 minutes. **Cost:** free (Google Calendar API has no charge).

---

## Step 1 · Create the project

1. Go to <https://console.cloud.google.com/projectcreate>.
2. **Project name:** `p3md-social` → **Create**.
3. Make sure the project picker at the top shows `p3md-social` before every later step.
   *This is the single most common mistake — the right action in the wrong project.*

---

## Step 2 · Create the service account

1. <https://console.cloud.google.com/iam-admin/serviceaccounts> → **Create service account**.
2. **Name:** `p3md-sync` → **Create and continue**.
3. **Skip** both "Grant this service account access to project" and "Grant users access".
   The SA gets its calendar rights from *calendar sharing*, not from IAM. Granting project
   roles here would only widen blast radius for nothing.
4. **Done.** Note the email — it looks like:

   ```
   p3md-sync@p3md-social.iam.gserviceaccount.com
   ```

   This is the address you share calendars with. Copy it now; you will need it four times.

> **Verify identity in the app:** Admin → Integrations shows this exact address with a copy
> button. If the banner shows a *different* email than the one in the console, your
> `GOOGLE_SA_KEY_B64` secret belongs to another key — fix that before debugging anything else.

---

## Step 3 · Enable the Google Calendar API

1. <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com>
2. Confirm the project is `p3md-social` → **Enable**.
3. Wait ~1 minute for propagation.

> **Do not enable the wrong API.** `calendar-json.googleapis.com` is the Google Calendar API.
> Enabling "Google Calendar API" from a stale search result page or an older
> `www.googleapis.com/calendar/v3` link can land you on a different service. If your first
> API call returns `403 SERVICE_DISABLED`, re-check which API the console lists as enabled.

---

## Step 4 · Create the JSON key

1. <https://console.cloud.google.com/iam-admin/serviceaccounts> → click `p3md-sync`.
2. **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.
3. A `.json` file downloads. Guard it — **it is the full credential for the SA.**

### If "Create new key" is greyed out or errors

An org policy named `iam.disableServiceAccountKeyCreation` is enforced on your organisation.
A Workspace/Cloud admin must either:

- exempt `p3md-social` from the policy, or
- allow key creation for the SA.

This is a policy change on your side; no agent can or should do it. If you cannot get the
exemption, **stop here and say so** — an alternative (Workload Identity Federation) is a
different design that changes the code, so it needs its own decision.

---

## Step 5 · Store the key as a base64 Supabase secret, then delete the file

The Edge Function reads `GOOGLE_SA_KEY_B64` — the key as a **single-line base64 string**, not
raw JSON, because newlines in `private_key` are fragile through env vars.

### Remote project

```bash
# Git Bash / WSL / macOS
supabase secrets set GOOGLE_SA_KEY_B64="$(base64 -w0 p3md-sync-key.json)"
```

```powershell
# Windows PowerShell (no -w0; produces the same single-line value)
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\p3md-sync-key.json"))
supabase secrets set "GOOGLE_SA_KEY_B64=$b64"
```

### Local dev

The same value must reach `supabase functions serve`:

```bash
supabase secrets set --env-file supabase/functions/.env
```

Then verify — **`list` prints names only, never values**:

```bash
supabase secrets list          # expect a row for GOOGLE_SA_KEY_B64
```

### Now delete the download

```powershell
Remove-Item .\p3md-sync-key.json -Force
```

```bash
rm -f p3md-sync-key.json
```

**Then clear your Recycle Bin / Trash.** A deleted-but-recoverable key file is still a live
credential. Check there is no copy in Downloads, no `*.json` in a synced folder, and that the
key is not in shell history if you ever `cat`-ed it.

> **If the key ever leaks:** go to the SA → Keys → delete that key ID. Every dependent
> function stops working immediately and you issue a new key. That is the intended,
> cheap recovery path — rotate rather than investigate.

---

## Step 6 · Find each calendar's ID

**Calendar IDs are not guesses — read them.**

1. Open <https://calendar.google.com> in a browser.
2. Hover the calendar in the left sidebar → **⋮** (three dots) → **Settings and sharing**.
3. Scroll to **Integrate calendar** → copy **Calendar ID**.

What you will see:

| Calendar type | ID looks like |
|---|---|
| A calendar you created | `you@gmail.com` (your own address) |
| A secondary/team calendar | `abc123def456@group.calendar.google.com` |
| A Workspace calendar | `p3md-social.com_2d3...@resource.calendar.google.com` |

> **Common trap:** `calendar.google.com` and the Calendar ID both exist in a "Settings" page
> that is four scrolls deep, and *sub-calendars* are collapsed by default. If a calendar is
> not expanded to the point where you can see its own settings link, you are reading the
> parent's ID and will share the wrong thing.

---

## Step 7 · Share each calendar with the service account

Do this **per calendar**, choosing the level that matches the direction the app needs:

| App direction | Sharing level to pick | What it allows |
|---|---|---|
| `pull` — import Google events into the app agenda | **See all event details** | Read event title/time/description |
| `push` — export app events into Google | **Make changes to events** | Create/update/delete events |
| `both` — bi-directional | **Make changes to events** | Both of the above |

In **Settings and sharing** → **Share with specific people or groups** → **+ Add people**:

1. Paste the SA email (`p3md-sync@p3md-social.iam.gserviceaccount.com`).
2. **Permissions:** pick from the table above.
3. **Send.**

### Two settings that silently break push

These are separate from sharing and are the usual cause of "sharing looks right but nothing
syncs":

1. **Make changes to events** is *not* **Make changes AND manage sharing**. The latter is for
   admins; the SA does not need it.
2. For a `pull` calendar, **"See all event details" only works if the calendar owner has not
   restricted it.** If the calendar is from a Workspace with a sharing policy limiting
   visibility, the SA will see a calendar that appears shared but returns zero events. Check
   with the calendar's owner if a pull sync silently produces nothing.

> **Verify without the app:** the fastest check is to open the SA's perspective. There is no
> UI for that, so the real test is a single API call — see [Step 9](#step-9--prove-it-works).

---

## Step 8 · Register the calendars in the app

**Do not edit the database.** Use the UI that PSI-067 ships:

1. Sign in as a user holding `integrations.manage`.
2. **Admin → Integrations → Linked Calendars → Link Calendar.**
3. Fill in:
   - **Display Name** — human label (`P3MD Program Calendar`).
   - **Google Calendar ID** — paste exactly what Step 6 gave you.
   - **Sync Direction** — `pull`, `push`, or `both`.
   - **Sync Audience** — **one** role *or* **one** group. The schema enforces XOR
     (`num_nonnulls(role_id, group_id) = 1` in [`m6-google.sql`](../../supabase/migrations/20260926040000_m6_google.sql)),
     so the picker will not let you choose both. The audience decides *which app users* see
     pulled events, and *which app events* get pushed.
4. **Enable** the calendar, then **Link Calendar**.

### What "Sync Audience" means, concretely

- **`pull` + Group `Board`** → Google events land on the agenda of Board members only.
- **`push` + Group `Board`** → app events whose audience includes Board are written to Google.
- Getting this backwards is the #1 configuration error. If the wrong people see events,
  the audience is wrong — not the RLS.

### Status columns are your diagnostics

| Column | Reading |
|---|---|
| **Last Sync** = `Never` | The sync job has never run. Expected until PSI-065/066 deploy. |
| **Err:** `403` | The calendar is not shared with the SA, or the API is not enabled. Redo Steps 3 + 7. |
| **Err:** `404` | The Calendar ID is wrong — you copied a parent's ID (Step 6 trap). |
| **Err:** `401` | The key is wrong, expired, or the secret did not reach the function (Step 5). |

`last_error` is written by the sync function, so it stays `Never`/blank until those functions
exist — the column is not broken, it is unpopulated.

---

## Step 9 · Prove it works

### First: is the API even enabled?

```bash
curl -s "https://www.googleapis.com/calendar/v3/users/me/calendarList" | head -20
```

An unauthenticated call returning `401` or `403` with a *quota/credentials* message means the
API is reachable. A `SERVICE_DISABLED` body means Step 3 did not take.

### Then: can the SA actually see the shared calendar?

Paste this into a terminal — it signs the SA's JWT, exchanges it for a token, and lists what
the SA can reach. It prints **names and permissions only, never the key**.

<details>
<summary><b>Bash / Git Bash / WSL</b> — copy into the terminal from the folder holding the key</summary>

```bash
# NOTE: run BEFORE you delete the key file (Step 5), or re-download a key temporarily.
KEY=./p3md-sync-key.json

SA_EMAIL=$(python -c "import json;print(json.load(open('$KEY'))['client_email'])")
SA_KEY=$(python -c "import json;print(json.load(open('$KEY'))['private_key'])")

# 1. sign a JWT
HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
NOW=$(date +%s); EXP=$((NOW + 3600))
SCOPE='https://www.googleapis.com/auth/calendar.events'
CLAIM=$(printf '{"iss":"%s","aud":"https://oauth2.googleapis.com/token","scope":"%s","iat":%s,"exp":%s}' \
  "$SA_EMAIL" "$SCOPE" "$NOW" "$EXP" | base64 -w0 | tr '+/' '-_' | tr -d '=')
UNSIGNED="$HEADER.$CLAIM"
printf '%s' "$SA_KEY" > /tmp/sa.pem
SIG=$(printf '%s' "$UNSIGNED" | openssl dgst -sha256 -sign /tmp/sa.pem | base64 -w0 | tr '+/' '-_' | tr -d '=')
rm -f /tmp/sa.pem
JWT="$UNSIGNED.$SIG"

# 2. exchange for an access token
TOKEN=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -d grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer -d "assertion=$JWT" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 3. what can the SA see?
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://www.googleapis.com/calendar/v3/users/me/calendarList" \
  | python -c "import sys,json;[print(c['id'],'|',c.get('summary'),'|',c.get('accessRole')) for c in json.load(sys.stdin).get('items',[])]"
```

</details>

**What you want to see:** your shared calendar listed with `accessRole` of `reader` (pull) or
`writer`/`owner` (push).

| Result | Meaning |
|---|---|
| Calendar missing from the list | Step 7 did not apply. Re-share, and allow a minute. |
| `accessRole: freeBusyReader` | You picked **"See only free/busy"**. Change to *See all event details*. |
| `403` on the token exchange | **Calendar API not enabled** (Step 3), or the JWT `scope` is wrong. |
| `invalid_grant` | Key does not match the SA email. You are mixing two projects. |
| `401` on the calendarList call | The token was truncated — re-run, keep it on one line. |

### Finally: the app

The Integrations page's **Sync now** button is **cosmetic until PSI-065/066 deploy the sync
Edge Functions** (PSI-060 blocks those). A queued-looking success is expected and means
nothing yet.

**So the honest acceptance for PSI-060 Part 2 is the Step 9 API check** — a calendar visible
to the SA with the right role. That is exactly what PSI-060's acceptance line asks for:
*"calendars shared with the SA email."* The end-to-end event flow is PSI-065/066's acceptance,
not this task's.

---

## Step 10 · Close out PSI-060

When Parts 1 and 2 are both done, the task is done. Nothing is left for the app to be told —
there is **no calendar ID list to hand to an agent**: you register calendars through
Admin → Integrations (Step 8), which writes to `google_calendars`.

Tell the operator to move PSI-060 → `done`; the agent-side unblock follows:

```bash
# agent, after the operator stamps PSI-060 done
git checkout -b task/PSI-062     # google-drive /sync
# and later
git checkout -b task/PSI-065     # google-calendar /pull
git checkout -b task/PSI-066     # google-calendar /push
```

**Updated acceptance evidence for the card** — replace the vague blocked note with:

```
- blocked: —
- evidence: Calendar API enabled; GOOGLE_SA_KEY_B64 set (supabase secrets list);
  key file deleted; N calendars shared with p3md-sync@p3md-social.iam.gserviceaccount.com,
  verified via calendarList showing accessRole reader/writer.
```

---

## Troubleshooting quick table

| Symptom | Cause | Fix |
|---|---|---|
| `403 SERVICE_DISABLED` | API not enabled | Step 3 — and confirm the project picker |
| `404 Not Found` on a calendar | Wrong ID (parent's) | Step 6 — expand the sub-calendar first |
| Calendar absent from `calendarList` | Not shared with the SA | Step 7 |
| `accessRole: freeBusyReader` | Wrong sharing level | Step 7 — "See all event details" |
| Push does nothing, sharing looks fine | Saw events but cannot write | Step 7 — "Make changes to events" |
| `invalid_grant` | Key/project mismatch | Step 4 — key must belong to `p3md-sync` |
| `401` in the app's `last_error` | Secret missing/malformed | Step 5 — re-set, then redeploy the function |
| "Create new key" unavailable | Org policy | Step 4 — needs an admin; then stop and report |

## Security rules for this task

- The key file is a full credential. Delete it **and** empty the Trash after Step 5.
- Never paste the key, or its base64 form, into chat, a commit, an issue, or a card. If you
  need to show state, show `supabase secrets list` (names only).
- Never commit `p3md-sync-key.json` or `supabase/functions/.env`.
- Prefer **rotating** a leaked key over investigating it: delete the key ID, mint a new one.
- Least privilege throughout: no IAM project roles on the SA, only the calendar shares it needs,
  and scopes limited to `calendar.events` (plus `drive.readonly` for Part 1).

## What this tutorial deliberately does not do

Nothing in this document has been executed. It contains no project IDs you should trust over
what your console shows, no key material, and no agent-performed GCP action. Steps 1–7 are
yours; Steps 8–10 describe what the already-merged code expects to find.
