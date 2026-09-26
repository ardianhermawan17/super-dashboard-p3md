export type TaskPriority = 'low' | 'medium' | 'high';

export interface KanbanTask {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  position: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  title: string;
  position: string;
  is_done: boolean;
  tasks: KanbanTask[];
}

export interface KanbanBoardData {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  columns: KanbanColumn[];
}
