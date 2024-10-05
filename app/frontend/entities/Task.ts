import { Tag } from "./Tag";

export interface Task {
  id?: number;
  name: string;
  status: 'not_started' | 'in_progress' | 'done' | 'archived';
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  note?: string;
  tags?: Tag[];
  project_id?: number;
}
