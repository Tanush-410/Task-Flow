export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
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
          rollout_plan: string;
          rollout_percentage: number;
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
          rollout_plan: string;
          rollout_percentage?: number;
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
          rollout_plan?: string;
          rollout_percentage?: number;
          updated_at?: string;
        };
        Relationships: [];
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
          role: Database['public']['Enums']['membership_role'];
          revoked_at: string | null;
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
          role: Database['public']['Enums']['membership_role'];
          revoked_at?: string | null;
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
          role?: Database['public']['Enums']['membership_role'];
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
          connect_code?: string;
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
        Relationships: [];
      };
      task_acknowledgements: {
        Row: {
          acknowledged_at: string;
          acknowledged_by: string;
          activity_event_id: string;
          assignee_id: string;
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
          assignee_id: string;
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
          assignee_id?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          organization_id?: string;
          task_id?: string;
        };
        Relationships: [];
      };
      task_activity_events: {
        Row: {
          actor_id: string | null;
          assignment_id: string | null;
          after_record: Json | null;
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
          assignment_id?: string | null;
          after_record?: Json | null;
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
          assignment_id?: string | null;
          after_record?: Json | null;
          before_record?: Json | null;
          created_at?: string;
          event_type?: Database['public']['Enums']['task_activity_type'];
          id?: string;
          organization_id?: string;
          summary?: string;
          task_id?: string;
        };
        Relationships: [];
      };
      task_assignments: {
        Row: {
          assigned_by: string;
          assignee_id: string;
          created_at: string;
          delay_reason: string | null;
          completed_at: string | null;
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
          created_at?: string;
          delay_reason?: string | null;
          completed_at?: string | null;
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
          created_at?: string;
          delay_reason?: string | null;
          completed_at?: string | null;
          id?: string;
          organization_id?: string;
          override_reason?: string | null;
          progress?: number;
          started_at?: string | null;
          status?: Database['public']['Enums']['assignment_status'];
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      tasks: {
        Row: {
          acknowledgement_required: boolean;
          archived_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          due_at: string | null;
          id: string;
          organization_id: string;
          priority: Database['public']['Enums']['task_priority'];
          published_at: string | null;
          recurrence: Database['public']['Enums']['task_recurrence'];
          start_at: string | null;
          status: Database['public']['Enums']['task_status'];
          title: string;
          updated_at: string;
        };
        Insert: {
          acknowledgement_required?: boolean;
          archived_at?: string | null;
          created_at?: string;
          created_by: string;
          description?: string;
          due_at?: string | null;
          id?: string;
          organization_id: string;
          priority?: Database['public']['Enums']['task_priority'];
          published_at?: string | null;
          recurrence?: Database['public']['Enums']['task_recurrence'];
          start_at?: string | null;
          status?: Database['public']['Enums']['task_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          acknowledgement_required?: boolean;
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          due_at?: string | null;
          id?: string;
          organization_id?: string;
          priority?: Database['public']['Enums']['task_priority'];
          published_at?: string | null;
          recurrence?: Database['public']['Enums']['task_recurrence'];
          start_at?: string | null;
          status?: Database['public']['Enums']['task_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_invitation: {
        Args: { invitation_token_hash: string };
        Returns: {
          out_organization_id: string;
          out_role: Database['public']['Enums']['membership_role'];
        }[];
      };
      bootstrap_organization: {
        Args: {
          organization_name: string;
          organization_timezone: string;
        };
        Returns: string;
      };
      create_connection_request: {
        Args: {
          target_code: string;
          target_role: Database['public']['Enums']['membership_role'];
        };
        Returns: { request_id: string; target_display_name: string }[];
      };
      discard_staged_invitation: {
        Args: { invitation_id: string };
        Returns: boolean;
      };
      finalize_invitation_delivery: {
        Args: { invitation_id: string };
        Returns: boolean;
      };
      is_active_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_active_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      is_admin: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
      is_task_admin: {
        Args: { target_task_id: string };
        Returns: boolean;
      };
      is_task_assignment_owner: {
        Args: { target_assignment_id: string };
        Returns: boolean;
      };
      is_task_participant: {
        Args: { target_task_id: string };
        Returns: boolean;
      };
      join_organization_as_employee: {
        Args: { target_organization_id: string };
        Returns: string;
      };
      list_my_connection_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          organization_name: string;
          role: Database['public']['Enums']['membership_role'];
          invited_by_name: string;
          created_at: string;
        }[];
      };
      register_organization_admin: {
        Args: {
          organization_name: string;
          organization_timezone: string;
        };
        Returns: string;
      };
      respond_to_connection_request: {
        Args: { request_id: string; accept: boolean };
        Returns: {
          out_organization_id: string | null;
          out_role: Database['public']['Enums']['membership_role'] | null;
        }[];
      };
      stage_invitation: {
        Args: {
          invitation_email: string;
          invitation_expires_at: string;
          invitation_role: Database['public']['Enums']['membership_role'];
          invitation_token_hash: string;
        };
        Returns: { id: string; email: string; expires_at: string }[];
      };
    };
    Enums: {
      deployment_environment: 'development' | 'staging' | 'production';
      invitation_delivery_status: 'pending_delivery' | 'active' | 'failed';
      membership_role: 'admin' | 'employee';
      membership_status: 'active' | 'deactivated';
      assignment_status:
        'not_started' | 'in_progress' | 'delayed' | 'completed';
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
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof DatabaseWithoutInternals,
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
