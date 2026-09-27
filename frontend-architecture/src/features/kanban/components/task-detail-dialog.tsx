'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { updateTaskAction } from '../actions';
import { kanbanKeys } from '../api/keys';
import {
  getTaskFinanceEntriesAction,
  listBoardsAction,
  listCategoriesAction,
} from '@/features/finance/actions';
import { EntryFormDialog } from '@/features/finance/components/entry-form-dialog';
import { formatIDR } from '@/features/finance/lib/format';
import type { KanbanTask, LinkedEventInfo, TaskPriority } from '../types';
import type { BoardOption, FinanceCategory, FinanceEntry } from '@/features/finance/types';

interface TaskDetailDialogProps {
  task: KanbanTask;
  columns: { id: string; title: string }[];
  linkedEvent?: LinkedEventInfo | null;
  canReadFinance?: boolean;
  canWriteFinance?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({
  task,
  columns,
  linkedEvent,
  canReadFinance = false,
  canWriteFinance = false,
  open,
  onOpenChange,
}: TaskDetailDialogProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [titleError, setTitleError] = React.useState<string | null>(null);

  // Form state
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description || '');
  const [priority, setPriority] = React.useState<TaskPriority>(task.priority);
  const [columnId, setColumnId] = React.useState(task.column_id);
  const [dueDate, setDueDate] = React.useState(task.due_date || '');

  // Finance state
  const [financeEntries, setFinanceEntries] = React.useState<FinanceEntry[]>([]);
  const [loadingFinance, setLoadingFinance] = React.useState(false);
  const [addFinanceOpen, setAddFinanceOpen] = React.useState(false);
  const [boards, setBoards] = React.useState<BoardOption[]>([]);
  const [categories, setCategories] = React.useState<FinanceCategory[]>([]);

  // Reset form when task changes or dialog opens
  React.useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setColumnId(task.column_id);
      setDueDate(task.due_date || '');
      setTitleError(null);

      // Fetch finance entries if user has permission
      if (canReadFinance) {
        setLoadingFinance(true);
        void getTaskFinanceEntriesAction(task.id).then((res) => {
          setLoadingFinance(false);
          if (res.ok) {
            setFinanceEntries(res.data);
          }
        });
      }
    }
  }, [open, task, canReadFinance]);

  const loadFinanceOptions = () => {
    void listBoardsAction().then((res) => {
      if (res.ok) setBoards(res.data);
    });
    void listCategoriesAction().then((res) => {
      if (res.ok) setCategories(res.data);
    });
  };

  const handleOpenAddFinance = () => {
    loadFinanceOptions();
    setAddFinanceOpen(true);
  };

  const handleFinanceSaved = () => {
    // Refresh task finance entries
    void getTaskFinanceEntriesAction(task.id).then((res) => {
      if (res.ok) setFinanceEntries(res.data);
    });
    // Invalidate board summary queries if any
    void qc.invalidateQueries({ queryKey: ['finance'] });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Please enter a task title.');
      return;
    }
    setTitleError(null);
    setLoading(true);

    try {
      const res = await updateTaskAction(task.id, {
        title: trimmedTitle,
        description: description.trim() || null,
        priority,
        column_id: columnId,
        due_date: dueDate || null,
      });

      if (!res.ok) {
        toast.error(res.error || 'Failed to update task');
        return;
      }

      await qc.invalidateQueries({ queryKey: kanbanKeys.board(task.board_id) });
      toast.success('Task updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const eventDateFormatted = linkedEvent
    ? new Date(linkedEvent.starts_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-lg max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details, status, or linked finance.</DialogDescription>
          </DialogHeader>

          {/* Linked Event Banner */}
          {linkedEvent && (
            <div className='flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs'>
              <Icons.calendar className='h-3.5 w-3.5 text-primary shrink-0' />
              <span className='text-muted-foreground'>
                Linked event:{' '}
                <Link
                  href='/dashboard/calendar'
                  className='font-medium text-foreground hover:underline'
                  onClick={() => onOpenChange(false)}
                >
                  {linkedEvent.title} ({eventDateFormatted})
                </Link>
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-4 pt-2'>
            <div className='space-y-2'>
              <label htmlFor='task-detail-title' className='text-xs font-medium'>
                Title <span className='text-destructive'>*</span>
              </label>
              <Input
                id='task-detail-title'
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(null);
                }}
                required
                maxLength={200}
                placeholder='Task title'
              />
              {titleError && <p className='text-xs text-destructive'>{titleError}</p>}
            </div>

            <div className='space-y-2'>
              <label htmlFor='task-detail-description' className='text-xs font-medium'>
                Description
              </label>
              <Textarea
                id='task-detail-description'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='Optional description'
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-2'>
                <label htmlFor='task-detail-column' className='text-xs font-medium'>
                  Status / Column
                </label>
                <select
                  id='task-detail-column'
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className='border-input bg-background ring-offset-background flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label htmlFor='task-detail-priority' className='text-xs font-medium'>
                  Priority
                </label>
                <select
                  id='task-detail-priority'
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className='border-input bg-background ring-offset-background flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                >
                  <option value='low'>Low</option>
                  <option value='medium'>Medium</option>
                  <option value='high'>High</option>
                </select>
              </div>
            </div>

            <div className='space-y-2'>
              <label htmlFor='task-detail-due-date' className='text-xs font-medium'>
                Due Date
              </label>
              <Input
                id='task-detail-due-date'
                type='date'
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* PSI-109: Finance section (only visible when user has finance.read) */}
            {canReadFinance && (
              <div className='space-y-2 rounded-lg border border-muted bg-muted/20 p-3'>
                <div className='flex items-center justify-between'>
                  <span className='flex items-center gap-1.5 text-xs font-medium'>
                    <Icons.billing className='h-3.5 w-3.5 text-primary' />
                    Finance Entries ({financeEntries.length})
                  </span>
                  {canWriteFinance && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-7 text-xs'
                      onClick={handleOpenAddFinance}
                    >
                      <Icons.plusCircle className='mr-1 h-3 w-3' />
                      Add entry
                    </Button>
                  )}
                </div>

                {loadingFinance ? (
                  <p className='py-2 text-center text-xs text-muted-foreground'>Loading entries...</p>
                ) : financeEntries.length > 0 ? (
                  <div className='space-y-1.5 pt-1'>
                    {financeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className='flex items-center justify-between rounded border bg-card p-2 text-xs'
                      >
                        <div className='flex flex-col'>
                          <span className='font-medium'>{entry.description}</span>
                          <span className='text-[10px] text-muted-foreground'>
                            {entry.category_name} · {entry.occurred_on}
                          </span>
                        </div>
                        <Badge
                          variant={entry.direction === 'inflow' ? 'default' : 'secondary'}
                          className={`text-xs ${
                            entry.direction === 'inflow' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' : 'text-red-600 bg-red-50 dark:bg-red-950/50'
                          }`}
                        >
                          {entry.direction === 'inflow' ? '+' : '-'} {formatIDR(entry.amount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='py-2 text-center text-xs text-muted-foreground'>
                    No finance entries recorded for this task.
                  </p>
                )}
              </div>
            )}

            <DialogFooter className='pt-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Finance Entry Dialog */}
      {canWriteFinance && (
        <EntryFormDialog
          open={addFinanceOpen}
          onOpenChange={setAddFinanceOpen}
          boards={boards}
          categories={categories}
          initialBoardId={task.board_id}
          initialTaskId={task.id}
          onSaved={handleFinanceSaved}
        />
      )}
    </>
  );
}