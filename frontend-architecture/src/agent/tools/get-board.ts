import { z } from 'zod';
import { defineTool } from '../define';
import { boardLink } from '../links';

/**
 * Board status: per-column task and overdue counts through `agent_board_status`.
 * Overdue is computed in WIB by the view. Boards the caller cannot see are simply absent
 * (RLS on the security_invoker view).
 */
export const getBoard = defineTool({
  name: 'get_board',
  title: 'Board status',
  description:
    'Per-column task counts and overdue counts for every board the caller can see. ' +
    'Column is_done marks the Done column. Returns no task titles or content.',
  input: z.object({
    boardId: z
      .string()
      .uuid()
      .optional()
      .describe('Narrow to one board by id; omit for all visible boards'),
  }),
  async run({ boardId }, { db }) {
    let q = db
      .from('agent_board_status')
      .select('board_id, board, column_id, column_title, position, is_done, task_count, overdue_count')
      .order('board', { ascending: true });
    if (boardId) q = q.eq('board_id', boardId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data
      .filter((r): r is typeof r & { board_id: string } => r.board_id !== null)
      .map((r) => ({
        board_id: r.board_id,
        board: r.board ?? r.board_id,
        column: r.column_title ?? '',
        position: r.position ?? '',
        is_done: r.is_done ?? false,
        task_count: r.task_count ?? 0,
        overdue_count: r.overdue_count ?? 0,
        link: boardLink(r.board_id),
      }));
  },
});