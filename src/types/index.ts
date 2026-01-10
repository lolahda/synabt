export interface Project {
  id: string;
  user_id: string;
  title: string;
  script: string;
  language?: string;
  dialect?: string;
  content_type?: string;
  status: 'draft' | 'analyzing' | 'scenes_ready' | 'generating' | 'merging' | 'completed' | 'failed';
  final_video_url?: string;
  scene_count: number;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_number: number;
  text_content: string;
  word_count?: number;
  estimated_duration?: number;
  character_prompt?: string;
  video_url?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string;
  sora_prediction_id?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  user_id: string;
  image_url: string;
  storage_path: string;
  created_at: string;
}
