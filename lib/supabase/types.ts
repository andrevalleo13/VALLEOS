export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type FinancialCategory = "flouvia_ingreso" | "gasto_personal" | "gasto_flouvia" | "ahorro" | "inversion";
export type ClientStatus = "propuesta" | "activo" | "pausado" | "completado";
export type ShadowRole = "user" | "assistant" | "system" | "tool";

export interface Database {
  public: {
    Tables: {
      /* ── User ──────────────────────────────────────────── */
      user_preferences: {
        Row: {
          id: 1;
          display_name: string;
          vision_primary: string;
          vision_secondary: string;
          vision_metadata: string;
          brief_sections: Json;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "id">>;
        Update: Partial<Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "id">>;
        Relationships: [];
      };

      /* ── Daily ─────────────────────────────────────────── */
      priorities: {
        Row: { id: string; text: string; date: string; completed: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["priorities"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["priorities"]["Insert"]>;
        Relationships: [];
      };
      daily_notes: {
        Row: { date: string; focus: string | null; reflection: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["daily_notes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["daily_notes"]["Row"]>;
        Relationships: [];
      };

      /* ── Habits ────────────────────────────────────────── */
      habits: {
        Row: {
          id: string; name: string; active: boolean; sort_order: number;
          type: "binary" | "numeric"; unit: string | null; daily_target: number | null;
          color: string; icon: string | null; freezes_available: number;
          schedule_days: number[]; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["habits"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["habits"]["Insert"]>;
        Relationships: [];
      };
      habit_completions: {
        Row: { habit_id: string; date: string; value: number | null; frozen: boolean };
        Insert: Database["public"]["Tables"]["habit_completions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["habit_completions"]["Row"]>;
        Relationships: [];
      };

      /* ── Finance ───────────────────────────────────────── */
      financial_entries: {
        Row: {
          id: string; category: FinancialCategory; amount: number;
          description: string | null; date: string; subcategory: string | null;
          card_id: string | null; account_id: string | null; payment_method: string | null; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["financial_entries"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["financial_entries"]["Insert"]>;
        Relationships: [];
      };
      capital_goals: {
        Row: { id: string; name: string; target_amount: number; current_amount: number; description: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["capital_goals"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["capital_goals"]["Insert"]>;
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string; name: string; type: string; bank: string | null;
          currency: string; current_balance: number; active: boolean; sort_order: number; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bank_accounts"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["bank_accounts"]["Insert"]>;
        Relationships: [];
      };
      credit_cards: {
        Row: {
          id: string; name: string; bank: string | null; last_four: string | null;
          credit_limit: number | null; current_balance: number; statement_balance: number | null;
          statement_day: number | null; due_day: number | null; apr: number | null;
          active: boolean; sort_order: number; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["credit_cards"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["credit_cards"]["Insert"]>;
        Relationships: [];
      };
      investments: {
        Row: {
          id: string; name: string; type: string; amount_invested: number;
          current_value: number; currency: string; expected_apy: number | null;
          started_at: string | null; matures_at: string | null; notes: string | null; active: boolean; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["investments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["investments"]["Insert"]>;
        Relationships: [];
      };
      debts: {
        Row: {
          id: string; name: string; type: string; total_amount: number;
          current_balance: number; monthly_payment: number | null; interest_rate: number | null;
          due_day: number | null; payoff_date: string | null; active: boolean; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["debts"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["debts"]["Insert"]>;
        Relationships: [];
      };
      net_worth_snapshots: {
        Row: { id: string; date: string; total_assets: number; total_debts: number; net_worth: number; breakdown: Json; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["net_worth_snapshots"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["net_worth_snapshots"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: { id: string; category: string; subcategory: string | null; monthly_limit: number; alert_threshold: number; rollover: boolean; active: boolean; notes: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["budgets"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [];
      };
      recurring_charges: {
        Row: { id: string; name: string; amount: number; category: string; subcategory: string | null; card_id: string | null; charge_day: number | null; active: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["recurring_charges"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["recurring_charges"]["Insert"]>;
        Relationships: [];
      };

      /* ── Flouvia ───────────────────────────────────────── */
      flouvia_clients: {
        Row: {
          id: string; name: string; status: ClientStatus; project_value: number | null;
          monthly_value: number | null; description: string | null; notes: string | null;
          primary_contact_id: string | null; sort_order: number; created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["flouvia_clients"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["flouvia_clients"]["Insert"]>;
        Relationships: [];
      };
      flouvia_contacts: {
        Row: { id: string; client_id: string; name: string; role: string | null; email: string | null; phone: string | null; notes: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["flouvia_contacts"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["flouvia_contacts"]["Insert"]>;
        Relationships: [];
      };
      flouvia_followups: {
        Row: { id: string; client_id: string; contact_id: string | null; title: string; notes: string | null; due_date: string | null; done: boolean; done_at: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["flouvia_followups"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["flouvia_followups"]["Insert"]>;
        Relationships: [];
      };
      flouvia_projects: {
        Row: { id: string; client_id: string; name: string; description: string | null; status: string; total_value: number | null; estimated_hours: number | null; actual_hours: number; started_at: string | null; deadline: string | null; delivered_at: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["flouvia_projects"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["flouvia_projects"]["Insert"]>;
        Relationships: [];
      };
      flouvia_invoices: {
        Row: { id: string; client_id: string; project_id: string | null; number: string | null; issued_date: string; due_date: string | null; paid_date: string | null; status: string; subtotal: number; tax: number; total: number; notes: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["flouvia_invoices"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["flouvia_invoices"]["Insert"]>;
        Relationships: [];
      };

      /* ── Shadow ────────────────────────────────────────── */
      shadow_conversations: {
        Row: { id: string; title: string | null; pinned: boolean; created_at: string; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["shadow_conversations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["shadow_conversations"]["Insert"]> & { updated_at?: string };
        Relationships: [];
      };
      shadow_messages: {
        Row: { id: string; conversation_id: string; role: ShadowRole; parts: Json; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["shadow_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["shadow_messages"]["Insert"]>;
        Relationships: [];
      };
      shadow_cache: {
        Row: { key: string; content: string; metadata: Json | null; generated_at: string };
        Insert: Database["public"]["Tables"]["shadow_cache"]["Row"];
        Update: Partial<Database["public"]["Tables"]["shadow_cache"]["Row"]>;
        Relationships: [];
      };
      shadow_memory: {
        Row: { id: string; category: string; fact: string; importance: number; source_conversation_id: string | null; expires_at: string | null; created_at: string; last_used_at: string | null };
        Insert: Omit<Database["public"]["Tables"]["shadow_memory"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["shadow_memory"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: { id: string; title: string; body: string | null; severity: string; module: string | null; href: string | null; read: boolean; dismissed: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };

      /* ── Brain ─────────────────────────────────────────── */
      brain_notes: {
        Row: { id: string; content: string; source: string; title: string | null; obsidian_path: string | null; created_at: string };
        Insert: { content: string; source: string; title?: string | null; obsidian_path?: string | null };
        Update: Partial<Database["public"]["Tables"]["brain_notes"]["Insert"]>;
        Relationships: [];
      };

      /* ── Academic (UP) ─────────────────────────────────── */
      academic_courses: {
        Row: { id: string; name: string; professor: string | null; credits: number | null; grade: number | null; code: string | null; semester: string | null; target_grade: number; notes: string | null; professor_email: string | null; active: boolean; color: string; absences: number; max_absences: number | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["academic_courses"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["academic_courses"]["Insert"]>;
        Relationships: [];
      };
      grade_components: {
        Row: { id: string; course_id: string; name: string; kind: string; weight: number; grade: number | null; date: string | null; difficulty: number | null; study_start_date: string | null; topics: string | null; status: string; sort_order: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["grade_components"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["grade_components"]["Insert"]>;
        Relationships: [];
      };
      academic_exams: {
        Row: { id: string; course_id: string; name: string; date: string; grade: number | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["academic_exams"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["academic_exams"]["Insert"]>;
        Relationships: [];
      };
      assignments: {
        Row: { id: string; course_id: string; title: string; description: string | null; due_date: string | null; weight: number | null; grade: number | null; status: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["assignments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["assignments"]["Insert"]>;
        Relationships: [];
      };
      class_schedule: {
        Row: { id: string; course_id: string; day_of_week: number; start_time: string; end_time: string; room: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["class_schedule"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["class_schedule"]["Insert"]>;
        Relationships: [];
      };
      semesters: {
        Row: { id: string; label: string; start_date: string | null; end_date: string | null; gpa: number | null; credits_taken: number | null; credits_passed: number | null; notes: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["semesters"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["semesters"]["Insert"]>;
        Relationships: [];
      };

      /* ── Health ────────────────────────────────────────── */
      health_entries: {
        Row: { id: string; date: string; sleep_hours: number | null; sleep_quality: number | null; weight_kg: number | null; calories: number | null; protein_g: number | null; water_l: number | null; workout_minutes: number | null; workout_type: string | null; mood: number | null; energy: number | null; steps: number | null; resting_hr: number | null; active_calories: number | null; bedtime: string | null; wake_time: string | null; source: string | null; notes: string | null; created_at: string };
        Insert: Partial<Omit<Database["public"]["Tables"]["health_entries"]["Row"], "id" | "created_at">> & { date: string };
        Update: Partial<Database["public"]["Tables"]["health_entries"]["Insert"]>;
        Relationships: [];
      };
      weight_logs: {
        Row: { id: string; date: string; weight_kg: number; body_fat_pct: number | null; muscle_kg: number | null; notes: string | null; source: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["weight_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["weight_logs"]["Insert"]>;
        Relationships: [];
      };

      /* ── Goals ─────────────────────────────────────────── */
      goals: {
        Row: { id: string; title: string; category: string; description: string | null; target_date: string | null; started_at: string | null; progress_type: string; current_value: number; target_value: number | null; unit: string | null; image_url: string | null; pinned: boolean; status: string; completed_at: string | null; sort_order: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["goals"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
        Relationships: [];
      };
      goal_milestones: {
        Row: { id: string; goal_id: string; title: string; done: boolean; done_at: string | null; due_date: string | null; sort_order: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["goal_milestones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["goal_milestones"]["Insert"]>;
        Relationships: [];
      };
      goal_habits: {
        Row: { goal_id: string; habit_id: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["goal_habits"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["goal_habits"]["Insert"]>;
        Relationships: [];
      };

      /* ── Time ──────────────────────────────────────────── */
      time_blocks: {
        Row: { id: string; start_time: string; label: string; active: boolean; sort_order: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["time_blocks"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["time_blocks"]["Insert"]>;
        Relationships: [];
      };
      time_logs: {
        Row: { id: string; block_id: string | null; label: string; started_at: string; ended_at: string | null; duration_minutes: number | null; category: string | null; client_id: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["time_logs"]["Row"], "id" | "created_at" | "duration_minutes">;
        Update: Partial<Database["public"]["Tables"]["time_logs"]["Insert"]>;
        Relationships: [];
      };

      /* ── Reading ───────────────────────────────────────── */
      reading_items: {
        Row: { id: string; url: string; title: string | null; summary: string | null; source: string | null; type: string; estimated_minutes: number | null; status: string; notes: string | null; added_at: string; completed_at: string | null; cover_url: string | null; total_pages: number | null; current_page: number | null };
        Insert: Omit<Database["public"]["Tables"]["reading_items"]["Row"], "id" | "added_at">;
        Update: Partial<Database["public"]["Tables"]["reading_items"]["Insert"]>;
        Relationships: [];
      };

      /* ── Gym / Entrenamiento ───────────────────────────── */
      workout_routines: {
        Row: { id: string; name: string; active: boolean; notes: string | null; sort_order: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["workout_routines"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["workout_routines"]["Insert"]>;
        Relationships: [];
      };
      workout_days: {
        Row: { id: string; routine_id: string; name: string; day_order: number; muscle_groups: string[]; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["workout_days"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["workout_days"]["Insert"]>;
        Relationships: [];
      };
      workout_exercises: {
        Row: { id: string; day_id: string; name: string; muscle_group: string | null; target_sets: number; target_reps: string | null; sort_order: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["workout_exercises"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["workout_exercises"]["Insert"]>;
        Relationships: [];
      };
      workout_sessions: {
        Row: { id: string; date: string; routine_id: string | null; day_id: string | null; day_name: string | null; duration_minutes: number | null; bodyweight_kg: number | null; notes: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["workout_sessions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["workout_sessions"]["Insert"]>;
        Relationships: [];
      };
      workout_sets: {
        Row: { id: string; session_id: string; exercise_id: string | null; exercise_name: string; muscle_group: string | null; set_number: number; weight_kg: number | null; reps: number | null; rpe: number | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["workout_sets"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["workout_sets"]["Insert"]>;
        Relationships: [];
      };

      /* ── Pages ─────────────────────────────────────────── */
      custom_pages: {
        Row: { id: string; title: string; emoji: string | null; content: string | null; sort_order: number; active: boolean; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["custom_pages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["custom_pages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_brain_notes: {
        Args: { query_embedding: number[]; match_count?: number; min_similarity?: number };
        Returns: { id: string; content: string; created_at: string; similarity: number }[];
      };
    };
    Enums: Record<string, never>;
  };
}

/* Convenience row types */
export type Priority = Database["public"]["Tables"]["priorities"]["Row"];
export type DailyNote = Database["public"]["Tables"]["daily_notes"]["Row"];
export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitCompletion = Database["public"]["Tables"]["habit_completions"]["Row"];
export type FinancialEntry = Database["public"]["Tables"]["financial_entries"]["Row"];
export type CapitalGoal = Database["public"]["Tables"]["capital_goals"]["Row"];
export type BankAccount = Database["public"]["Tables"]["bank_accounts"]["Row"];
export type CreditCard = Database["public"]["Tables"]["credit_cards"]["Row"];
export type Investment = Database["public"]["Tables"]["investments"]["Row"];
export type Debt = Database["public"]["Tables"]["debts"]["Row"];
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type RecurringCharge = Database["public"]["Tables"]["recurring_charges"]["Row"];
export type FlouviaClient = Database["public"]["Tables"]["flouvia_clients"]["Row"];
export type FlouviaProject = Database["public"]["Tables"]["flouvia_projects"]["Row"];
export type FlouviaInvoice = Database["public"]["Tables"]["flouvia_invoices"]["Row"];
export type FlouviaFollowup = Database["public"]["Tables"]["flouvia_followups"]["Row"];
export type ShadowConversation = Database["public"]["Tables"]["shadow_conversations"]["Row"];
export type ShadowMessage = Database["public"]["Tables"]["shadow_messages"]["Row"];
export type ShadowMemory = Database["public"]["Tables"]["shadow_memory"]["Row"];
export type BrainNote = Database["public"]["Tables"]["brain_notes"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalMilestone = Database["public"]["Tables"]["goal_milestones"]["Row"];
export type GoalHabit = Database["public"]["Tables"]["goal_habits"]["Row"];
export type AcademicCourse = Database["public"]["Tables"]["academic_courses"]["Row"];
export type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
export type GradeComponent = Database["public"]["Tables"]["grade_components"]["Row"];
export type ClassSchedule = Database["public"]["Tables"]["class_schedule"]["Row"];
export type HealthEntry = Database["public"]["Tables"]["health_entries"]["Row"];
export type WeightLog = Database["public"]["Tables"]["weight_logs"]["Row"];
export type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];
export type TimeBlock = Database["public"]["Tables"]["time_blocks"]["Row"];
export type ReadingItem = Database["public"]["Tables"]["reading_items"]["Row"];
export type CustomPage = Database["public"]["Tables"]["custom_pages"]["Row"];
export type WorkoutRoutine = Database["public"]["Tables"]["workout_routines"]["Row"];
export type WorkoutDay = Database["public"]["Tables"]["workout_days"]["Row"];
export type WorkoutExercise = Database["public"]["Tables"]["workout_exercises"]["Row"];
export type WorkoutSession = Database["public"]["Tables"]["workout_sessions"]["Row"];
export type WorkoutSet = Database["public"]["Tables"]["workout_sets"]["Row"];
