import { Task } from "./Task";

// Project.ts
export interface Project {
  id: number;
  name: string;
  description?: string;
  area_id?: number;
  tasks?: Task[];
}
