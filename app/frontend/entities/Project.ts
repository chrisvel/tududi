import { Task } from "./Task";

// Project.ts
export interface Project {
  id: number;
  name: string;
  description?: string;
  active?: boolean;
  pin_to_sidebar: boolean;
  area_id?: number;
  tasks?: Task[];
}
