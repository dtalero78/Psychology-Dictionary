export interface User {
  id: string;
  email: string | null;
  plan: 'free' | 'pro';
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Project {
  id: string;
  title: string;
  status: 'in_progress' | 'completed' | 'archived';
  current_step: number;
  steps_json: Record<string, StepData>;
  created_at: string;
  updated_at: string;
}

export interface StepData {
  user_input: Record<string, unknown>;
  ai_response: string;
}

export interface StepResult {
  step_number: number;
  ai_response: string;
  step_data: StepData;
}

export interface Survey {
  id: string;
  project_id: string;
  token: string;
  status: 'active' | 'closed' | 'draft';
  title: string;
  config_json: SurveyConfig;
  created_at: string;
  survey_url: string;
}

export interface SurveyConfig {
  questions: SurveyQuestion[];
  description?: string;
  estimated_minutes?: number;
  debrief_text?: string;
}

export interface SurveyQuestion {
  text: string;
  type: 'likert' | 'text' | 'select' | 'number';
  scale?: number;
  anchor_low?: string;
  anchor_high?: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface AnalysisResult {
  id: string;
  test_type: string;
  statistic: number;
  p_value: number;
  effect_size: number | null;
  effect_label: string | null;
  ci_95: [number, number] | null;
  interpretation_apa: string;
  result_json: Record<string, unknown>;
}

export interface ApaDocument {
  id: string;
  project_id: string;
  content_json: Record<string, string>;
  pdf_url: string | null;
  docx_url: string | null;
  created_at: string;
}

export interface SubscriptionStatus {
  plan: 'free' | 'pro';
  is_pro: boolean;
  expires_at: string | null;
  product_id: string | null;
}
