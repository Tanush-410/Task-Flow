export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      connection_requests: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          requested_user_id: string;
          responded_at: string | null;
          role: Database['public']['Enums']['membership_role'];
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string;
          organization_id: string;
          requested_user_id: string;
          responded_at?: string | null;
          role: Database['public']['Enums']['membership_role'];
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          requested_user_id?: string;
          responded_at?: string | null;
          role?: Database['public']['Enums']['membership_role'];
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'connection_requests_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connection_requests_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'connection_requests_requested_user_id_fkey';
            columns: ['requested_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_flag_audit_log: {
        Row: {
          action: string;
          changed_at: string;
          changed_by: string | null;
          feature_flag_id: string;
          flag_key: string;
          id: string;
          new_record: Json | null;
          old_record: Json | null;
          organization_id: string | null;
        };
        Insert: {
          action: string;
          changed_at?: string;
          changed_by?: string | null;
          feature_flag_id: string;
          flag_key: string;
          id?: string;
          new_record?: Json | null;
          old_record?: Json | null;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          changed_at?: string;
          changed_by?: string | null;
          feature_flag_id?: string;
          flag_key?: string;
          id?: string;
          new_record?: Json | null;
          old_record?: Json | null;
          organization_id?: string | null;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          created_at: string;
          enabled: boolean;
          environment: Database['public']['Enums']['deployment_environment'];
          expires_on: string;
          id: string;
          key: string;
          organization_id: string | null;
          owner: string;
          purpose: string;
          review_on: string;
          role_scope: Database['public']['Enums']['membership_role'] | null;
          rollout_percentage: number;
          rollout_plan: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          environment: Database['public']['Enums']['deployment_environment'];
          expires_on: string;
          id?: string;
          key: string;
          organization_id?: string | null;
          owner: string;
          purpose: string;
          review_on: string;
          role_scope?: Database['public']['Enums']['membership_role'] | null;
          rollout_percentage?: number;
          rollout_plan: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          environment?: Database['public']['Enums']['deployment_environment'];
          expires_on?: string;
          id?: string;
          key?: string;
          organization_id?: string | null;
          owner?: string;
          purpose?: string;
          review_on?: string;
          role_scope?: Database['public']['Enums']['membership_role'] | null;
          rollout_percentage?: number;
          rollout_plan?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feature_flags_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          delivery_status: Database['public']['Enums']['invitation_delivery_status'];
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          revoked_at: string | null;
          role: Database['public']['Enums']['membership_role'];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          delivery_status?: Database['public']['Enums']['invitation_delivery_status'];
          email: string;
          expires_at: string;
          id?: string;
          invited_by?: string;
          organization_id: string;
          revoked_at?: string | null;
          role: Database['public']['Enums']['membership_role'];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          delivery_status?: Database['public']['Enums']['invitation_delivery_status'];
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['membership_role'];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      note_checklist_items: {
        Row: {
          checked: boolean;
          created_at: string;
          id: string;
          note_id: string;
          position: number;
          text: string;
          user_id: string;
        };
        Insert: {
          checked?: boolean;
          created_at?: string;
          id?: string;
          note_id: string;
          position?: number;
          text?: string;
          user_id: string;
        };
        Update: {
          checked?: boolean;
          created_at?: string;
          id?: string;
          note_id?: string;
          position?: number;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'note_checklist_items_note_id_fkey';
            columns: ['note_id'];
            isOneToOne: false;
            referencedRelation: 'notes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_checklist_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          archived: boolean;
          body: string;
          color: string;
          created_at: string;
          id: string;
          note_type: string;
          pinned: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          body?: string;
          color?: string;
          created_at?: string;
          id?: string;
          note_type?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          body?: string;
          color?: string;
          created_at?: string;
          id?: string;
          note_type?: string;
          pinned?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_memberships: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database['public']['Enums']['membership_role'];
          status: Database['public']['Enums']['membership_status'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['membership_status'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['membership_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      planning_team_members: {
        Row: {
          created_at: string;
          default_capacity_hours_per_day: number;
          id: string;
          organization_id: string;
          planning_role: Database['public']['Enums']['planning_role'];
          planning_team_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          default_capacity_hours_per_day?: number;
          id?: string;
          organization_id: string;
          planning_role?: Database['public']['Enums']['planning_role'];
          planning_team_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_capacity_hours_per_day?: number;
          id?: string;
          organization_id?: string;
          planning_role?: Database['public']['Enums']['planning_role'];
          planning_team_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'planning_team_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_team_members_planning_team_id_fkey';
            columns: ['planning_team_id'];
            isOneToOne: false;
            referencedRelation: 'planning_teams';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_team_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      planning_teams: {
        Row: {
          created_at: string;
          created_by: string;
          default_sprint_length_days: number;
          description: string;
          id: string;
          is_archived: boolean;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string;
          default_sprint_length_days?: number;
          description?: string;
          id?: string;
          is_archived?: boolean;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          default_sprint_length_days?: number;
          description?: string;
          id?: string;
          is_archived?: boolean;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'planning_teams_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'planning_teams_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          connect_code: string;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          connect_code: string;
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          connect_code?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      task_acknowledgements: {
        Row: {
          acknowledged_at: string;
          acknowledged_by: string;
          activity_event_id: string;
          assignment_id: string;
          created_at: string;
          id: string;
          note: string | null;
          organization_id: string;
          task_id: string;
        };
        Insert: {
          acknowledged_at?: string;
          acknowledged_by: string;
          activity_event_id: string;
          assignment_id: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          organization_id: string;
          task_id: string;
        };
        Update: {
          acknowledged_at?: string;
          acknowledged_by?: string;
          activity_event_id?: string;
          assignment_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          organization_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_acknowledgements_acknowledged_by_fkey';
            columns: ['acknowledged_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_acknowledgements_activity_event_id_fkey';
            columns: ['activity_event_id'];
            isOneToOne: false;
            referencedRelation: 'task_activity_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_acknowledgements_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'task_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_acknowledgements_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_acknowledgements_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_activity_events: {
        Row: {
          actor_id: string | null;
          after_record: Json | null;
          assignment_id: string | null;
          before_record: Json | null;
          created_at: string;
          event_type: Database['public']['Enums']['task_activity_type'];
          id: string;
          organization_id: string;
          summary: string;
          task_id: string;
        };
        Insert: {
          actor_id?: string | null;
          after_record?: Json | null;
          assignment_id?: string | null;
          before_record?: Json | null;
          created_at?: string;
          event_type: Database['public']['Enums']['task_activity_type'];
          id?: string;
          organization_id: string;
          summary: string;
          task_id: string;
        };
        Update: {
          actor_id?: string | null;
          after_record?: Json | null;
          assignment_id?: string | null;
          before_record?: Json | null;
          created_at?: string;
          event_type?: Database['public']['Enums']['task_activity_type'];
          id?: string;
          organization_id?: string;
          summary?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_activity_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_activity_events_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'task_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_activity_events_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_activity_events_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_assignments: {
        Row: {
          assigned_by: string;
          assignee_id: string;
          completed_at: string | null;
          created_at: string;
          delay_reason: string | null;
          id: string;
          organization_id: string;
          override_reason: string | null;
          progress: number;
          started_at: string | null;
          status: Database['public']['Enums']['assignment_status'];
          task_id: string;
          updated_at: string;
        };
        Insert: {
          assigned_by: string;
          assignee_id: string;
          completed_at?: string | null;
          created_at?: string;
          delay_reason?: string | null;
          id?: string;
          organization_id: string;
          override_reason?: string | null;
          progress?: number;
          started_at?: string | null;
          status?: Database['public']['Enums']['assignment_status'];
          task_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string;
          assignee_id?: string;
          completed_at?: string | null;
          created_at?: string;
          delay_reason?: string | null;
          id?: string;
          organization_id?: string;
          override_reason?: string | null;
          progress?: number;
          started_at?: string | null;
          status?: Database['public']['Enums']['assignment_status'];
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_assignments_assignee_id_fkey';
            columns: ['assignee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_assignments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_assignments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_attachments: {
        Row: {
          created_at: string;
          file_name: string;
          file_size: number;
          id: string;
          mime_type: string;
          organization_id: string;
          storage_path: string;
          task_id: string;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          file_size: number;
          id?: string;
          mime_type: string;
          organization_id: string;
          storage_path: string;
          task_id: string;
          uploaded_by: string;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          organization_id?: string;
          storage_path?: string;
          task_id?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_attachments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_attachments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_attachments_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      task_checklist_items: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          is_done: boolean;
          organization_id: string;
          position: number;
          task_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          is_done?: boolean;
          organization_id: string;
          position?: number;
          task_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          is_done?: boolean;
          organization_id?: string;
          position?: number;
          task_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_checklist_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_checklist_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_checklist_items_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          organization_id: string;
          task_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          task_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_comments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_comments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_dependencies: {
        Row: {
          created_at: string;
          created_by: string;
          depends_on_task_id: string;
          id: string;
          organization_id: string;
          task_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          depends_on_task_id: string;
          id?: string;
          organization_id: string;
          task_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          depends_on_task_id?: string;
          id?: string;
          organization_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_dependencies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_dependencies_depends_on_task_id_fkey';
            columns: ['depends_on_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_dependencies_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_dependencies_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_mutes: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          task_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          task_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_mutes_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_mutes_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_mutes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      task_notifications: {
        Row: {
          assignment_id: string | null;
          body: string;
          created_at: string;
          delivered_at: string | null;
          id: string;
          notification_type: Database['public']['Enums']['task_notification_type'];
          organization_id: string;
          payload: Json;
          read_at: string | null;
          recipient_id: string;
          task_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignment_id?: string | null;
          body: string;
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          notification_type: Database['public']['Enums']['task_notification_type'];
          organization_id: string;
          payload?: Json;
          read_at?: string | null;
          recipient_id: string;
          task_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string | null;
          body?: string;
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          notification_type?: Database['public']['Enums']['task_notification_type'];
          organization_id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_id?: string;
          task_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_notifications_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'task_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_notifications_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_templates: {
        Row: {
          acknowledgement_required: boolean;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          name: string;
          organization_id: string;
          priority: Database['public']['Enums']['task_priority'];
          recurrence: Database['public']['Enums']['task_recurrence'];
          title: string;
        };
        Insert: {
          acknowledgement_required?: boolean;
          created_at?: string;
          created_by: string;
          description?: string;
          id?: string;
          name: string;
          organization_id: string;
          priority?: Database['public']['Enums']['task_priority'];
          recurrence?: Database['public']['Enums']['task_recurrence'];
          title: string;
        };
        Update: {
          acknowledgement_required?: boolean;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          recurrence?: Database['public']['Enums']['task_recurrence'];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_templates_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          acknowledgement_required: boolean;
          archived_at: string | null;
          backlog_rank: string | null;
          created_at: string;
          created_by: string;
          description: string;
          due_at: string | null;
          found_in_build: string | null;
          id: string;
          organization_id: string;
          original_hours: number | null;
          parent_task_id: string | null;
          planning_team_id: string | null;
          priority: Database['public']['Enums']['task_priority'];
          published_at: string | null;
          recurrence: Database['public']['Enums']['task_recurrence'];
          remaining_hours: number | null;
          repro_steps: string | null;
          severity: Database['public']['Enums']['task_priority'] | null;
          start_at: string | null;
          status: Database['public']['Enums']['task_status'];
          story_points: number | null;
          title: string;
          updated_at: string;
          work_item_type: Database['public']['Enums']['work_item_type'];
        };
        Insert: {
          acknowledgement_required?: boolean;
          archived_at?: string | null;
          backlog_rank?: string | null;
          created_at?: string;
          created_by: string;
          description?: string;
          due_at?: string | null;
          found_in_build?: string | null;
          id?: string;
          organization_id: string;
          original_hours?: number | null;
          parent_task_id?: string | null;
          planning_team_id?: string | null;
          priority?: Database['public']['Enums']['task_priority'];
          published_at?: string | null;
          recurrence?: Database['public']['Enums']['task_recurrence'];
          remaining_hours?: number | null;
          repro_steps?: string | null;
          severity?: Database['public']['Enums']['task_priority'] | null;
          start_at?: string | null;
          status?: Database['public']['Enums']['task_status'];
          story_points?: number | null;
          title: string;
          updated_at?: string;
          work_item_type?: Database['public']['Enums']['work_item_type'];
        };
        Update: {
          acknowledgement_required?: boolean;
          archived_at?: string | null;
          backlog_rank?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          due_at?: string | null;
          found_in_build?: string | null;
          id?: string;
          organization_id?: string;
          original_hours?: number | null;
          parent_task_id?: string | null;
          planning_team_id?: string | null;
          priority?: Database['public']['Enums']['task_priority'];
          published_at?: string | null;
          recurrence?: Database['public']['Enums']['task_recurrence'];
          remaining_hours?: number | null;
          repro_steps?: string | null;
          severity?: Database['public']['Enums']['task_priority'] | null;
          start_at?: string | null;
          status?: Database['public']['Enums']['task_status'];
          story_points?: number | null;
          title?: string;
          updated_at?: string;
          work_item_type?: Database['public']['Enums']['work_item_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_parent_task_id_fkey';
            columns: ['parent_task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_planning_team_id_fkey';
            columns: ['planning_team_id'];
            isOneToOne: false;
            referencedRelation: 'planning_teams';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: { invitation_token_hash: string };
        Returns: {
          out_organization_id: string;
          out_role: Database['public']['Enums']['membership_role'];
        }[];
      };
      archive_planning_team: {
        Args: { target_team_id: string };
        Returns: boolean;
      };
      assign_backlog_rank: {
        Args: {
          after_task_id?: string;
          before_task_id?: string;
          target_task_id: string;
        };
        Returns: string;
      };
      backlog_rank_midpoint: {
        Args: { lower_rank: string; upper_rank: string };
        Returns: string;
      };
      bootstrap_organization: {
        Args: { organization_name: string; organization_timezone: string };
        Returns: string;
      };
      count_work_item_descendants: {
        Args: { target_task_id: string };
        Returns: number;
      };
      create_connection_request: {
        Args: {
          target_code: string;
          target_role: Database['public']['Enums']['membership_role'];
        };
        Returns: {
          request_id: string;
          target_display_name: string;
        }[];
      };
      create_work_item: {
        Args: {
          item_description: string;
          item_found_in_build?: string;
          item_original_hours?: number;
          item_priority: Database['public']['Enums']['task_priority'];
          item_remaining_hours?: number;
          item_repro_steps?: string;
          item_severity?: Database['public']['Enums']['task_priority'];
          item_story_points?: number;
          item_title: string;
          item_type: Database['public']['Enums']['work_item_type'];
          target_parent_task_id?: string;
          target_planning_team_id: string;
        };
        Returns: string;
      };
      discard_staged_invitation: {
        Args: { invitation_id: string };
        Returns: boolean;
      };
      finalize_invitation_delivery: {
        Args: { invitation_id: string };
        Returns: boolean;
      };
      generate_connect_code: { Args: never; Returns: string };
      is_active_admin: { Args: never; Returns: boolean };
      is_active_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      is_admin: { Args: { target_organization_id: string }; Returns: boolean };
      is_planning_team_member: {
        Args: { target_team_id: string };
        Returns: boolean;
      };
      is_planning_team_planner: {
        Args: { target_team_id: string };
        Returns: boolean;
      };
      is_task_admin: { Args: { target_task_id: string }; Returns: boolean };
      is_task_assignment_owner: {
        Args: { target_assignment_id: string };
        Returns: boolean;
      };
      is_task_org_member: {
        Args: { target_task_id: string };
        Returns: boolean;
      };
      is_task_participant: {
        Args: { target_task_id: string };
        Returns: boolean;
      };
      is_task_planning_team_member: {
        Args: { target_task_id: string };
        Returns: boolean;
      };
      join_organization_as_employee: {
        Args: { target_organization_id: string };
        Returns: string;
      };
      list_my_connection_requests: {
        Args: never;
        Returns: {
          created_at: string;
          id: string;
          invited_by_name: string;
          organization_name: string;
          role: Database['public']['Enums']['membership_role'];
        }[];
      };
      move_work_item: {
        Args: {
          include_descendants: boolean;
          new_parent_task_id?: string;
          new_planning_team_id: string;
          target_task_id: string;
        };
        Returns: number;
      };
      rebalance_backlog_siblings: {
        Args: {
          target_parent_task_id?: string;
          target_team_id: string;
          target_work_item_type: Database['public']['Enums']['work_item_type'];
        };
        Returns: number;
      };
      reestimate_work_item_hours: {
        Args: {
          new_original_hours: number;
          new_remaining_hours: number;
          target_task_id: string;
        };
        Returns: boolean;
      };
      register_organization_admin: {
        Args: { organization_name: string; organization_timezone: string };
        Returns: string;
      };
      replace_planning_team_members: {
        Args: { replacement_members: Json; target_team_id: string };
        Returns: boolean;
      };
      respond_to_connection_request: {
        Args: { accept: boolean; request_id: string };
        Returns: {
          out_organization_id: string;
          out_role: Database['public']['Enums']['membership_role'];
        }[];
      };
      stage_invitation: {
        Args: {
          invitation_email: string;
          invitation_expires_at: string;
          invitation_role: Database['public']['Enums']['membership_role'];
          invitation_token_hash: string;
        };
        Returns: {
          email: string;
          expires_at: string;
          id: string;
        }[];
      };
    };
    Enums: {
      assignment_status:
        'not_started' | 'in_progress' | 'delayed' | 'completed';
      deployment_environment: 'development' | 'staging' | 'production';
      invitation_delivery_status: 'pending_delivery' | 'active' | 'failed';
      membership_role: 'admin' | 'employee';
      membership_status: 'active' | 'deactivated';
      planning_role: 'planner' | 'member';
      task_activity_type:
        | 'task_created'
        | 'task_updated'
        | 'task_published'
        | 'task_archived'
        | 'assignment_created'
        | 'assignment_updated'
        | 'assignment_progress_changed'
        | 'assignment_status_changed'
        | 'assignment_delayed'
        | 'assignment_completed'
        | 'assignment_reopened'
        | 'task_acknowledgement_recorded';
      task_notification_type:
        | 'task_published'
        | 'task_updated'
        | 'assignment_created'
        | 'assignment_progress_changed'
        | 'assignment_status_changed'
        | 'assignment_delayed'
        | 'assignment_completed'
        | 'acknowledgement_required'
        | 'comment_added';
      task_priority: 'low' | 'medium' | 'high' | 'urgent';
      task_recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
      task_status: 'draft' | 'published' | 'archived';
      work_item_type: 'epic' | 'feature' | 'user_story' | 'task' | 'bug';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assignment_status: ['not_started', 'in_progress', 'delayed', 'completed'],
      deployment_environment: ['development', 'staging', 'production'],
      invitation_delivery_status: ['pending_delivery', 'active', 'failed'],
      membership_role: ['admin', 'employee'],
      membership_status: ['active', 'deactivated'],
      planning_role: ['planner', 'member'],
      task_activity_type: [
        'task_created',
        'task_updated',
        'task_published',
        'task_archived',
        'assignment_created',
        'assignment_updated',
        'assignment_progress_changed',
        'assignment_status_changed',
        'assignment_delayed',
        'assignment_completed',
        'assignment_reopened',
        'task_acknowledgement_recorded',
      ],
      task_notification_type: [
        'task_published',
        'task_updated',
        'assignment_created',
        'assignment_progress_changed',
        'assignment_status_changed',
        'assignment_delayed',
        'assignment_completed',
        'acknowledgement_required',
        'comment_added',
      ],
      task_priority: ['low', 'medium', 'high', 'urgent'],
      task_recurrence: ['none', 'daily', 'weekly', 'monthly'],
      task_status: ['draft', 'published', 'archived'],
      work_item_type: ['epic', 'feature', 'user_story', 'task', 'bug'],
    },
  },
} as const;
