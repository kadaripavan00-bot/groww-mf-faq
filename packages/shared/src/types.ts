// Shared types: single contract between web app and API.
export type Topic =
  | "expense_ratio" | "exit_load" | "minimum_sip" | "lock_in"
  | "riskometer" | "benchmark" | "statement" | "platform" | "amc" | "general";

export type ResultMode = "fact" | "directory" | "refusal" | "listing";

export interface SourceLink { title: string; url: string; }

export interface AskRequest { query: string; vector?: number[]; }

export interface FundListItem { name: string; url: string; }

export interface AskResponse {
  answer: string;
  source: SourceLink;
  last_updated_from_sources: string;
  mode: ResultMode;
  list?: FundListItem[];
}

export interface FactRow {
  id: string;
  scheme_id: string | null;
  topic: Topic;
  question: string;
  answer: string;
  source_title: string;
  source_url: string;
  is_popular: boolean;
  verified_at: string;
}

export interface DirectoryRow { fund_name: string; url: string; }
