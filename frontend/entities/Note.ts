import { Tag } from "./Tag";

export interface Note {
  id?: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string; 
  tags?: Tag[];
  project?: {
    id: number;
    name: string;
  };
}
