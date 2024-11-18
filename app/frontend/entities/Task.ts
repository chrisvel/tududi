import { Tag } from "./Tag";

export interface Task {
  id?: number;
  name: string;
  status: StatusType;
  priority?: PriorityType;
  due_date?: string;
  note?: string;
  tags?: Tag[];
  project_id?: number;
  created_at?: string;
}

export type StatusType = 'not_started' | 'in_progress' | 'done' | 'archived';
export type PriorityType = 'low' | 'medium' | 'high';
