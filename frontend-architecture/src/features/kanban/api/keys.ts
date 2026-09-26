export const kanbanKeys = {
  all: ['kanban'] as const,
  boards: () => [...kanbanKeys.all, 'boards'] as const,
  board: (boardId: string) => [...kanbanKeys.boards(), boardId] as const,
  defaultBoard: () => [...kanbanKeys.all, 'default-board'] as const,
  boardSharing: (boardId: string) => [...kanbanKeys.board(boardId), 'sharing'] as const,
};
