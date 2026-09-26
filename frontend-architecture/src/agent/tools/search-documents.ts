import { z } from 'zod';
import { defineTool } from '../define';

/** Searchable metadata fields only (the view never exposes content — C-18). */
const SEARCH_FIELDS = ['name', 'path'] as const;

/**
 * Document lookup through `agent_documents`: names, paths and drive roots only. No content
 * body, no downloadable link — the caller needing the file goes through the app UI, where
 * drive scoping applies. Folders are already excluded by the view.
 */
export const searchDocuments = defineTool({
  name: 'search_documents',
  title: 'Search documents',
  description:
    'Find files in Google Drive by name or path — metadata only (name, path, mime, modified ' +
    'time, drive root). Never returns file content or a web link; only the fields an agent ' +
    'can safely describe. Folders are excluded. Capped at 25.',
  input: z.object({
    query: z
      .string()
      .min(1)
      .describe('Case-insensitive substring of the file name or path'),
    field: z
      .enum(SEARCH_FIELDS)
      .default('name')
      .describe('Which field to match against'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(10)
      .describe('Max files to return'),
  }),
  async run({ query, field, limit }, { db }) {
    const { data, error } = await db
      .from('agent_documents')
      .select('id, name, path, mime_type, modified_at, root')
      .ilike(field, `%${query}%`)
      .order('modified_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      path: r.path,
      mime_type: r.mime_type,
      modified_at: r.modified_at,
      root: r.root,
    }));
  },
});