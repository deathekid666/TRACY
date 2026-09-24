export type CollectedResult = {
  url: string;
  title: string;
  provider: string;
  snippet?: string;
  observedAt?: string;
  publishedAt?: string;
};

export interface PublicConnector {
  id: string;
  label: string;
  search(query: string): Promise<CollectedResult[]>;
}
