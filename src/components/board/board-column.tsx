'use client';

import { useDroppable } from '@dnd-kit/core';

import { BoardCard, type BoardAssignment } from '@/components/board/board-card';

export function BoardColumn({
  status,
  label,
  assignments,
  showAssignee,
  droppable = true,
  pendingIds,
}: {
  status: BoardAssignment['status'];
  label: string;
  assignments: BoardAssignment[];
  showAssignee?: boolean;
  droppable?: boolean;
  pendingIds: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: !droppable,
  });

  return (
    <div
      className={`flex min-w-64 flex-1 flex-col rounded-xl bg-muted/40 p-3 ring-1 transition-colors ${
        isOver ? 'ring-primary/50 bg-primary-soft/40' : 'ring-border'
      }`}
      ref={setNodeRef}
    >
      <div className="flex items-center gap-2 px-1 pb-3">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span className="text-xs font-medium text-muted-foreground">
          {assignments.length}
        </span>
      </div>

      <div className="flex-1 space-y-2">
        {assignments.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No tasks</p>
        ) : (
          assignments.map((assignment) => (
            <BoardCard
              assignment={assignment}
              key={assignment.assignmentId}
              pending={pendingIds.has(assignment.assignmentId)}
              showAssignee={showAssignee}
            />
          ))
        )}
      </div>
    </div>
  );
}
