'use server';

import { randomUUID } from 'node:crypto';

import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { createServerSupabase } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/result';
import { getMembershipAccess } from '@/modules/members/queries';

import { roleLandingPath } from './navigation';
import { loginSchema } from './schemas';

const INVALID_INPUT_MESSAGE = 'Enter a valid email and password.';
const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.';
const LOGIN_UNAVAILABLE_MESSAGE =
  'We could not complete sign in. Please try again.';

function invalidLogin(
  traceId: string,
  message: string,
  fields?: Record<string, string[]>,
): ActionResult<null> {
  return {
    ok: false,
    error: { code: 'INVALID_LOGIN', message, traceId, fields },
  };
}

function unavailableLogin(traceId: string): ActionResult<null> {
  return {
    ok: false,
    error: {
      code: 'LOGIN_UNAVAILABLE',
      message: LOGIN_UNAVAILABLE_MESSAGE,
      traceId,
    },
  };
}

function isOperationalAuthError(error: unknown) {
  return (
    isAuthRetryableFetchError(error) ||
    (isAuthApiError(error) && error.status >= 500)
  );
}

export async function login(
  _previousState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return invalidLogin(
      traceId,
      INVALID_INPUT_MESSAGE,
      parsed.error.flatten().fieldErrors,
    );
  }

  let authenticationError: unknown;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    authenticationError = error;
  } catch {
    return unavailableLogin(traceId);
  }

  if (isOperationalAuthError(authenticationError)) {
    return unavailableLogin(traceId);
  }

  if (authenticationError) {
    return invalidLogin(traceId, INVALID_CREDENTIALS_MESSAGE);
  }

  let access;

  try {
    access = await getMembershipAccess();
  } catch {
    return unavailableLogin(traceId);
  }

  if (access.kind === 'redirect') {
    if (access.location === '/access-pending') {
      redirect(access.location);
    }

    return unavailableLogin(traceId);
  }

  redirect(roleLandingPath(access.membership.role));
}
