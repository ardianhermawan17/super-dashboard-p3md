# Documents (Google Drive)

> **Scope:** the Drive library and in-app viewer. Backend: [google-integration.md](../../backend-architecture/google-integration.md) · schema: [m6-google.md](../../database-architecture/m6-google.md).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

- **Left:** Drive roots the user can see → folder tree (rows with the folder mime type, by `parent_id`).
- **Main:** the template's data table: name, path, type icon, modified; instant name filter (`ilike` on the trigram index); a "Search inside documents" toggle that calls `google-drive/search`.
- **Viewer** (`/dashboard/documents/[id]`):

```ts
// src/features/documents/lib/load-file.ts
'use client';
import { createClient } from '@/lib/supabase/client';

export async function loadDocument(fileId: string): Promise<{ url: string; type: string } | { error: string; webViewLink?: string }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-drive/file?id=${encodeURIComponent(fileId)}`,
    { headers: { Authorization: `Bearer ${data.session?.access_token}` } },
  );
  if (!res.ok) return await res.json();
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };  // revoke on unmount
}
```

  PDFs render in an `<iframe src={url}>` on desktop; on phones show an "Open" button (`window.open(url)`), because mobile browsers render inline PDFs poorly. Images render inline. `415` → "No preview for this type" + "Open in Google Drive" (works only for people who also have Drive access).
- **Alternative without the proxy:** `<iframe src="https://drive.google.com/file/d/<id>/preview">` works when the viewer is signed in to Google and has Drive access to the file. It bypasses our RBAC, so use it only for folders shared with the whole organisation.
