export interface IconMeta {
  code: string;
  name: string;
  alias: string;
  version: string;
  url: string;
}

export interface IconsManifest {
  generatedAt: string;
  count: number;
  icons: IconMeta[];
}