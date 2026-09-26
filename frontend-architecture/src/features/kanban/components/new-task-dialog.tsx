'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createTaskAction } from '../actions';
import { kanbanKeys } from '../api/keys';
import type { TaskPriority } from '../types';

interface NewTaskDialogProps {
  boardId: string;
  columns: { id: string; title: string }[];
}

export default function NewTaskDialog({ boardId, columns }: NewTaskDialogProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const defaultColumnId = columns[0]?.id || '';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const columnId = (formData.get('column_id') as string) || defaultColumnId;
    const priority = ((formData.get('priority') as TaskPriority) || 'medium');
    const dueDate = (formData.get('due_date') as string) || null;

    if (!title) {
      setTitleError('Please enter a task title.');
      return;
    }
    setTitleError(null);
    setLoading(true);

    try {
      const res = await createTaskAction({
        board_id: boardId,
        column_id: columnId,
        title,
        description,
        priority,
        due_date: dueDate
      });

      if (res.ok) {
        await qc.invalidateQueries({ queryKey: kanbanKeys.board(boardId) });
        form.reset();
        setOpen(false);
      } else {
        setTitleError(res.error ?? 'Failed to create task');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTitleError(null);
      }}
    >
      <DialogTrigger render={<Button variant='secondary' size='sm' />}>
        + Add New Task
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>Create a new task card on the board.</DialogDescription>
        </DialogHeader>
        <form id='task-form' className='grid gap-4 py-4' onSubmit={handleSubmit}>
          <div className='grid grid-cols-4 items-center gap-4'>
            <label htmlFor='title' className='text-right text-sm font-medium'>
              Title
            </label>
            <div className='col-span-3 flex flex-col gap-1'>
              <Input
                id='title'
                name='title'
                placeholder='Task title...'
                required
                disabled={loading}
              />
              {titleError && (
                <span className='text-xs text-destructive'>{titleError}</span>
              )}
            </div>
          </div>

          {columns.length > 1 && (
            <div className='grid grid-cols-4 items-center gap-4'>
              <label htmlFor='column_id' className='text-right text-sm font-medium'>
                Column
              </label>
              <select
                id='column_id'
                name='column_id'
                defaultValue={defaultColumnId}
                disabled={loading}
                className='col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className='grid grid-cols-4 items-center gap-4'>
            <label htmlFor='priority' className='text-right text-sm font-medium'>
              Priority
            </label>
            <select
              id='priority'
              name='priority'
              defaultValue='medium'
              disabled={loading}
              className='col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            >
              <option value='low'>Low</option>
              <option value='medium'>Medium</option>
              <option value='high'>High</option>
            </select>
          </div>

          <div className='grid grid-cols-4 items-center gap-4'>
            <label htmlFor='due_date' className='text-right text-sm font-medium'>
              Due Date
            </label>
            <Input
              id='due_date'
              name='due_date'
              type='date'
              disabled={loading}
              className='col-span-3'
            />
          </div>

          <div className='grid grid-cols-4 items-center gap-4'>
            <label htmlFor='description' className='text-right text-sm font-medium'>
              Description
            </label>
            <Textarea
              id='description'
              name='description'
              placeholder='Description (optional)...'
              disabled={loading}
              className='col-span-3'
            />
          </div>
        </form>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type='submit' form='task-form' disabled={loading}>
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
