import { Task } from "./Task";

// Project.ts
export interface Project {
  id?: number;
  name: string;
  description?: string;
  area_id?: number | null;
  active: boolean;            // Add this field
  pin_to_sidebar: boolean;     // Add this field
}