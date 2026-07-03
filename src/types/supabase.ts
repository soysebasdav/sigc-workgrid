export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'admin' | 'user';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          email: string;
          role?: 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          role?: 'admin' | 'user';
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: 'pending' | 'in_progress' | 'completed';
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: 'pending' | 'in_progress' | 'completed';
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: 'pending' | 'in_progress' | 'completed';
          due_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          actor_user_id: string | null;
          task_id: string | null;
          type: 'task_created' | 'task_updated' | 'task_deleted' | 'system';
          title: string;
          message: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_user_id: string;
          actor_user_id?: string | null;
          task_id?: string | null;
          type: 'task_created' | 'task_updated' | 'task_deleted' | 'system';
          title: string;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          setting_key: string;
          setting_value: string;
          updated_at: string;
        };
        Insert: {
          setting_key: string;
          setting_value: string;
          updated_at?: string;
        };
        Update: {
          setting_value?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
