export interface Note {
  id?: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string; // Make updated_at optional
  tags?: { id: number; name: string }[];
  project?: {
    id: number;
    name: string;
  };
}
