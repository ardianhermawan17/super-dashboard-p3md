# Talent (phase 8)

> **Scope:** CV intake and candidate views. Schema: [m9-talent.md](../../database-architecture/m9-talent.md) · parsing: [edge-functions.md](../../backend-architecture/edge-functions.md#parse-cv-psi-082-outline).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

- Consent screen first (explicit checkbox, UU PDP wording), then either the Supabase Dropzone into the private `cvs` bucket (`<user_id>/<uuid>.pdf`, 2 MB cap) or a link to a CV already in the talent Drive root ([google-integration.md](../../backend-architecture/google-integration.md#talent-cvs-in-drive)).
- Candidate list and pipeline board show **scores and skill names only**. Raw CV text never reaches the browser.
