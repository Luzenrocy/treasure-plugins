export interface DiffSettings {
  wordWrap: boolean;
  hideUnchanged: boolean;
  ignoreTrailingWhitespace: boolean;
}

export const defaultDiffSettings: DiffSettings = { wordWrap: true, hideUnchanged: false, ignoreTrailingWhitespace: false };
