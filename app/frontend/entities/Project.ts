import { Area } from "./Area";
import { Tag } from "./Tag";

export interface Project {
  id?: number;
  name: string;
  description?: string;
  active: boolean;   
  pin_to_sidebar?: boolean; 
  area?: Area;
  area_id?: number | null;   
  tags?: Tag[];  
}