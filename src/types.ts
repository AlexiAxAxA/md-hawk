export type Language = 'ru' | 'en' | 'zh' | 'es' | 'fr' | 'de' | 'pt' | 'hi' | 'ar' | 'ja' | 'ko' | 'it' | 'tr' | 'id' | 'vi' | 'bn';
export type Theme = 'light' | 'dark' | 'mono-light' | 'mono-dark' | 'sepia' | 'blue';
export interface Position { text: string; before: string; after: string; heading: string; headingIndex: number; offset: number; fraction: number }
export interface Bookmark { id: string; name: string; position: Position }
export interface DocumentRecord { id: string; path: string; title: string; preview: string; lastOpened: number; pinned: boolean; position: Position | null; bookmarks: Bookmark[]; missing?: boolean }
export interface DocumentData { record: DocumentRecord; content: string; format?: 'markdown' | 'pdf' | 'docx'; fragment?: string }
export interface Settings { theme: Theme; rememberPosition: boolean; fontSize: number; columnWidth: number; language: Language; customColors: Partial<Record<Theme, Record<string, string>>>; fontFamily: 'serif' | 'sans' | 'mono'; lineHeight: number; paragraphSpacing: number }
export interface Space { id: string; name: string; documentIds: string[] }
export interface State { documents: DocumentRecord[]; settings: Settings; spaces: Space[]; warning: string; blocked: boolean }
export interface Heading { id: string; text: string; depth: number }
export interface Hawk {
  platform: string; copyText(value: string): Promise<void>;
  state(): Promise<State>; openDialog(): Promise<DocumentData[]>; openId(id: string): Promise<DocumentData>;
  openRelative(id: string, reference: string): Promise<DocumentData>; relocate(id: string): Promise<DocumentData | null>;
  pin(id: string, pinned: boolean): Promise<void>; remove(id: string): Promise<void>;
  settings(patch: Partial<Settings>): Promise<Settings>; savePosition(id: string, value: Position): Promise<void>;
  saveSpace(id: string | null, name: string, documentIds: string[]): Promise<string>; removeSpace(id: string): Promise<void>;
  addBookmark(id: string, value: Position): Promise<Bookmark>; renameBookmark(id: string, bookmarkId: string, name: string): Promise<void>; removeBookmark(id: string, bookmarkId: string): Promise<void>;
  image(id: string, reference: string): Promise<string>; external(url: string): Promise<void>; reset(): Promise<void>;
  drop(files: File[]): Promise<DocumentData[]>; ready(): Promise<void>; flushed(): Promise<void>;
  onOpen(callback: (doc: DocumentData) => void): () => void; onError(callback: (error: string) => void): () => void; onFlush(callback: () => void): () => void;
}
declare global { interface Window { hawk: Hawk } }
