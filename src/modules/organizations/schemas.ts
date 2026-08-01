import { z } from 'zod';

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const organizationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().refine(isIanaTimezone, 'Invalid timezone'),
});
