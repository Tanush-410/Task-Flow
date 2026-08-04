'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';

import type { ActionResult } from '@/lib/result';
import { toDateTimeLocalValue } from '@/lib/calendar-dates';
import type { OrganizationMember } from '@/modules/members/queries';
import { createAndAssignTask } from '@/modules/tasks/actions';
import {
  createTaskTemplate,
  deleteTaskTemplate,
} from '@/modules/templates/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type TaskTemplateRow = {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  recurrence: string;
  acknowledgementRequired: boolean;
};

async function submitTask(
  _previousState: ActionResult<{ taskId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const dueAtRaw = formData.get('dueAt');
  const startAtRaw = formData.get('startAt');

  return createAndAssignTask({
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    priority: formData.get('priority'),
    dueAt:
      typeof dueAtRaw === 'string' && dueAtRaw.length > 0
        ? new Date(dueAtRaw).toISOString()
        : null,
    startAt:
      typeof startAtRaw === 'string' && startAtRaw.length > 0
        ? new Date(startAtRaw).toISOString()
        : null,
    acknowledgementRequired: formData.get('acknowledgementRequired') === 'on',
    recurrence: formData.get('recurrence'),
    assigneeIds: formData.getAll('assigneeIds'),
  });
}

export function TaskForm({
  employees,
  templates,
  defaultDueAt,
  defaultAssigneeId,
}: {
  employees: OrganizationMember[];
  templates: TaskTemplateRow[];
  defaultDueAt?: string;
  defaultAssigneeId?: string;
}) {
  const [state, formAction, pending] = useActionState(submitTask, null);
  const router = useRouter();
  const error = state && !state.ok ? state.error : null;

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [priority, setPriority] = useState('medium');
  const [recurrence, setRecurrence] = useState('none');
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(false);
  const [templateList, setTemplateList] = useState(templates);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    if (state?.ok) {
      router.push(`/tasks/${state.data.taskId}`);
    }
  }, [state, router]);

  function applyTemplate(templateId: string) {
    const template = templateList.find((item) => item.id === templateId);
    if (!template) return;

    if (titleRef.current) titleRef.current.value = template.title;
    if (descriptionRef.current)
      descriptionRef.current.value = template.description;
    setPriority(template.priority);
    setRecurrence(template.recurrence);
    setAcknowledgementRequired(template.acknowledgementRequired);
  }

  function saveAsTemplate() {
    const name = templateName.trim();
    if (!name || !titleRef.current) return;

    createTaskTemplate({
      name,
      title: titleRef.current.value,
      description: descriptionRef.current?.value ?? '',
      priority,
      recurrence,
      acknowledgementRequired,
    }).then((result) => {
      if (result.ok) {
        setTemplateList((previous) => [
          {
            id: result.data.templateId,
            name,
            title: titleRef.current?.value ?? '',
            description: descriptionRef.current?.value ?? '',
            priority,
            recurrence,
            acknowledgementRequired,
          },
          ...previous,
        ]);
        setTemplateName('');
        setSavingTemplate(false);
      }
    });
  }

  function removeTemplate(templateId: string) {
    deleteTaskTemplate({ templateId }).then((result) => {
      if (result.ok) {
        setTemplateList((previous) =>
          previous.filter((item) => item.id !== templateId),
        );
      }
    });
  }

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      {templateList.length > 0 ? (
        <div className="rounded-xl border border-border p-3">
          <Label htmlFor="template-select">Start from a template</Label>
          <Select
            disabled={pending}
            onValueChange={applyTemplate}
            value={undefined}
          >
            <SelectTrigger className="mt-2 w-full" id="template-select">
              <SelectValue placeholder="Choose a saved template" />
            </SelectTrigger>
            <SelectContent>
              {templateList.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {templateList.map((template) => (
              <span
                className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                key={template.id}
              >
                {template.name}
                <button
                  aria-label={`Delete template ${template.name}`}
                  className="hover:text-red-400"
                  onClick={() => removeTemplate(template.id)}
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          className="mt-2"
          disabled={pending}
          id="title"
          maxLength={140}
          name="title"
          placeholder="Prepare weekly client report"
          ref={titleRef}
          required
          type="text"
        />
        <FieldError>{error?.fields?.title?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          className="mt-2"
          disabled={pending}
          id="description"
          maxLength={10_000}
          name="description"
          placeholder="What needs to be done?"
          ref={descriptionRef}
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select
            disabled={pending}
            name="priority"
            onValueChange={setPriority}
            value={priority}
          >
            <SelectTrigger className="mt-2 w-full" id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dueAt">Due date</Label>
          <Input
            className="mt-2"
            defaultValue={
              defaultDueAt ? toDateTimeLocalValue(defaultDueAt) : undefined
            }
            disabled={pending}
            id="dueAt"
            name="dueAt"
            type="datetime-local"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="recurrence">Repeat</Label>
        <Select
          disabled={pending}
          name="recurrence"
          onValueChange={setRecurrence}
          value={recurrence}
        >
          <SelectTrigger className="mt-2 w-full sm:w-[220px]" id="recurrence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Does not repeat</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          When completed, the next occurrence is created automatically with the
          same assignees.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={acknowledgementRequired}
          disabled={pending}
          name="acknowledgementRequired"
          onCheckedChange={(checked) =>
            setAcknowledgementRequired(checked === true)
          }
        />
        Require assignees to acknowledge this task
      </label>

      {employees.length === 0 ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Invite an employee from the Employees page before creating a task.
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium text-foreground">
            Assign to
          </legend>
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
            {employees.map((employee) => (
              <label
                className="flex items-center gap-2 text-sm text-foreground"
                key={employee.userId}
              >
                <Checkbox
                  defaultChecked={employee.userId === defaultAssigneeId}
                  disabled={pending}
                  name="assigneeIds"
                  value={employee.userId}
                />
                {employee.displayName}
              </label>
            ))}
          </div>
          <FieldError>{error?.fields?.assigneeIds?.[0]}</FieldError>
        </fieldset>
      )}

      {error ? (
        <div
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          <p>{error.message}</p>
          <p className="mt-1 text-xs text-red-400">
            Reference: {error.traceId}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="disabled:cursor-not-allowed"
          disabled={pending || employees.length === 0}
          size="lg"
          type="submit"
        >
          {pending ? 'Creating…' : 'Create & Assign'}
        </Button>

        {savingTemplate ? (
          <div className="flex items-center gap-2">
            <Input
              className="h-9 w-48"
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
              value={templateName}
            />
            <Button onClick={saveAsTemplate} size="sm" type="button">
              Save
            </Button>
            <Button
              onClick={() => setSavingTemplate(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setSavingTemplate(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            Save as template
          </Button>
        )}
      </div>
    </form>
  );
}
