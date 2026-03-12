// ============================================================
// GameReel — Shared Types
// Used across all microservices and frontend
// ============================================================

// ── Game ─────────────────────────────────────────────────────

export type GameStatus = 'uploading' | 'processing' | 'ready' | 'flagged' | 'failed';
export type GameFormat = 'unity' | 'godot' | 'html5' | 'wasm';
export type GameGenre =
  | 'action'
  | 'puzzle'
  | 'platformer'
  | 'rpg'
  | 'shooter'
  | 'strategy'
  | 'sports'
  | 'horror'
  | 'simulation'
  | 'other';

export interface Game {
  id: string;
  uploaderId: string;
  title: string;
  genre: GameGenre;
  description: string;
  wasmUrl: string | null;
  assetsUrl: string | null;
  manifestUrl: string | null;
  thumbnailUrl: string | null;
  playstoreUrl: string | null;
  status: GameStatus;
  format: GameFormat | null;
  engineVersion: string | null;
  fileSizeBytes: number;
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GameManifest {
  version: 1;
  gameId: string;
  format: GameFormat;
  entryPoint: string; // relative path e.g. "index.html"
  files: ManifestFile[];
  totalSizeBytes: number;
  generatedAt: string;
}

export interface ManifestFile {
  path: string;
  sizeBytes: number;
  mimeType: string;
  priority: 'critical' | 'high' | 'normal'; // WASM first, JS, assets
}

// ── User ─────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  followingCount: number;
  gameCount: number;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

// ── Social ───────────────────────────────────────────────────

export interface Like {
  userId: string;
  gameId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  gameId: string;
  content: string;
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  createdAt: string;
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: string;
}

// ── Upload ───────────────────────────────────────────────────

export type UploadSessionStatus =
  | 'initiated'
  | 'uploading'
  | 'assembling'
  | 'complete'
  | 'failed';

export interface UploadSession {
  id: string;
  gameId: string;
  uploaderId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  chunksReceived: number;
  status: UploadSessionStatus;
  metadata: UploadMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface UploadMetadata {
  title: string;
  description: string;
  genre: GameGenre;
  playstoreUrl?: string;
}

export interface UploadInitRequest {
  filename: string;
  fileSize: number;
  totalChunks: number;
  metadata: UploadMetadata;
}

export interface UploadInitResponse {
  sessionId: string;
  gameId: string;
  chunkSize: number;
}

export interface UploadProgressResponse {
  sessionId: string;
  gameId: string;
  status: UploadSessionStatus;
  chunksReceived: number;
  totalChunks: number;
  gameStatus: GameStatus;
  percentage: number;
}

// ── Security Scanner ─────────────────────────────────────────

export type RiskLevel = 'none' | 'warning' | 'critical';

export interface GameScanResult {
  gameId: string;
  riskLevel: RiskLevel;
  flags: ScanFlag[];
  scannedAt: string;
}

export interface ScanFlag {
  type: 'critical' | 'warning';
  pattern: string;
  description: string;
  file?: string;
}

// ── Feed ─────────────────────────────────────────────────────

export interface FeedResponse {
  games: Game[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface FeedQuery {
  cursor?: string;
  limit?: number;
  userId?: string;
}

// ── WebSocket Events ──────────────────────────────────────────

export interface LiveLikeEvent {
  gameId: string;
  likeCount: number;
  userId: string;
}

export interface LiveViewerEvent {
  gameId: string;
  viewerCount: number;
}

export interface LiveCommentEvent {
  gameId: string;
  comment: Comment;
}

// ── Pagination ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

// ── API Responses ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  uptime: number;
}
