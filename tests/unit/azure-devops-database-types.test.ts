import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const databaseTypes = readFileSync(
  resolve(process.cwd(), 'src/lib/supabase/database.types.ts'),
  'utf8',
);

const tableDefinition = (tableName: string) => {
  const match = databaseTypes.match(
    new RegExp(
      `\\n      ${tableName}: \\{([\\s\\S]*?)\\n      \\};\\n(?=      [a-z_]+: \\{|    \\};\\n    Views:)`,
    ),
  );

  expect(match, `generated table ${tableName} is missing`).not.toBeNull();
  return match?.[1] ?? '';
};

const functionDefinition = (functionName: string) => {
  const match = databaseTypes.match(
    new RegExp(
      `\\n      ${functionName}: \\{([\\s\\S]*?)\\n      \\};\\n(?=      [a-z_]+: \\{|    \\};\\n    Enums:)`,
    ),
  );

  expect(match, `generated RPC ${functionName} is missing`).not.toBeNull();
  return match?.[1] ?? '';
};

describe('Azure DevOps generated database types', () => {
  it('includes the Azure DevOps connection tables', () => {
    for (const tableName of [
      'azure_devops_connections',
      'azure_devops_oauth_states',
      'azure_devops_team_links',
    ]) {
      const definition = tableDefinition(tableName);
      expect(definition).toMatch(/Row: \{/);
      expect(definition).toMatch(/Insert: \{/);
      expect(definition).toMatch(/Update: \{/);
      expect(definition).toMatch(/Relationships: /);
    }
  });

  it('preserves the Azure DevOps connection status enum order', () => {
    expect(databaseTypes).toMatch(
      /azure_devops_connection_status:\s*'pending'\s*\|\s*'configured'\s*\|\s*'paused'\s*\|\s*'disconnected';/,
    );
    expect(databaseTypes).toMatch(
      /azure_devops_connection_status:\s*\[\s*'pending',\s*'configured',\s*'paused',\s*'disconnected',?\s*\],/,
    );
  });

  it('includes the Azure DevOps OAuth state consumption RPC signature', () => {
    const definition = functionDefinition('consume_azure_devops_oauth_state');

    expect(definition).toMatch(
      /Args: \{\s*target_organization_id: string;\s*target_state_hash: string;\s*target_user_id: string;\s*\};/,
    );
    expect(definition).toMatch(
      /Returns: \{\s*pkce_verifier_ciphertext: string;\s*return_path: string;\s*\}\[];/,
    );
  });

  it('includes the atomic Azure DevOps OAuth connection persistence RPC signature', () => {
    const definition = functionDefinition(
      'persist_azure_devops_oauth_connection',
    );

    expect(definition).toMatch(
      /Args: \{\s*target_access_token_ciphertext: string;\s*target_actor_id: string;\s*target_authorized_user_display_name: string;\s*target_authorized_user_email\?: string;\s*target_authorized_user_id: string;\s*target_granted_scopes: string\[\];\s*target_organization_id: string;\s*target_refresh_token_ciphertext: string;\s*target_tenant_id: string;\s*target_token_expires_at: string;\s*\};/,
    );
    expect(definition).toMatch(
      /Returns: \{\s*connection_id: string;\s*connection_status: Database\['public'\]\['Enums'\]\['azure_devops_connection_status'\];\s*credentials_applied: boolean;\s*was_existing: boolean;\s*\}\[];/,
    );
  });

  it('includes the Azure DevOps team link configuration RPC signature', () => {
    const definition = functionDefinition('configure_azure_devops_team_link');

    expect(definition).toMatch(
      /Args: \{\s*target_azure_project_id: string;\s*target_azure_project_name: string;\s*target_azure_team_id: string;\s*target_azure_team_name: string;\s*target_connection_id: string;\s*target_created_by: string;\s*target_organization_id: string;\s*target_planning_team_id: string;\s*\};/,
    );
    expect(definition).toMatch(/Returns: string;/);
  });

  it('includes the Azure DevOps disconnection RPC signature', () => {
    const definition = functionDefinition('disconnect_azure_devops_connection');

    expect(definition).toMatch(
      /Args: \{\s*target_connection_id: string;\s*target_organization_id: string\s*\};/,
    );
    expect(definition).toMatch(/Returns: boolean;/);
  });
});
