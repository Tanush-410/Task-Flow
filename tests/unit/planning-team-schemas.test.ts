import { describe, expect, it } from 'vitest';

import {
  planningTeamArchiveSchema,
  planningTeamCreateSchema,
  planningTeamMembersSchema,
  planningTeamUpdateSchema,
} from '@/modules/planning-teams/schemas';

const teamId = '11111111-1111-4111-8111-111111111111';
const firstUserId = '22222222-2222-4222-8222-222222222222';
const secondUserId = '33333333-3333-4333-8333-333333333333';

describe('planning team schemas', () => {
  it('normalizes a valid team', () => {
    expect(
      planningTeamCreateSchema.parse({
        name: ' Platform ',
        description: ' Delivery team ',
        defaultSprintLengthDays: 14,
      }),
    ).toEqual({
      name: 'Platform',
      description: 'Delivery team',
      defaultSprintLengthDays: 14,
    });
  });

  it.each([0, 43, 1.5])('rejects cadence %s', (days) => {
    expect(
      planningTeamCreateSchema.safeParse({
        name: 'Team',
        description: '',
        defaultSprintLengthDays: days,
      }).success,
    ).toBe(false);
  });

  it('accepts valid team members', () => {
    expect(
      planningTeamMembersSchema.parse({
        teamId,
        members: [
          {
            userId: firstUserId,
            role: 'planner',
            capacityHoursPerDay: 7.5,
          },
          {
            userId: secondUserId,
            role: 'member',
            capacityHoursPerDay: 8,
          },
        ],
      }),
    ).toMatchObject({ teamId });
  });

  it('rejects duplicate members', () => {
    const result = planningTeamMembersSchema.safeParse({
      teamId,
      members: [
        { userId: firstUserId, role: 'member', capacityHoursPerDay: 8 },
        { userId: firstUserId, role: 'planner', capacityHoursPerDay: 6 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['members']);
    }
  });

  it.each([-1, 25, Number.NaN])('rejects capacity %s', (capacity) => {
    expect(
      planningTeamMembersSchema.safeParse({
        teamId,
        members: [
          {
            userId: firstUserId,
            role: 'member',
            capacityHoursPerDay: capacity,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects invalid ids and roles', () => {
    expect(
      planningTeamMembersSchema.safeParse({
        teamId: 'not-a-uuid',
        members: [
          {
            userId: 'also-not-a-uuid',
            role: 'owner',
            capacityHoursPerDay: 8,
          },
        ],
      }).success,
    ).toBe(false);
    expect(planningTeamArchiveSchema.safeParse({ teamId: 'bad' }).success).toBe(
      false,
    );
  });

  it('requires an id when updating a team', () => {
    expect(
      planningTeamUpdateSchema.safeParse({
        name: 'Platform',
        description: '',
        defaultSprintLengthDays: 14,
      }).success,
    ).toBe(false);
  });
});
