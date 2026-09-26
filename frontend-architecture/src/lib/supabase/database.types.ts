export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      board_columns: {
        Row: {
          board_id: string
          id: string
          is_done: boolean
          position: string
          title: string
        }
        Insert: {
          board_id: string
          id?: string
          is_done?: boolean
          position: string
          title: string
        }
        Update: {
          board_id?: string
          id?: string
          is_done?: boolean
          position?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_groups: {
        Row: {
          board_id: string
          group_id: string
        }
        Insert: {
          board_id: string
          group_id: string
        }
        Update: {
          board_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_groups_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      board_members: {
        Row: {
          board_id: string
          user_id: string
        }
        Insert: {
          board_id: string
          user_id: string
        }
        Update: {
          board_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      calendar_feed_tokens: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      document_views: {
        Row: {
          file_id: string
          id: number
          user_id: string
          viewed_at: string
        }
        Insert: {
          file_id: string
          id?: never
          user_id?: string
          viewed_at?: string
        }
        Update: {
          file_id?: string
          id?: never
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      drive_files: {
        Row: {
          id: string
          mime_type: string
          modified_at: string | null
          name: string
          parent_id: string | null
          path: string
          root_id: string
          size_bytes: number | null
          synced_at: string
          web_view_link: string | null
        }
        Insert: {
          id: string
          mime_type: string
          modified_at?: string | null
          name: string
          parent_id?: string | null
          path: string
          root_id: string
          size_bytes?: number | null
          synced_at?: string
          web_view_link?: string | null
        }
        Update: {
          id?: string
          mime_type?: string
          modified_at?: string | null
          name?: string
          parent_id?: string | null
          path?: string
          root_id?: string
          size_bytes?: number | null
          synced_at?: string
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_files_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "drive_roots"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_root_access: {
        Row: {
          group_id: string | null
          role_id: string | null
          root_id: string
        }
        Insert: {
          group_id?: string | null
          role_id?: string | null
          root_id: string
        }
        Update: {
          group_id?: string | null
          role_id?: string | null
          root_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_root_access_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_root_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_root_access_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "drive_roots"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_roots: {
        Row: {
          created_at: string
          enabled: boolean
          folder_id: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          folder_id: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          folder_id?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
        }
        Relationships: []
      }
      event_audience: {
        Row: {
          event_id: string
          group_id: string | null
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          event_id: string
          group_id?: string | null
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          event_id?: string
          group_id?: string | null
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_audience_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_google_links: {
        Row: {
          event_id: string
          google_calendar_id: string
          google_event_id: string
          html_link: string | null
          synced_at: string
        }
        Insert: {
          event_id: string
          google_calendar_id: string
          google_event_id: string
          html_link?: string | null
          synced_at?: string
        }
        Update: {
          event_id?: string
          google_calendar_id?: string
          google_event_id?: string
          html_link?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_google_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          rrule: string | null
          source: string
          starts_at: string
          title: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          rrule?: string | null
          source?: string
          starts_at: string
          title: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          rrule?: string | null
          source?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      google_calendars: {
        Row: {
          calendar_id: string
          direction: string
          enabled: boolean
          group_id: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          name: string
          role_id: string | null
        }
        Insert: {
          calendar_id: string
          direction: string
          enabled?: boolean
          group_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name: string
          role_id?: string | null
        }
        Update: {
          calendar_id?: string
          direction?: string
          enabled?: boolean
          group_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          name?: string
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendars_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendars_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          added_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_roles: {
        Row: {
          group_id: string
          role_id: string
        }
        Insert: {
          group_id: string
          role_id: string
        }
        Update: {
          group_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_roles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      message_recipients: {
        Row: {
          delivery_status: string
          message_id: string
          provider_message_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          delivery_status?: string
          message_id: string
          provider_message_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          delivery_status?: string
          message_id?: string
          provider_message_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body_md: string
          created_at: string
          id: string
          is_system: boolean
          sender_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["mail_status"]
          subject: string
          to_group_id: string | null
          to_role_id: string | null
        }
        Insert: {
          body_md?: string
          created_at?: string
          id?: string
          is_system?: boolean
          sender_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mail_status"]
          subject: string
          to_group_id?: string | null
          to_role_id?: string | null
        }
        Update: {
          body_md?: string
          created_at?: string
          id?: string
          is_system?: boolean
          sender_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mail_status"]
          subject?: string
          to_group_id?: string | null
          to_role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_to_group_id_fkey"
            columns: ["to_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_to_role_id_fkey"
            columns: ["to_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          push: boolean
          type: string
          user_id: string
        }
        Insert: {
          push?: boolean
          type: string
          user_id?: string
        }
        Update: {
          push?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          pushed_at: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string
          key: string
          module: string
        }
        Insert: {
          description: string
          key: string
          module: string
        }
        Update: {
          description?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          status: string
          timezone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          status?: string
          timezone?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          status?: string
          timezone?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_id: string
        }
        Insert: {
          permission_key: string
          role_id: string
        }
        Update: {
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          board_id: string
          column_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          position: string
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          board_id: string
          column_id: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position: string
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          board_id?: string
          column_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: string
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string | null
          group_ids: string[]
          invited_by: string | null
          role_ids: string[]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          group_ids?: string[]
          invited_by?: string | null
          role_ids?: string[]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          group_ids?: string[]
          invited_by?: string | null
          role_ids?: string[]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          status: string
        }[]
      }
      can_grant_group: { Args: { p_group: string }; Returns: boolean }
      can_grant_role: { Args: { p_role: string }; Returns: boolean }
      can_see_drive_root: { Args: { p_root: string }; Returns: boolean }
      can_see_event: { Args: { p_event: string }; Returns: boolean }
      claims_for_user: { Args: { p_user: string }; Returns: Json }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      effective_role_ids: { Args: { p_user: string }; Returns: string[] }
      event_audience_user_ids: { Args: { p_event: string }; Returns: string[] }
      events_for_user: {
        Args: { p_from: string; p_to: string; p_user: string }
        Returns: {
          all_day: boolean
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          rrule: string | null
          source: string
          starts_at: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      in_group: { Args: { p_group: string }; Returns: boolean }
      internal_post: {
        Args: { p_body?: Json; p_path: string; p_target: string }
        Returns: number
      }
      is_board_member: { Args: { p_board: string }; Returns: boolean }
      is_board_owner: { Args: { p_board: string }; Returns: boolean }
      is_event_creator: { Args: { p_event: string }; Returns: boolean }
      is_message_recipient: { Args: { p_message: string }; Returns: boolean }
      is_message_sender: { Args: { p_message: string }; Returns: boolean }
      mail_recipient_count: {
        Args: { p_group_id: string; p_role_id: string }
        Returns: number
      }
      mail_recipients: {
        Args: { p_group_id: string; p_role_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      mark_pushed: { Args: { p_ids: string[] }; Returns: undefined }
      my_group_ids: { Args: never; Returns: string[] }
      my_role_ids: { Args: never; Returns: string[] }
      notify: {
        Args: {
          p_body: string
          p_link: string
          p_title: string
          p_type: string
          p_users: string[]
        }
        Returns: undefined
      }
      prune_google_events: {
        Args: {
          p_before: string
          p_calendar_id: string
          p_from: string
          p_to: string
        }
        Returns: number
      }
      push_targets: {
        Args: { p_ids: string[] }
        Returns: {
          auth: string
          body: string
          endpoint: string
          link: string
          notification_id: string
          p256dh: string
          subscription_id: string
          title: string
        }[]
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: undefined
      }
      upsert_google_event: {
        Args: {
          p_all_day: boolean
          p_calendar_id: string
          p_description: string
          p_ends_at: string
          p_google_event_id: string
          p_html_link: string
          p_location: string
          p_rrule: string
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      users_with_permission: { Args: { p_key: string }; Returns: string[] }
    }
    Enums: {
      mail_status: "draft" | "queued" | "sending" | "sent" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      mail_status: ["draft", "queued", "sending", "sent", "failed"],
    },
  },
} as const

