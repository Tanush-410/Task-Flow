'use server';

import { randomUUID } from 'node:crypto';

import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { serverEnv } from '@/lib/server-env';
import { createAdminSupabase } from '@/lib/supabase/admin';
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
  requestPasswordResetSchema,
  resetPasswordSchema,
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

  // Self-service signup is deliberately implemented as a privileged,
  // server-only account creation (via the service-role admin client) rather
  // than the public Supabase Auth signup endpoint. This keeps that public
  // endpoint free to stay locked down, sidesteps whatever "confirm email"
  // setting the project happens to have, and creates the account already
  // confirmed so the user can sign in immediately in the same request.
  let creationError: unknown;

  try {
    const admin = createAdminSupabase();
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    creationError = error;
  } catch {
    return unavailableSignup(traceId);
  }

  if (
    isAuthApiError(creationError) &&
    (creationError.status === 422 ||
      (creationError.code !== undefined &&
        EMAIL_IN_USE_CODES.has(creationError.code)))
  ) {
    return {
      ok: false,
      error: { code: 'EMAIL_IN_USE', message: EMAIL_IN_USE_MESSAGE, traceId },
    };
  }

  if (isOperationalAuthError(creationError)) {
    return unavailableSignup(traceId);
  }

  if (creationError) {
    return unavailableSignup(traceId);
  }

  const supabase = await createServerSupabase();
  let signInError: unknown;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    signInError = error;
  } catch {
    return unavailableSignup(traceId);
  }

  if (signInError) {
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

const RESET_UNAVAILABLE_MESSAGE =
  'We could not send the reset link. Please try again.';
const RESET_INVALID_LINK_MESSAGE =
  'This reset link is invalid or has expired. Request a new one.';

export async function requestPasswordReset(
  _previousState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = requestPasswordResetSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_EMAIL',
        message: 'Enter a valid email address.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const { APP_ORIGIN } = serverEnv();
    const redirectUrl = new URL('/auth/callback', APP_ORIGIN);
    redirectUrl.searchParams.set('next', '/reset-password');

    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: redirectUrl.toString() },
    );

    // Supabase itself never reveals whether the email exists — don't
    // surface that either, only genuine send failures (rate limit, etc.).
    if (error && isOperationalAuthError(error)) {
      return {
        ok: false,
        error: {
          code: 'RESET_UNAVAILABLE',
          message: RESET_UNAVAILABLE_MESSAGE,
          traceId,
        },
      };
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'RESET_UNAVAILABLE',
        message: RESET_UNAVAILABLE_MESSAGE,
        traceId,
      },
    };
  }

  return { ok: true, data: null };
}

export async function resetPassword(
  _previousState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const traceId = randomUUID();
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Check your password.',
        traceId,
        fields: parsed.error.flatten().fieldErrors,
      },
    };
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return {
        ok: false,
        error: {
          code: 'RESET_FAILED',
          message: RESET_INVALID_LINK_MESSAGE,
          traceId,
        },
      };
    }

    await supabase.auth.signOut();
  } catch {
    return {
      ok: false,
      error: {
        code: 'RESET_FAILED',
        message: RESET_INVALID_LINK_MESSAGE,
        traceId,
      },
    };
  }

  redirect('/login?reset=success');
}
