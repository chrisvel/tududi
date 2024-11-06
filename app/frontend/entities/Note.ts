export interface Note {
  id?: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string; 
  tags?: { id: number; name: string }[];
  project?: {
    id: number;
    name: string;
  };
}
