'use server';

import { randomUUID } from 'node:crypto';

import type { ActionResult } from '@/lib/result';
import { createServerSupabase } from '@/lib/supabase/server';

import { requireMembership } from '../members/queries';
import { dependencyCreateSchema, dependencyDeleteSchema } from './schemas';

const DEPENDENCY_ERROR = {
  code: 'DEPENDENCY_UPDATE_FAILED',
  message: 'The dependency could not be updated.',
} as const;

export async function createDependency(
  input: unknown,
): Promise<ActionResult<{ dependencyId: string }>> {
  const traceId = randomUUID();
  const parsed = dependencyCreateSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_DEPENDENCY',
        message:
          parsed.error.issues[0]?.message ?? 'Check the dependency details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const membership = await requireMembership();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('task_dependencies')
      .insert({
        organization_id: membership.organizationId,
        task_id: parsed.data.taskId,
        depends_on_task_id: parsed.data.dependsOnTaskId,
        created_by: membership.userId,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: { ...DEPENDENCY_ERROR, traceId } };
    }

    return { ok: true, data: { dependencyId: data.id } };
  } catch {
    return { ok: false, error: { ...DEPENDENCY_ERROR, traceId } };
  }
}

export async function deleteDependency(
  input: unknown,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = dependencyDeleteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_DEPENDENCY',
        message: 'Check the dependency details.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    await requireMembership();
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from('task_dependencies')
      .delete()
      .eq('id', parsed.data.dependencyId);

    if (error) {
      return { ok: false, error: { ...DEPENDENCY_ERROR, traceId } };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { ...DEPENDENCY_ERROR, traceId } };
  }
}
