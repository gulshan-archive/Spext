export interface TranscriptionEntry {
  id: string;
  original_text: string;
  processed_text: string | null;
  provider: string;
  language: string;
  duration_secs: number;
  created_at: string;
}

export interface HistoryFilter {
  search: string;
  provider: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}
