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
  classification_observations: string | null;
  classified_at: string | null;
  classified_by: string | null;
  idempotency_key: string | null;
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
        removed_at: string | null;
        removed_by: string | null;
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
        is_active: boolean;
        completed_at: string | null;
        ended_at: string | null;
        ended_by: string | null;
        updated_by: string | null;
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
        assignment_id: string | null;
        area_id: string | null;
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
        retention_until: string | null;
        legal_hold: boolean;
        client_visible: boolean;
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

      client_case_access: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        user_id: string;
        created_by: string | null;
        created_at: string;
      }>;

      public_intake_security: TableDef<{
        organization_id: string;
        rate_limit_per_hour: number;
        challenge_mode: 'off' | 'adaptive' | 'always';
        challenge_threshold: number;
        require_privacy_consent: boolean;
        privacy_notice_text: string;
        privacy_policy_url: string | null;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
      }>;

      public_intake_challenges: TableDef<{
        id: string;
        organization_id: string;
        ip_hash: string;
        prompt: string;
        answer_hash: string;
        expires_at: string;
        used_at: string | null;
        created_at: string;
      }>;

      public_submission_events: TableDef<{
        id: number;
        organization_id: string;
        case_id: string | null;
        ip_hash: string;
        created_at: string;
      }>;

      public_submission_consents: TableDef<{
        id: number;
        organization_id: string;
        case_id: string;
        requester_email: string | null;
        consented_at: string;
        notice_text: string;
        policy_url: string | null;
        ip_hash: string;
        user_agent_hash: string | null;
      }>;

      public_case_upload_sessions: TableDef<{
        id: string;
        token: string;
        organization_id: string;
        case_id: string;
        upload_path_prefix: string;
        max_files: number;
        max_file_size_bytes: number;
        uploaded_files: number;
        expires_at: string;
        finalized_at: string | null;
        created_at: string;
        updated_at: string;
      }>;

      organization_holidays: TableDef<{
        id: string;
        organization_id: string;
        holiday_date: string;
        name: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;

      email_templates: TableDef<{
        id: string;
        organization_id: string;
        code: string;
        name: string;
        event_type: string | null;
        subject: string;
        body_text: string;
        body_html: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;

      reminder_rules: TableDef<{
        id: string;
        organization_id: string;
        code: string;
        name: string;
        trigger_kind: string;
        offset_minutes: number;
        include_managers: boolean;
        message_template: string;
        email_template_code: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;

      email_event_catalog: TableDef<{
        code: string;
        name: string;
        created_at: string;
      }>;

      email_runtime_settings: TableDef<{
        organization_id: string;
        transport_mode: 'queue_only' | 'webhook';
        webhook_url: string | null;
        webhook_headers: Json;
        max_attempts: number;
        batch_size: number;
        enabled: boolean;
        created_at: string;
        updated_at: string;
      }>;

      email_queue: TableDef<{
        id: string;
        organization_id: string;
        case_id: string | null;
        recipient_user_id: string | null;
        recipient_email: string;
        template_id: string | null;
        event_type: string | null;
        subject: string;
        body_text: string;
        body_html: string | null;
        status: 'queued' | 'dispatching' | 'dispatched' | 'failed' | 'dead_letter';
        attempts: number;
        max_attempts: number;
        available_at: string;
        locked_at: string | null;
        dispatched_at: string | null;
        last_error: string | null;
        dedupe_key: string | null;
        provider_message_id: string | null;
        metadata: Json;
        created_at: string;
        updated_at: string;
      }>;

      automation_rules: TableDef<{
        id: string;
        organization_id: string;
        code: string;
        name: string;
        description: string | null;
        trigger_event: string;
        conditions: Json;
        condition_mode: 'all' | 'any';
        actions: Json;
        stop_on_error: boolean;
        stop_processing: boolean;
        sort_order: number;
        is_active: boolean;
        lifecycle_status: 'draft' | 'published' | 'archived';
        current_version: number;
        published_version: number | null;
        published_at: string | null;
        archived_at: string | null;
        archived_by: string | null;
        last_run_at: string | null;
        run_count: number;
        max_attempts: number;
        retry_delay_minutes: number;
        created_at: string;
        updated_at: string;
      }>;

      automation_rule_versions: TableDef<{
        id: string;
        organization_id: string;
        rule_id: string;
        version_number: number;
        lifecycle_status: 'draft' | 'published' | 'archived';
        snapshot: Json;
        created_by: string | null;
        created_at: string;
        published_at: string | null;
      }>;

      automation_execution_keys: TableDef<{
        id: string;
        organization_id: string;
        rule_id: string;
        case_id: string;
        event_key: string;
        created_at: string;
      }>;

      report_export_jobs: TableDef<{
        id: string;
        organization_id: string;
        requested_by: string;
        format: 'csv' | 'xlsx' | 'pdf';
        from_date: string;
        to_date: string;
        filters: Json;
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
        total_rows: number;
        processed_rows: number;
        error_message: string | null;
        created_at: string;
        updated_at: string;
        completed_at: string | null;
      }>;

      sigc_quality_runs: TableDef<{
        id: string;
        organization_id: string;
        initiated_by: string | null;
        status: 'passed' | 'warning' | 'failed';
        release_version: string | null;
        started_at: string;
        finished_at: string | null;
        duration_ms: number;
        total_checks: number;
        passed_checks: number;
        warning_checks: number;
        failed_checks: number;
        skipped_checks: number;
        metadata: Json;
        created_at: string;
      }>;

      sigc_quality_results: TableDef<{
        id: number;
        run_id: string;
        organization_id: string;
        code: string;
        category: 'unit' | 'integration' | 'security' | 'data' | 'runtime' | 'infrastructure';
        title: string;
        status: 'passed' | 'warning' | 'failed' | 'skipped';
        details: string;
        duration_ms: number | null;
        evidence: Json;
        source: 'client' | 'server';
        created_at: string;
      }>;

      automation_executions: TableDef<{
        id: string;
        organization_id: string;
        rule_id: string;
        case_id: string | null;
        trigger_event: string;
        status: string;
        matched: boolean;
        actions_total: number;
        actions_succeeded: number;
        error_message: string | null;
        execution_log: Json;
        attempt_count: number;
        max_attempts: number;
        next_retry_at: string | null;
        retry_of_id: string | null;
        started_at: string;
        finished_at: string | null;
      }>;

      case_reviews: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        review_round: number;
        status: 'pending' | 'approved' | 'returned' | 'cancelled';
        requested_by: string | null;
        reviewer_user_id: string | null;
        request_note: string | null;
        requested_at: string;
        decided_by: string | null;
        decision_comments: string | null;
        decided_at: string | null;
      }>;

      case_deliveries: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        channel: string;
        recipient: string;
        reference: string | null;
        notes: string | null;
        delivered_by: string | null;
        delivered_at: string;
      }>;

      case_reminder_log: TableDef<{
        id: string;
        organization_id: string;
        case_id: string;
        rule_id: string | null;
        recipient_user_id: string | null;
        reminder_type: 'automatic' | 'manual';
        message: string;
        sent_by: string | null;
        delivered_at: string;
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
      get_public_intake_context: {
        Args: { p_tenant?: string | null; p_hostname?: string | null };
        Returns: Json | null;
      };
      submit_public_case: {
        Args: {
          p_tenant: string | null;
          p_hostname: string | null;
          p_case_type_id: string;
          p_requester_name: string;
          p_requester_company: string;
          p_requester_document: string;
          p_requester_email: string;
          p_requester_phone: string;
          p_subject: string;
          p_description: string;
          p_website?: string | null;
          p_attachment_count?: number;
        };
        Returns: Array<{
          case_id: string;
          radicado: string;
          due_at: string | null;
          upload_token: string | null;
          upload_path_prefix: string | null;
          upload_expires_at: string | null;
          max_files: number;
          max_file_size_bytes: number;
        }>;
      };
      register_public_case_attachment: {
        Args: { p_upload_token: string; p_storage_path: string; p_original_filename: string; p_mime_type: string | null; p_size_bytes: number };
        Returns: string;
      };
      finalize_public_case_upload: {
        Args: { p_upload_token: string };
        Returns: number;
      };
      update_public_intake_settings: {
        Args: { p_enabled: boolean; p_form_title: string; p_form_description: string; p_confirmation_message: string; p_allow_attachments: boolean; p_max_files: number; p_max_file_size_bytes: number };
        Returns: undefined;
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
      create_internal_case_v2: {
        Args: {
          p_idempotency_key: string;
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
      classify_case_v2: {
        Args: {
          p_case_id: string;
          p_case_type_id: string;
          p_priority_id: string;
          p_risk_level: string;
          p_observations?: string | null;
          p_due_at?: string | null;
          p_assignments?: Json;
        };
        Returns: Array<{ case_id: string; state_id: string; state_name: string; due_at: string | null }>;
      };
      update_case_assignment_v2: {
        Args: {
          p_assignment_id: string;
          p_case_id: string;
          p_area_id: string;
          p_responsible_user_id?: string | null;
          p_due_at?: string | null;
          p_state: string;
          p_observations?: string | null;
          p_progress: number;
          p_is_primary: boolean;
        };
        Returns: undefined;
      };
      deactivate_case_assignment_v2: {
        Args: { p_assignment_id: string; p_case_id: string; p_reason: string };
        Returns: undefined;
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

      create_case_subtask_v2: {
        Args: {
          p_case_id: string;
          p_assignment_id?: string | null;
          p_area_id?: string | null;
          p_title: string;
          p_description?: string;
          p_responsible_user_id?: string | null;
          p_due_at?: string | null;
          p_priority_id?: string | null;
        };
        Returns: Array<{ subtask_id: string }>;
      };
      update_case_subtask_v2: {
        Args: {
          p_subtask_id: string;
          p_assignment_id?: string | null;
          p_area_id?: string | null;
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

      search_sigc_case_ids: { Args: { p_query: string }; Returns: string[] };
      get_workflow_board: { Args: { p_case_type_id?: string | null; p_query?: string | null; p_area_id?: string | null; p_owner_id?: string | null; p_priority_id?: string | null }; Returns: Json };
      move_case_in_workflow: { Args: { p_case_id: string; p_to_state_id: string; p_expected_from_state_id: string; p_justification?: string | null }; Returns: Json };
      override_case_sla: { Args: { p_case_id: string; p_new_due_at: string; p_justification: string }; Returns: undefined };
      submit_case_for_review: { Args: { p_case_id: string; p_reviewer_user_id?: string | null; p_note?: string | null }; Returns: undefined };
      decide_case_review: { Args: { p_review_id: string; p_decision: string; p_comments?: string | null }; Returns: undefined };
      register_case_delivery: { Args: { p_case_id: string; p_channel: string; p_recipient: string; p_reference?: string | null; p_notes?: string | null }; Returns: undefined };
      send_manual_case_reminder: { Args: { p_case_id: string; p_message: string; p_recipient_user_ids?: string[] | null }; Returns: number };
      get_user_management_context: { Args: Record<PropertyKey, never>; Returns: Json };
      set_role_permissions: { Args: { p_role_id: string; p_permission_ids: string[] }; Returns: undefined };
      set_organization_member_role: { Args: { p_membership_id: string; p_role_id: string }; Returns: undefined };
      set_case_type_workflow: { Args: { p_case_type_id: string; p_state_ids: string[] }; Returns: undefined };
      save_case_state_transition: { Args: { p_transition_id?: string | null; p_case_type_id: string; p_from_state_id: string; p_to_state_id: string; p_required_permission_code?: string | null; p_requires_justification: boolean; p_is_active: boolean }; Returns: undefined };
      delete_case_state_transition: { Args: { p_transition_id: string }; Returns: undefined };
      save_reminder_rule: { Args: { p_rule_id?: string | null; p_code: string; p_name: string; p_trigger_kind: string; p_offset_minutes: number; p_include_managers: boolean; p_is_active: boolean }; Returns: undefined };
      save_automation_rule: { Args: { p_rule_id?: string | null; p_code: string; p_name: string; p_description?: string | null; p_trigger_event: string; p_conditions: Json; p_actions: Json; p_stop_on_error: boolean; p_sort_order: number; p_is_active: boolean; p_max_attempts: number; p_retry_delay_minutes: number }; Returns: undefined };
      set_automation_rule_active: { Args: { p_rule_id: string; p_is_active: boolean }; Returns: undefined };
      run_automation_rule_test: { Args: { p_rule_id: string; p_case_id: string }; Returns: undefined };
      get_automation_runtime_health: { Args: Record<PropertyKey, never>; Returns: Json };
      get_sigc_dashboard: { Args: Record<PropertyKey, never>; Returns: Json };
      get_sigc_agenda: { Args: { p_from: string; p_to: string }; Returns: Json };
      get_sigc_report_v2: { Args: { p_from: string; p_to: string; p_filters: Json }; Returns: Json };
      get_saas_context: { Args: Record<PropertyKey, never>; Returns: Json };
      get_authorization_context: { Args: Record<PropertyKey, never>; Returns: Json };
      set_active_organization: { Args: { p_organization_id: string }; Returns: undefined };
      update_organization_profile: { Args: { p_name: string; p_slug: string; p_product_name: string; p_short_name: string; p_logo_url?: string | null; p_primary_color: string; p_accent_color: string; p_sidebar_color: string; p_support_email?: string | null; p_custom_domain?: string | null }; Returns: undefined };
      create_saas_organization: { Args: { p_name: string; p_slug: string }; Returns: string };
      create_organization_invitation: { Args: { p_email: string; p_role_id: string; p_expires_days: number }; Returns: Array<{ invitation_id: string; token: string; expires_at: string }> };
      revoke_organization_invitation: { Args: { p_invitation_id: string }; Returns: undefined };
      log_client_error: { Args: { p_message: string; p_stack?: string | null; p_route?: string | null; p_severity: string; p_metadata: Json }; Returns: undefined };
      get_organization_invitation: { Args: { p_token: string }; Returns: Array<{ organization_name: string; organization_slug: string; email: string; role_name: string; status: string; expires_at: string }> };
      accept_organization_invitation: { Args: { p_token: string }; Returns: string };
      get_runtime_settings: { Args: Record<PropertyKey, never>; Returns: Json };
      update_runtime_settings: { Args: { p_inactivity_timeout_minutes: number }; Returns: undefined };

      save_admin_catalog_v2: { Args: { p_kind: string; p_id?: string | null; p_code?: string | null; p_name?: string | null; p_description?: string | null; p_color?: string | null; p_sort_order?: number; p_is_initial?: boolean; p_is_terminal?: boolean; p_is_active?: boolean }; Returns: undefined };
      set_case_type_workflow_v2: { Args: { p_case_type_id: string; p_state_ids: string[] }; Returns: undefined };
      save_case_state_transition_v2: { Args: { p_transition_id?: string | null; p_case_type_id?: string | null; p_from_state_id?: string | null; p_to_state_id?: string | null; p_required_permission_code?: string | null; p_requires_justification?: boolean; p_is_active?: boolean }; Returns: undefined };
      submit_case_for_review_v2: { Args: { p_case_id: string; p_reviewer_user_id?: string | null; p_note?: string | null }; Returns: undefined };
      decide_case_review_v2: { Args: { p_review_id: string; p_decision: string; p_comments?: string | null }; Returns: undefined };
      register_case_delivery_v2: { Args: { p_case_id: string; p_channel: string; p_recipient: string; p_reference?: string | null; p_notes?: string | null }; Returns: undefined };
      get_case_timeline_v2: { Args: { p_case_id: string; p_page?: number; p_page_size?: number }; Returns: Json };
      get_audit_events_v2: { Args: { p_filters?: Json }; Returns: Json };
      register_case_document_v2: { Args: { p_document_id: string; p_case_id: string; p_name: string; p_category: string; p_state: string; p_original_filename: string; p_storage_path: string; p_mime_type: string; p_size_bytes: number; p_change_notes?: string | null; p_checksum?: string | null; p_subtask_id?: string | null; p_comment_id?: string | null }; Returns: Array<{ document_id: string; version_number: number }> };
      add_case_document_version_v2: { Args: { p_document_id: string; p_expected_current_version: number; p_original_filename: string; p_storage_path: string; p_mime_type: string; p_size_bytes: number; p_change_notes?: string | null; p_checksum?: string | null }; Returns: Array<{ document_id: string; version_number: number }> };
      update_document_retention: { Args: { p_document_id: string; p_retention_until?: string | null; p_legal_hold?: boolean }; Returns: undefined };
      preview_email_template_v2: { Args: { p_template_id?: string | null; p_subject?: string; p_body_text?: string; p_body_html?: string | null; p_case_id?: string | null }; Returns: Json };
      queue_test_email_v2: { Args: { p_recipient_email: string; p_template_id?: string | null; p_subject?: string; p_body_text?: string; p_body_html?: string | null; p_case_id?: string | null }; Returns: string };
      save_reminder_rule_v2: { Args: { p_rule_id?: string | null; p_code?: string | null; p_name?: string | null; p_trigger_kind?: string; p_offset_minutes?: number; p_include_managers?: boolean; p_message_template?: string; p_email_template_code?: string | null; p_is_active?: boolean }; Returns: undefined };
      process_sigc_runtime_v2: { Args: { p_batch_size?: number }; Returns: Json };

      search_sigc_cases_v3: { Args: { p_filters?: Json }; Returns: Json };
      analyze_automation_rules_v3: { Args: Record<PropertyKey, never>; Returns: Json };
      save_automation_rule_v3: { Args: { p_rule_id?: string | null; p_code?: string | null; p_name?: string | null; p_description?: string | null; p_trigger_event?: string | null; p_conditions?: Json; p_condition_mode?: string; p_actions?: Json; p_stop_on_error?: boolean; p_stop_processing?: boolean; p_sort_order?: number; p_max_attempts?: number; p_retry_delay_minutes?: number }; Returns: string };
      publish_automation_rule_v3: { Args: { p_rule_id: string }; Returns: undefined };
      archive_automation_rule_v3: { Args: { p_rule_id: string }; Returns: undefined };
      restore_automation_rule_version_v3: { Args: { p_rule_id: string; p_version_number: number }; Returns: undefined };
      get_automation_rule_versions_v3: { Args: { p_rule_id: string }; Returns: Json };
      preview_automation_rule_v3: { Args: { p_rule_id: string; p_case_id: string }; Returns: Json };
      set_automation_rule_active_v3: { Args: { p_rule_id: string; p_is_active: boolean }; Returns: undefined };
      execute_automation_rule_manual_v3: { Args: { p_rule_id: string; p_case_id: string }; Returns: undefined };
      process_automation_schedules_v3: { Args: { p_batch_size?: number }; Returns: Json };
      get_sigc_dashboard_v3: { Args: Record<PropertyKey, never>; Returns: Json };
      get_sigc_report_v3: { Args: { p_from: string; p_to: string; p_filters?: Json; p_page?: number; p_page_size?: number }; Returns: Json };
      create_report_export_job_v3: { Args: { p_format: string; p_from: string; p_to: string; p_filters?: Json }; Returns: Json };
      get_report_export_page_v3: { Args: { p_job_id: string; p_page: number; p_page_size: number }; Returns: Json };
      complete_report_export_job_v3: { Args: { p_job_id: string; p_status: string; p_error_message?: string | null }; Returns: undefined };

      get_public_intake_context_v4: { Args: { p_tenant?: string | null; p_hostname?: string | null }; Returns: Json | null };
      submit_public_case_v4: {
        Args: {
          p_tenant: string | null; p_hostname: string | null; p_case_type_id: string; p_requester_name: string;
          p_requester_company: string; p_requester_document: string; p_requester_email: string; p_requester_phone: string;
          p_subject: string; p_description: string; p_website?: string | null; p_attachment_count?: number;
          p_privacy_consent?: boolean; p_challenge_id?: string | null; p_challenge_answer?: string | null;
        };
        Returns: Array<{ case_id: string; radicado: string; due_at: string | null; upload_token: string | null; upload_path_prefix: string | null; upload_expires_at: string | null; max_files: number; max_file_size_bytes: number }>;
      };
      update_public_intake_settings_v4: { Args: { p_enabled: boolean; p_form_title: string; p_form_description: string; p_confirmation_message: string; p_allow_attachments: boolean; p_max_files: number; p_max_file_size_bytes: number; p_rate_limit_per_hour?: number; p_challenge_mode?: string; p_challenge_threshold?: number; p_require_privacy_consent?: boolean; p_privacy_notice_text?: string; p_privacy_policy_url?: string | null }; Returns: undefined };
      set_organization_member_status_v4: { Args: { p_membership_id: string; p_action: string }; Returns: undefined };
      get_user_management_context_v4: { Args: Record<PropertyKey, never>; Returns: Json };
      set_document_client_visibility_v4: { Args: { p_document_id: string; p_is_visible: boolean }; Returns: undefined };
      get_client_portal_v4: { Args: { p_page?: number; p_page_size?: number; p_query?: string }; Returns: Json };
      search_sigc_subtasks_v4: { Args: { p_filters?: Json }; Returns: Json };
      search_sigc_documents_v4: { Args: { p_filters?: Json }; Returns: Json };
      get_notification_page_v4: { Args: { p_page?: number; p_page_size?: number }; Returns: Json };
      get_sigc_sidebar_summary_v4: { Args: Record<PropertyKey, never>; Returns: Json };
      get_security_health_v4: { Args: Record<PropertyKey, never>; Returns: Json };
      get_sigc_quality_dashboard_v5: { Args: Record<PropertyKey, never>; Returns: Json };
      run_sigc_quality_suite_v5: { Args: { p_client_checks?: Json; p_release_version?: string | null }; Returns: Json };
      cleanup_sigc_quality_history_v5: { Args: { p_keep_days?: number }; Returns: number };

      calculate_sla_due_at: {
        Args: { p_started_at: string; p_duration_value: number; p_duration_unit: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
