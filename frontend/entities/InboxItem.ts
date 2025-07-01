export interface InboxItem {
  id?: number;
  content: string;
  status?: string; // 'added' | 'processed' | 'deleted'
  source?: string; // 'telegram'
  created_at?: string;
  updated_at?: string;
}