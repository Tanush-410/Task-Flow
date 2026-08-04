'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  BoardCardContent,
  type BoardAssignment,
} from '@/components/board/board-card';
import { BoardColumn } from '@/components/board/board-column';
import { DelayReasonDialog } from '@/components/board/delay-reason-dialog';
import { changeAssignmentStatus } from '@/modules/assignments/actions';

const COLUMNS: {
  status: BoardAssignment['status'];
  label: string;
  droppable: boolean;
}[] = [
  { status: 'not_started', label: 'Not Started', droppable: false },
  { status: 'in_progress', label: 'In Progress', droppable: true },
  { status: 'delayed', label: 'Delayed', droppable: true },
  { status: 'completed', label: 'Completed', droppable: true },
];

export function TaskBoard({
  assignments: initialAssignments,
  showAssignee,
}: {
  assignments: BoardAssignment[];
  showAssignee?: boolean;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [delayTarget, setDelayTarget] = useState<BoardAssignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const activeAssignment =
    assignments.find((row) => row.assignmentId === activeId) ?? null;

  function moveCard(assignmentId: string, status: BoardAssignment['status']) {
    setAssignments((previous) =>
      previous.map((row) =>
        row.assignmentId === assignmentId ? { ...row, status } : row,
      ),
    );
  }

  async function commitStatusChange(
    assignment: BoardAssignment,
    status: 'in_progress' | 'delayed' | 'completed',
    reason?: string,
  ) {
    const previousStatus = assignment.status;
    moveCard(assignment.assignmentId, status);
    setPendingIds((previous) => new Set(previous).add(assignment.assignmentId));
    setError(null);

    const result = await changeAssignmentStatus({
      assignmentId: assignment.assignmentId,
      status,
      reason,
    });

    setPendingIds((previous) => {
      const next = new Set(previous);
      next.delete(assignment.assignmentId);
      return next;
    });

    if (!result.ok) {
      moveCard(assignment.assignmentId, previousStatus);
      setError(result.error.message);
      return;
    }

    router.refresh();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const assignment = assignments.find(
      (row) => row.assignmentId === active.id,
    );
    if (!assignment) return;

    const targetStatus = over.id as BoardAssignment['status'];
    if (targetStatus === assignment.status) return;
    if (targetStatus === 'not_started') return;

    if (targetStatus === 'delayed') {
      setDelayTarget(assignment);
      return;
    }

    void commitStatusChange(assignment, targetStatus);
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          <p>{error}</p>
          <button
            className="shrink-0 text-sm font-semibold underline underline-offset-2"
            onClick={() => setError(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <DndContext
        id="task-board"
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((column) => (
            <BoardColumn
              assignments={assignments.filter(
                (row) => row.status === column.status,
              )}
              droppable={column.droppable}
              key={column.status}
              label={column.label}
              pendingIds={pendingIds}
              showAssignee={showAssignee}
              status={column.status}
            />
          ))}
        </div>

        <DragOverlay>
          {activeAssignment ? (
            <BoardCardContent
              assignment={activeAssignment}
              className="shadow-card-lg"
              showAssignee={showAssignee}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {delayTarget ? (
        <DelayReasonDialog
          onCancel={() => setDelayTarget(null)}
          onConfirm={(reason) => {
            const target = delayTarget;
            setDelayTarget(null);
            void commitStatusChange(target, 'delayed', reason);
          }}
          pending={pendingIds.has(delayTarget.assignmentId)}
          taskTitle={delayTarget.title}
        />
      ) : null}
    </div>
  );
}
