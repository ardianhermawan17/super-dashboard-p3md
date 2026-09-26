'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import type { KanbanBoardData, KanbanColumn, KanbanTask, TaskPriority } from './types';
import { positionBetween } from './lib/position';

export async function getBoardAction(boardId?: string): Promise<{ board: KanbanBoardData | null; error?: string }> {
  const session = await getSession();
  if (!session) return { board: null, error: 'Unauthorized' };
  const supabase = await createClient();

  let targetBoardId = boardId;

  if (!targetBoardId) {
    const { data: boardsData } = await supabase
      .from('boards')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1);

    if (boardsData && boardsData.length > 0) {
      targetBoardId = boardsData[0].id;
    } else {
      // Create initial default board with default columns
      const { data: newBoard, error: createError } = await supabase
        .from('boards')
        .insert({
          name: 'Main Board',
          created_by: session.userId
        })
        .select()
        .single();

      if (createError || !newBoard) {
        return { board: null, error: createError?.message ?? 'Failed to create board' };
      }

      targetBoardId = newBoard.id;

      // Create default columns
      await supabase.from('board_columns').insert([
        { board_id: targetBoardId, title: 'Backlog', position: 'a0', is_done: false },
        { board_id: targetBoardId, title: 'In Progress', position: 'a1', is_done: false },
        { board_id: targetBoardId, title: 'Done', position: 'a2', is_done: true }
      ]);
    }
  }

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('*')
    .eq('id', targetBoardId)
    .single();

  if (boardError || !board) {
    return { board: null, error: boardError?.message ?? 'Board not found' };
  }

  const { data: columnsData, error: columnsError } = await supabase
    .from('board_columns')
    .select('*')
    .eq('board_id', targetBoardId)
    .order('position', { ascending: true });

  if (columnsError) {
    return { board: null, error: columnsError.message };
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('board_id', targetBoardId)
    .order('position', { ascending: true });

  if (tasksError) {
    return { board: null, error: tasksError.message };
  }

  // Fetch profiles for assignees
  const assigneeIds = Array.from(
    new Set((tasksData || []).map((t) => t.assignee_id).filter(Boolean))
  ) as string[];

  const profilesMap = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>();

  if (assigneeIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', assigneeIds);

    for (const p of profilesData || []) {
      profilesMap.set(p.id, p);
    }
  }

  const tasksByColumn = new Map<string, KanbanTask[]>();
  for (const col of columnsData || []) {
    tasksByColumn.set(col.id, []);
  }

  for (const t of tasksData || []) {
    const task: KanbanTask = {
      id: t.id,
      board_id: t.board_id,
      column_id: t.column_id,
      title: t.title,
      description: t.description,
      priority: t.priority as TaskPriority,
      assignee_id: t.assignee_id,
      due_date: t.due_date,
      position: t.position,
      created_by: t.created_by,
      created_at: t.created_at,
      updated_at: t.updated_at,
      assignee: t.assignee_id ? profilesMap.get(t.assignee_id) ?? null : null
    };

    const colTasks = tasksByColumn.get(t.column_id);
    if (colTasks) {
      colTasks.push(task);
    }
  }

  const columns: KanbanColumn[] = (columnsData || []).map((col) => ({
    id: col.id,
    board_id: col.board_id,
    title: col.title,
    position: col.position,
    is_done: col.is_done,
    tasks: tasksByColumn.get(col.id) || []
  }));

  return {
    board: {
      id: board.id,
      name: board.name,
      created_by: board.created_by,
      created_at: board.created_at,
      columns
    }
  };
}

export async function createTaskAction(input: {
  board_id: string;
  column_id: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
}): Promise<{ ok: boolean; task?: KanbanTask; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  // Find last task in column to compute position
  const { data: lastTasks } = await supabase
    .from('tasks')
    .select('position')
    .eq('board_id', input.board_id)
    .eq('column_id', input.column_id)
    .order('position', { ascending: false })
    .limit(1);

  const lastPos = lastTasks && lastTasks.length > 0 ? lastTasks[0] : null;
  const newPosition = positionBetween(lastPos, null);

  const { data: insertedTask, error } = await supabase
    .from('tasks')
    .insert({
      board_id: input.board_id,
      column_id: input.column_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: input.priority || 'medium',
      assignee_id: input.assignee_id || null,
      due_date: input.due_date || null,
      position: newPosition,
      created_by: session.userId
    })
    .select()
    .single();

  if (error || !insertedTask) {
    return { ok: false, error: error?.message ?? 'Failed to create task' };
  }

  return {
    ok: true,
    task: {
      id: insertedTask.id,
      board_id: insertedTask.board_id,
      column_id: insertedTask.column_id,
      title: insertedTask.title,
      description: insertedTask.description,
      priority: insertedTask.priority as TaskPriority,
      assignee_id: insertedTask.assignee_id,
      due_date: insertedTask.due_date,
      position: insertedTask.position,
      created_by: insertedTask.created_by,
      created_at: insertedTask.created_at,
      updated_at: insertedTask.updated_at
    }
  };
}

export async function moveTaskAction(input: {
  task_id: string;
  to_column_id: string;
  position: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('tasks')
    .update({
      column_id: input.to_column_id,
      position: input.position,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.task_id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteTaskAction(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateTaskAction(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    assignee_id?: string | null;
    due_date?: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const updateData: Database['public']['Tables']['tasks']['Update'] = {
    updated_at: new Date().toISOString()
  };
  if (patch.title !== undefined) updateData.title = patch.title.trim();
  if (patch.description !== undefined) updateData.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) updateData.priority = patch.priority;
  if (patch.assignee_id !== undefined) updateData.assignee_id = patch.assignee_id || null;
  if (patch.due_date !== undefined) updateData.due_date = patch.due_date || null;

  const { error } = await supabase.from('tasks').update(updateData).eq('id', taskId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
