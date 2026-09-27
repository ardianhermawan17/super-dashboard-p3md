'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { listBoardsAction, listCategoriesAction } from '@/features/finance/actions';
import { EntryFormDialog } from '@/features/finance/components/entry-form-dialog';
import type { FinanceCategory } from '@/features/finance/types';
import type { BoardOption } from '@/features/finance/types';

type Props = {
  boardId: string;
  taskId: string;
};

/**
 * PSI-104: "Add entry" on a task card — opens the finance entry dialog with
 * board AND task pre-filled. Stops pointerdown so dnd-kit (the card is a drag
 * handle) does not start a drag from the button.
 */
export function TaskFinanceButton({ boardId, taskId }: Props) {
  const [open, setOpen] = React.useState(false);
  const [boards, setBoards] = React.useState<BoardOption[]>([]);
  const [categories, setCategories] = React.useState<FinanceCategory[]>([]);

  const openDialog = () => {
    void listBoardsAction().then((res) => {
      if (res.ok) setBoards(res.data);
      else toast.error(res.error);
    });
    void listCategoriesAction().then((res) => {
      if (res.ok) setCategories(res.data);
      else toast.error(res.error);
    });
    setOpen(true);
  };

  return (
    <>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-5 w-5 text-muted-foreground hover:text-foreground'
        title='Add finance entry for this task'
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openDialog();
        }}
      >
        <Icons.billing className='h-3 w-3' />
      </Button>
      <EntryFormDialog
        open={open}
        onOpenChange={setOpen}
        boards={boards}
        categories={categories}
        entry={null}
        initialBoardId={boardId}
        initialTaskId={taskId}
        onSaved={() => setOpen(false)}
      />
    </>
  );
}