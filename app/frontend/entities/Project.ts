import { Area } from "./Area";

// Project.ts
export interface Project {
  id?: number;
  name: string;
  description?: string;
  active: boolean;            // Add this field
  pin_to_sidebar: boolean;     // Add this field
  area: Area;
}