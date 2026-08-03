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

import {
  isInvitationPath,
  roleLandingPath,
  sanitizeNextPath,
} from './navigation';
import {
  loginSchema,
  signUpAdminSchema,
  signUpEmployeeSchema,
} from './schemas';

const INVALID_INPUT_MESSAGE = 'Enter a valid email and password.';
const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.';
const LOGIN_UNAVAILABLE_MESSAGE =
  'We could not complete sign in. Please try again.';
const INVALID_SIGNUP_MESSAGE = 'Check the account details.';
const EMAIL_IN_USE_MESSAGE = 'An account with that email already exists.';
const SIGNUP_UNAVAILABLE_MESSAGE =
  'We could not complete sign up. Please try again.';
const REGISTRATION_FAILED_MESSAGE =
  'Your account was created, but your workspace could not be set up. Please try signing in, or contact support.';
const DEFAULT_ORGANIZATION_TIMEZONE = 'Asia/Kolkata';
const AUTH_RATE_LIMIT_CODES: ReadonlySet<string> = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
]);
const EMAIL_IN_USE_CODES: ReadonlySet<string> = new Set([
  'user_already_exists',
  'email_exists',
]);

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
    (isAuthApiError(error) &&
      (error.status === 429 ||
        error.status >= 500 ||
        (error.code !== undefined && AUTH_RATE_LIMIT_CODES.has(error.code))))
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

  const nextValue = formData.get('next');
  const nextPath = sanitizeNextPath(
    typeof nextValue === 'string' ? nextValue : null,
  );

  if (isInvitationPath(nextPath)) {
    return redirect(nextPath);
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

function invalidSignup(
  traceId: string,
  fields?: Record<string, string[]>,
): ActionResult<null> {
  return {
    ok: false,
    error: {
      code: 'INVALID_SIGNUP',
      message: INVALID_SIGNUP_MESSAGE,
      traceId,
      fields,
    },
  };
}

function unavailableSignup(traceId: string): ActionResult<null> {
  return {
    ok: false,
    error: {
      code: 'SIGNUP_UNAVAILABLE',
      message: SIGNUP_UNAVAILABLE_MESSAGE,
      traceId,
    },
  };
}

export async function signUp(
  _previousState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const rawRole = formData.get('role');
  const role = rawRole === 'admin' || rawRole === 'employee' ? rawRole : null;

  if (!role) {
    return invalidSignup(traceId);
  }

  const input = Object.fromEntries(formData);
  let email: string;
  let password: string;
  let displayName: string;
  let registration:
    | { role: 'admin'; organizationName: string }
    | { role: 'employee'; organizationId: string };

  if (role === 'admin') {
    const parsed = signUpAdminSchema.safeParse(input);

    if (!parsed.success) {
      return invalidSignup(traceId, parsed.error.flatten().fieldErrors);
    }

    ({ email, password, displayName } = parsed.data);
    registration = {
      role: 'admin',
      organizationName: parsed.data.organizationName,
    };
  } else {
    const parsed = signUpEmployeeSchema.safeParse(input);

    if (!parsed.success) {
      return invalidSignup(traceId, parsed.error.flatten().fieldErrors);
    }

    ({ email, password, displayName } = parsed.data);
    registration = {
      role: 'employee',
      organizationId: parsed.data.organizationId,
    };
  }

  const supabase = await createServerSupabase();
  let signUpError: unknown;
  let hasSession = false;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    signUpError = error;
    hasSession = Boolean(data.session);
  } catch {
    return unavailableSignup(traceId);
  }

  if (
    isAuthApiError(signUpError) &&
    (signUpError.status === 422 ||
      (signUpError.code !== undefined &&
        EMAIL_IN_USE_CODES.has(signUpError.code)))
  ) {
    return {
      ok: false,
      error: { code: 'EMAIL_IN_USE', message: EMAIL_IN_USE_MESSAGE, traceId },
    };
  }

  if (isOperationalAuthError(signUpError)) {
    return unavailableSignup(traceId);
  }

  if (signUpError || !hasSession) {
    return unavailableSignup(traceId);
  }

  const { error: registrationError } =
    registration.role === 'admin'
      ? await supabase.rpc('register_organization_admin', {
          organization_name: registration.organizationName,
          organization_timezone: DEFAULT_ORGANIZATION_TIMEZONE,
        })
      : await supabase.rpc('join_organization_as_employee', {
          target_organization_id: registration.organizationId,
        });

  if (registrationError) {
    return {
      ok: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: REGISTRATION_FAILED_MESSAGE,
        traceId,
      },
    };
  }

  redirect(roleLandingPath(role));
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
