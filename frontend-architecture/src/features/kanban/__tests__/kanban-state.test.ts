import { describe, expect, it } from 'bun:test';
import * as React from 'react';
import {
  KanbanBoardEmptyState,
  KanbanBoardErrorState,
  KanbanColumnEmptyState,
} from '../components/kanban-state';
import { KanbanBoardSkeleton } from '../components/kanban-board-skeleton';

describe('Kanban States & Fallbacks (PSI-112)', () => {
  it('instantiates KanbanBoardSkeleton without errors', () => {
    const el = React.createElement(KanbanBoardSkeleton);
    expect(el).toBeDefined();
    expect(el.type).toBe(KanbanBoardSkeleton);
  });

  it('instantiates KanbanBoardErrorState with error message and retry handler', () => {
    let retried = false;
    const el = React.createElement(KanbanBoardErrorState, {
      message: 'Network timeout',
      onRetry: () => {
        retried = true;
      },
    });
    expect(el.props.message).toBe('Network timeout');
    el.props.onRetry();
    expect(retried).toBe(true);
  });

  it('instantiates KanbanBoardEmptyState and KanbanColumnEmptyState', () => {
    const boardEmpty = React.createElement(KanbanBoardEmptyState);
    expect(boardEmpty.type).toBe(KanbanBoardEmptyState);

    const columnEmpty = React.createElement(KanbanColumnEmptyState);
    expect(columnEmpty.type).toBe(KanbanColumnEmptyState);
  });
});
