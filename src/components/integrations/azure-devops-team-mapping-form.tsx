'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ActionResult } from '@/lib/result';
import type {
  AzureAccount,
  AzureProject,
  AzureTeam,
} from '@/modules/azure-devops/client/discovery';
import {
  listAccessibleAzureOrganizations,
  listAzureProjects,
  listAzureTeams,
  saveAzureTeamLink,
  selectAzureOrganization,
} from '@/modules/azure-devops/connections/actions';
import type { AzureDevOpsConnectionView } from '@/modules/azure-devops/connections/queries';
import type { PlanningTeamSummary } from '@/modules/planning-teams/queries';

function errorMessage(result: ActionResult<unknown>): string | null {
  return result.ok ? null : result.error.message;
}

function OrganizationPicker({ onConnected }: { onConnected: () => void }) {
  const [accounts, setAccounts] = useState<readonly AzureAccount[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAccessibleAzureOrganizations().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAccounts(result.data);
      } else {
        setLoadError(result.error.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmOrganization() {
    if (!selectedId) return;
    setSaving(true);
    setSaveError(null);
    const result = await selectAzureOrganization({
      azureAccountId: selectedId,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(errorMessage(result));
      return;
    }
    onConnected();
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="azure-organization-select">
        Azure DevOps organization
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          disabled={!accounts || accounts.length === 0 || saving}
          onValueChange={setSelectedId}
          value={selectedId}
        >
          <SelectTrigger id="azure-organization-select">
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {(accounts ?? []).map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!selectedId || saving}
          onClick={confirmOrganization}
          type="button"
        >
          {saving ? 'Saving…' : 'Use this organization'}
        </Button>
      </div>
      {accounts && accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No accessible Azure DevOps organizations were found for this account.
        </p>
      ) : null}
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>{loadError}</AlertTitle>
        </Alert>
      ) : null}
      {saveError ? (
        <Alert variant="destructive">
          <AlertTitle>{saveError}</AlertTitle>
        </Alert>
      ) : null}
    </div>
  );
}

function TeamLinkPicker({
  availablePlanningTeams,
  onSaved,
}: {
  availablePlanningTeams: readonly PlanningTeamSummary[];
  onSaved: () => void;
}) {
  const [projects, setProjects] = useState<readonly AzureProject[] | null>(
    null,
  );
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [teams, setTeams] = useState<readonly AzureTeam[] | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loadedProjectId, setLoadedProjectId] = useState('');

  const [selectedPlanningTeamId, setSelectedPlanningTeamId] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAzureProjects().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setProjects(result.data);
      } else {
        setProjectsError(result.error.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (selectedProjectId !== loadedProjectId) {
    setLoadedProjectId(selectedProjectId);
    setSelectedTeamId('');
    setTeams(null);
    setTeamsError(null);
  }

  useEffect(() => {
    if (!selectedProjectId) return;

    let cancelled = false;
    listAzureTeams({ azureProjectId: selectedProjectId }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setTeams(result.data);
      } else {
        setTeamsError(result.error.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  async function confirmMapping() {
    const project = (projects ?? []).find(
      (candidate) => candidate.id === selectedProjectId,
    );
    const team = (teams ?? []).find(
      (candidate) => candidate.id === selectedTeamId,
    );
    if (!project || !team || !selectedPlanningTeamId) return;

    setSaving(true);
    setSaveError(null);
    const result = await saveAzureTeamLink({
      planningTeamId: selectedPlanningTeamId,
      azureProjectId: project.id,
      azureProjectName: project.name,
      azureTeamId: team.id,
      azureTeamName: team.name,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(errorMessage(result));
      return;
    }
    setSelectedProjectId('');
    setSelectedTeamId('');
    setSelectedPlanningTeamId('');
    onSaved();
  }

  if (availablePlanningTeams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every visible planning team is already mapped to an Azure DevOps team.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="azure-project-select">Azure project</Label>
          <Select
            disabled={!projects || projects.length === 0 || saving}
            onValueChange={setSelectedProjectId}
            value={selectedProjectId}
          >
            <SelectTrigger className="mt-2 w-full" id="azure-project-select">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {(projects ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="azure-team-select">Azure team</Label>
          <Select
            disabled={!selectedProjectId || !teams || saving}
            onValueChange={setSelectedTeamId}
            value={selectedTeamId}
          >
            <SelectTrigger className="mt-2 w-full" id="azure-team-select">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {(teams ?? []).map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="planning-team-select">TaskFlow planning team</Label>
          <Select
            disabled={saving}
            onValueChange={setSelectedPlanningTeamId}
            value={selectedPlanningTeamId}
          >
            <SelectTrigger className="mt-2 w-full" id="planning-team-select">
              <SelectValue placeholder="Select a planning team" />
            </SelectTrigger>
            <SelectContent>
              {availablePlanningTeams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        disabled={
          !selectedProjectId ||
          !selectedTeamId ||
          !selectedPlanningTeamId ||
          saving
        }
        onClick={confirmMapping}
        type="button"
      >
        {saving ? 'Saving…' : 'Map planning team'}
      </Button>

      {projectsError ? (
        <Alert variant="destructive">
          <AlertTitle>{projectsError}</AlertTitle>
        </Alert>
      ) : null}
      {teamsError ? (
        <Alert variant="destructive">
          <AlertTitle>{teamsError}</AlertTitle>
        </Alert>
      ) : null}
      {saveError ? (
        <Alert variant="destructive">
          <AlertTitle>{saveError}</AlertTitle>
        </Alert>
      ) : null}
    </div>
  );
}

export function AzureDevOpsTeamMappingForm({
  connection,
  planningTeams,
}: {
  connection: AzureDevOpsConnectionView;
  planningTeams: readonly PlanningTeamSummary[];
}) {
  const router = useRouter();
  const mappedPlanningTeamIds = new Set(
    connection.teamLinks.map((link) => link.planningTeamId),
  );
  const availablePlanningTeams = planningTeams.filter(
    (team) => !mappedPlanningTeamIds.has(team.id),
  );
  const planningTeamNames = new Map(
    planningTeams.map((team) => [team.id, team.name]),
  );

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-heading text-lg font-medium text-foreground">
        Team mapping
      </h2>

      {connection.teamLinks.length > 0 ? (
        <ul className="space-y-2">
          {connection.teamLinks.map((link) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              key={link.id}
            >
              <span className="font-medium text-foreground">
                {planningTeamNames.get(link.planningTeamId) ?? 'Planning team'}
              </span>
              <span className="text-muted-foreground">
                {link.azureProjectName} / {link.azureTeamName}
              </span>
              <Badge
                variant={link.status === 'configured' ? 'success' : 'outline'}
              >
                {link.status === 'configured'
                  ? 'Ready for initial import'
                  : link.status}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {connection.organization ? (
        <TeamLinkPicker
          availablePlanningTeams={availablePlanningTeams}
          onSaved={() => router.refresh()}
        />
      ) : (
        <OrganizationPicker onConnected={() => router.refresh()} />
      )}
    </div>
  );
}
