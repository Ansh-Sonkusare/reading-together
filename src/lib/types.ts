
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "answer": {
                  Row: {
                    "book_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["answer_kind"],"prompt_key": string,"spine": number,"user_id": string,"value": string
                  }
                  Insert: {
                    "book_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["answer_kind"],"prompt_key": string,"spine": number,"user_id"?: string,"value": string
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["answer_kind"],"prompt_key"?: string,"spine"?: number,"user_id"?: string,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answer_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "book"
      referencedColumns: ["id"]
    }
                  ]
                },"book": {
                  Row: {
                    "added_by": string,"author": string | null,"couple_id": string,"cover_path": string | null,"created_at": string,"id": string,"sha256": string | null,"spine_lengths": (number)[],"storage_path": string | null,"title": string,"toc": Json | null
                  }
                  Insert: {
                    "added_by"?: string,"author"?: string | null,"couple_id": string,"cover_path"?: string | null,"created_at"?: string,"id"?: string,"sha256"?: string | null,"spine_lengths": (number)[],"storage_path"?: string | null,"title": string,"toc"?: Json | null
                  }
                  Update: {
                    "added_by"?: string,"author"?: string | null,"couple_id"?: string,"cover_path"?: string | null,"created_at"?: string,"id"?: string,"sha256"?: string | null,"spine_lengths"?: (number)[],"storage_path"?: string | null,"title"?: string,"toc"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple_stats"
      referencedColumns: ["couple_id"]
    }
                  ]
                },"couple": {
                  Row: {
                    "created_at": string,"id": string,"invite_code": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"invite_code"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invite_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"event": {
                  Row: {
                    "actor_id": string,"book_id": string | null,"couple_id": string,"created_at": string,"data": NonNullable<Json>,"id": string,"pos": number | null,"ref_id": string | null,"type": Database["public"]['Enums']["event_type"]
                  }
                  Insert: {
                    "actor_id": string,"book_id"?: string | null,"couple_id": string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"pos"?: number | null,"ref_id"?: string | null,"type": Database["public"]['Enums']["event_type"]
                  }
                  Update: {
                    "actor_id"?: string,"book_id"?: string | null,"couple_id"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"pos"?: number | null,"ref_id"?: string | null,"type"?: Database["public"]['Enums']["event_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "book"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple_stats"
      referencedColumns: ["couple_id"]
    }
                  ]
                },"goal": {
                  Row: {
                    "couple_id": string,"kind": Database["public"]['Enums']["goal_kind"],"target": number,"updated_at": string,"updated_by": string
                  }
                  Insert: {
                    "couple_id": string,"kind": Database["public"]['Enums']["goal_kind"],"target": number,"updated_at"?: string,"updated_by": string
                  }
                  Update: {
                    "couple_id"?: string,"kind"?: Database["public"]['Enums']["goal_kind"],"target"?: number,"updated_at"?: string,"updated_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: true
      referencedRelation: "couple"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goal_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: true
      referencedRelation: "couple_stats"
      referencedColumns: ["couple_id"]
    }
                  ]
                },"mark": {
                  Row: {
                    "author_id": string,"body": string | null,"book_id": string,"color": string | null,"created_at": string,"emoji": string | null,"id": string,"kind": Database["public"]['Enums']["mark_kind"],"label": string | null,"locator": Json | null,"media_url": string | null,"parent_id": string | null,"pos": number
                  }
                  Insert: {
                    "author_id"?: string,"body"?: string | null,"book_id": string,"color"?: string | null,"created_at"?: string,"emoji"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["mark_kind"],"label"?: string | null,"locator"?: Json | null,"media_url"?: string | null,"parent_id"?: string | null,"pos": number
                  }
                  Update: {
                    "author_id"?: string,"body"?: string | null,"book_id"?: string,"color"?: string | null,"created_at"?: string,"emoji"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["mark_kind"],"label"?: string | null,"locator"?: Json | null,"media_url"?: string | null,"parent_id"?: string | null,"pos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mark_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "book"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "mark"
      referencedColumns: ["id"]
    }
                  ]
                },"member": {
                  Row: {
                    "avatar_url": string | null,"color": string | null,"couple_id": string,"name": string | null,"timezone": string,"user_id": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"color"?: string | null,"couple_id": string,"name"?: string | null,"timezone"?: string,"user_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"color"?: string | null,"couple_id"?: string,"name"?: string | null,"timezone"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple_stats"
      referencedColumns: ["couple_id"]
    }
                  ]
                },"progress": {
                  Row: {
                    "book_id": string,"locator": Json | null,"max_pos": number,"pos": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "book_id": string,"locator"?: Json | null,"max_pos"?: number,"pos"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "book_id"?: string,"locator"?: Json | null,"max_pos"?: number,"pos"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "progress_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "book"
      referencedColumns: ["id"]
    }
                  ]
                },"push_sub": {
                  Row: {
                    "endpoint": string,"keys": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "endpoint": string,"keys": NonNullable<Json>,"user_id"?: string
                  }
                  Update: {
                    "endpoint"?: string,"keys"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reading_day": {
                  Row: {
                    "book_id": string,"day": string,"from_max_pos": number,"to_max_pos": number,"user_id": string
                  }
                  Insert: {
                    "book_id": string,"day": string,"from_max_pos": number,"to_max_pos": number,"user_id": string
                  }
                  Update: {
                    "book_id"?: string,"day"?: string,"from_max_pos"?: number,"to_max_pos"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reading_day_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "book"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "couple_stats": {
                  Row: {
                    "books_together": number | null,"couple_id": string | null,"discussions": number | null,"highlights": number | null,"pages": number | null,"reactions": Json | null
                  }
                  Insert: {
                           "books_together"?: never,"couple_id"?: string | null,"discussions"?: never,"highlights"?: never,"pages"?: never,"reactions"?: never
                         }
                        Update: {
                           "books_together"?: never,"couple_id"?: string | null,"discussions"?: never,"highlights"?: never,"pages"?: never,"reactions"?: never
                         }
                        Relationships: [
                    
                  ]
                },"reading_today": {
                  Row: {
                    "chapters": number | null,"couple_id": string | null,"day": string | null,"pages": number | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couple_stats"
      referencedColumns: ["couple_id"]
    }
                  ]
                }
          }
          Functions: {
            "book_couple_id":
{ Args: { "bid": string }; Returns: string
                           },
"can_use_book_topic":
{ Args: { "topic": string }; Returns: boolean
                           },
"create_couple":
{ Args: { "color": string,"name": string }; Returns: string
                           },
"day_totals":
{ Args: { "d": string,"uid": string }; Returns: {
              "chapters": number,"pages": number
            }[]
                           },
"display_page":
{ Args: { "pos": number,"spine_lengths": (number)[] }; Returns: number
                           },
"i_answered":
{ Args: { "bid": string,"k": Database["public"]['Enums']["answer_kind"],"key": string,"s": number }; Returns: boolean
                           },
"inks":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"is_couple_member":
{ Args: { "cid": string }; Returns: boolean
                           },
"is_timezone":
{ Args: { "tz": string }; Returns: boolean
                           },
"join_couple":
{ Args: { "color"?: string,"invite_code": string,"name"?: string }; Returns: string
                           },
"memory_media_ok":
{ Args: { "book_id": string,"id": string,"kind": Database["public"]['Enums']["mark_kind"],"media_url": string }; Returns: boolean
                           },
"my_couple_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_max_pos":
{ Args: { "bid": string }; Returns: number
                           },
"nearest_ink":
{ Args: { "taken"?: (string)[],"want": string }; Returns: string
                           },
"pos_chars":
{ Args: { "pos": number,"spine_lengths": (number)[] }; Returns: number
                           },
"push_dispatch_secret":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"set_goal":
{ Args: { "kind": Database["public"]['Enums']["goal_kind"],"target": number }; Returns: undefined
                           },
"set_push_dispatch_url":
{ Args: { "url": string }; Returns: string
                           }
          }
          Enums: {
            "answer_kind": "question"|"guess","event_type": "book_added"|"book_started"|"mark_created"|"chapter_finished"|"book_finished"|"answer_revealed"|"goal_met","goal_kind": "pages_per_day"|"chapters_per_day","mark_kind": "highlight"|"reaction"|"note"|"reply"|"bookmark"|"send"|"memory"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "answer_kind": ["question", "guess"],"event_type": ["book_added", "book_started", "mark_created", "chapter_finished", "book_finished", "answer_revealed", "goal_met"],"goal_kind": ["pages_per_day", "chapters_per_day"],"mark_kind": ["highlight", "reaction", "note", "reply", "bookmark", "send", "memory"]
          }
        }
} as const

