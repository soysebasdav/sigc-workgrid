export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Insert>, Relationships = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type OrganizationScoped = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};


type CaseRow = {
  id: string;
  organization_id: string;
  radicado: string;
  sequence_year: number;
  sequence_number: number;
  case_type_id: string | null;
  priority_id: string | null;
  state_id: string | null;
  sla_policy_id: string | null;
  primary_area_id: string | null;
  primary_owner_id: string | null;
  requester_name: string;
  requester_company: string | null;
  requester_document: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  subject: string;
  description: string;
  source: string;
  risk_level: string | null;
  progress: number;
  opened_at: string;
  due_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CaseInsert = Partial<CaseRow> & { organization_id: string; requester_name: string; subject: string };
type CaseUpdate = Partial<CaseRow>;

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<{
        id: string;
        name: string;
        email: string;
        created_at: string;
        updated_at: string;
      }, {
        id: string;
        name?: string;
        email: string;
        created_at?: string;
        updated_at?: string;
      }, {
        name?: string;
        email?: string;
        updated_at?: string;
      }>;

      notifications: TableDef<{
        id: string;
        recipient_user_id: string;
        actor_user_id: string | null;
        organization_id: string | null;
        case_id: string | null;
        type:
          | 'system'
          | 'case_created'
          | 'case_assigned'
          | 'case_reassigned'
          | 'case_comment'
          | 'case_document'
          | 'case_state_changed'
          | 'case_sla_changed'
          | 'case_due_soon'
          | 'case_overdue'
          | 'case_reminder'
          | 'case_review_requested'
          | 'case_review_approved'
          | 'case_review_returned'
          | 'case_sent';
        title: string;
        message: string;
        action_url: string | null;
        metadata: Json;
        is_read: boolean;
        read_at: string | null;
        dedupe_key: string | null;
        created_at: string;
      }>;

      organizations: TableDef<{
        id: string;
        name: string;
        slug: string;
        is_active: boolean;
        settings: Json;
        created_at: string;
        updated_at: string;
      }>;

      permissions: TableDef<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        created_at: string;
      }>;

      roles: TableDef<OrganizationScoped & {
        code: string;
        name: string;
        description: string | null;
        is_system: boolean;
        is_active: boolean;
      }>;

      role_permissions: TableDef<{
        role_id: string;
        permission_id: string;
        created_at: string;
      }>;

      organization_members: TableDef<{
        id: string;
        organization_id: string;
        user_id: string;
        role_id: string;
        is_active: boolean;
        joined_at: string;
        updated_at: string;
      }>;

      areas: TableDef<OrganizationScoped & {
        code: string;
        name: string;
        color: string | null;
        sort_order: number;
        is_active: boolean;
      }>;

      priorities: TableDef<OrganizationScoped & {
        code: string;
        name: string;
        color: string | null;
        sort_order: number;
        is_active: boolean;
      }>;

      case_types: TableDef<OrganizationScoped & {
        code: string;
        name: string;
        description: string | null;
        color: string | null;
        is_active: boolean;
      }>;

      case_states: TableDef<OrganizationScoped & {
        code: string;
        name: string;
        description: string | null;
        color: string | null;
        sort_order: number;
        is_initial: boolean;
        is_terminal: boolean;
        is_active: boolean;
      }>;

      sla_policies: TableDef<OrganizationScoped & {
        case_type_id: string | null;
        name: string;
        duration_value: number;
        duration_unit: 'hours' | 'calendar_days' | 'business_days';
        start_event: string;
        is_default: boolean;
        is_active: boolean;
      }>;

      case_type_states: TableDef<{
        case_type_id: string;
        state_id: string;
        sort_order: number;
        is_required: boolean;
        created_at: string;
      }>;

      state_transitions: TableDef<OrganizationScoped & {
        case_type_id: string | null;
        from_state_id: string;
        to_state_id: string;
        required_permission_code: string | null;
        requires_justification: boolean;
        is_active: boolean;
      }>;

      case_counters: TableDef<{
        organization_id: string;
        year: number;
        last_value: number;
        updated_at: string;
      }>;

      cases: TableDef<CaseRow, CaseInsert, CaseUpdate, [
        { foreignKeyName: 'cases_case_type_id_fkey'; columns: ['case_type_id']; isOneToOne: false; referencedRelation: 'case_types'; referencedColumns: ['id'] },
        { foreignKeyName: 'cases_priority_id_fkey'; columns: ['priority_id']; isOneToOne: false; referencedRelation: 'priorities'; referencedColumns: ['id'] },
        { foreignKeyName: 'cases_state_id_fkey'; columns: ['state_id']; isOneToOne: false; referencedRelation: 'case_states'; referencedColumns: ['id'] },
        { foreignKeyName: 'cases_primary_area_id_fkey'; columns: ['primary_area_id']; isOneToOne: false; referencedRelation: 'areas'; referencedColumns: ['id'] },
        { foreignKeyName: 'cases_primary_owner_id_fkey'; columns: ['primary_owner_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        { foreignKeyName: 'cases_sla_policy_id_fkey'; columns: ['sla_policy_id']; isOneToOne: false; referencedRelation: 'sla_policies'; referencedColumns: ['id'] }
      ]>;

      case_assignments: TableDef<OrganizationScoped & {
        case_id: string;
        area_id: string;
        responsible_user_id: string | null;
        assigned_by: string | null;
        assigned_at: string;
        due_at: string | null;
        state: string;
        observations: string | null;
        progress: number;
        is_primary: boolean;
        completed_at: string | null;
      }>;

      case_state_history: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        from_state_id: string | null;
        to_state_id: string;
        changed_by: string | null;
        justification: string | null;
        changed_at: string;
      }>;

      case_sla_overrides: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        previous_due_at: string | null;
        new_due_at: string;
        justification: string;
        changed_by: string;
        changed_at: string;
      }>;


      case_subtasks: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        title: string;
        description: string;
        responsible_user_id: string | null;
        priority_id: string | null;
        due_at: string | null;
        state: 'pending' | 'in_progress' | 'completed' | 'cancelled';
        progress: number;
        created_by: string | null;
        updated_by: string | null;
        completed_at: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;

      case_comments: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        subtask_id: string | null;
        user_id: string;
        content: string;
        created_at: string;
      }>;

      case_documents: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        subtask_id: string | null;
        comment_id: string | null;
        name: string;
        category: string;
        state: string;
        current_version: number;
        created_by: string | null;
        deleted_by: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;

      document_versions: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        document_id: string;
        version_number: number;
        original_filename: string;
        storage_path: string;
        mime_type: string | null;
        size_bytes: number;
        checksum: string | null;
        change_notes: string | null;
        uploaded_by: string | null;
        created_at: string;
      }>;

      audit_events: TableDef<{
        id: number;
        organization_id: string;
        case_id: string | null;
        actor_user_id: string | null;
        event_type: string;
        entity_type: string;
        entity_id: string;
        before_data: Json | null;
        after_data: Json | null;
        metadata: Json;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      ensure_user_organization: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      next_case_number: {
        Args: { p_organization_id: string; p_year?: number };
        Returns: Array<{ sequence_year: number; sequence_number: number; radicado: string }>;
      };
      get_public_case_types: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{ id: string; name: string; description: string | null; sla_label: string }>;
      };
      submit_public_case: {
        Args: {
          p_case_type_id: string;
          p_requester_name: string;
          p_requester_company: string;
          p_requester_document: string;
          p_requester_email: string;
          p_requester_phone: string;
          p_subject: string;
          p_description: string;
          p_website?: string | null;
        };
        Returns: Array<{ case_id: string; radicado: string; due_at: string | null }>;
      };
      create_internal_case: {
        Args: {
          p_case_type_id: string;
          p_priority_id: string;
          p_requester_name: string;
          p_requester_company: string;
          p_requester_document: string;
          p_requester_email: string;
          p_requester_phone: string;
          p_subject: string;
          p_description: string;
          p_risk_level?: string | null;
          p_assignments?: Json;
        };
        Returns: Array<{ case_id: string; radicado: string; due_at: string | null }>;
      };
      get_case_allowed_states: {
        Args: { p_case_id: string };
        Returns: Array<{ id: string; name: string; code: string; color: string | null; requires_justification: boolean }>;
      };
      change_case_state: {
        Args: { p_case_id: string; p_to_state_id: string; p_justification?: string | null };
        Returns: Array<{ case_id: string; state_id: string; state_name: string; closed_at: string | null }>;
      };
      assign_case: {
        Args: {
          p_case_id: string;
          p_area_id: string;
          p_responsible_user_id?: string | null;
          p_due_at?: string | null;
          p_observations?: string | null;
          p_is_primary?: boolean;
        };
        Returns: Array<{ assignment_id: string; is_primary: boolean }>;
      };

      create_case_subtask: {
        Args: {
          p_case_id: string;
          p_title: string;
          p_description?: string;
          p_responsible_user_id?: string | null;
          p_due_at?: string | null;
          p_priority_id?: string | null;
        };
        Returns: Array<{ subtask_id: string }>;
      };
      update_case_subtask: {
        Args: {
          p_subtask_id: string;
          p_title: string;
          p_description: string;
          p_responsible_user_id: string | null;
          p_due_at: string | null;
          p_priority_id: string | null;
          p_state: string;
          p_progress: number;
        };
        Returns: Array<{ subtask_id: string }>;
      };
      soft_delete_case_subtask: {
        Args: { p_subtask_id: string };
        Returns: undefined;
      };
      add_case_comment: {
        Args: { p_case_id: string; p_content: string; p_subtask_id?: string | null };
        Returns: Array<{ comment_id: string }>;
      };
      register_case_document: {
        Args: {
          p_document_id: string;
          p_case_id: string;
          p_name: string;
          p_category: string;
          p_state: string;
          p_original_filename: string;
          p_storage_path: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_change_notes?: string | null;
          p_subtask_id?: string | null;
          p_comment_id?: string | null;
        };
        Returns: Array<{ document_id: string; version_number: number }>;
      };
      add_case_document_version: {
        Args: {
          p_document_id: string;
          p_expected_current_version: number;
          p_original_filename: string;
          p_storage_path: string;
          p_mime_type: string;
          p_size_bytes: number;
          p_change_notes?: string | null;
        };
        Returns: Array<{ document_id: string; version_number: number }>;
      };
      soft_delete_case_document: {
        Args: { p_document_id: string };
        Returns: undefined;
      };
      can_read_case: {
        Args: { p_case_id: string };
        Returns: boolean;
      };
      can_work_case: {
        Args: { p_case_id: string; p_permission_code: string };
        Returns: boolean;
      };

      calculate_sla_due_at: {
        Args: { p_started_at: string; p_duration_value: number; p_duration_unit: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
