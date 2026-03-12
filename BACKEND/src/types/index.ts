export interface User {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'intern' | 'supervisor' | 'admin';
  organization?: string;
  department?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  is_active: boolean;
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export interface TaskStatus {
  status: 'pending' | 'submitted' | 'in_review' | 'approved' | 'revision' | 'rejected';
}

export interface Task {
  id: number;
  uuid: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: number;
  assigned_by: number;
  project_id?: number;
  due_date?: string;
  submitted_at?: string;
  reviewed_at?: string;
  progress_pct: number;
  supervisor_notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  user_id: number;
  full_name: string;
  total_tasks: number;
  approved: number;
  submitted: number;
  pending: number;
  needs_revision: number;
  overdue: number;
  avg_rating: number;
}