// Mirrors the backend DTOs (see entry/README.md).

export type Role = 'RESIDENT' | 'ENTRANCE_ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface EntranceSummary {
  id: string;
  name: string;
  address: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  floor: string;
  apartment: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  entrance: EntranceSummary;
  createdAt: string;
}

export interface Resident {
  id: string;
  firstName: string;
  lastName: string;
  floor: string;
  apartment: string;
  role: Role;
  avatarUrl: string | null;
}

export interface Member extends Resident {
  email: string;
  status: UserStatus;
  createdAt: string;
}

export interface Entrance extends EntranceSummary {
  memberCount: number;
  inviteCode: string | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FileDto {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export interface Post {
  id: string;
  author: Resident;
  text: string | null;
  images: FileDto[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  author: Resident;
  text: string;
  createdAt: string;
}

export interface LikeResponse {
  postId: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface ChatMessage {
  id: string;
  sender: Resident;
  text: string | null;
  image: FileDto | null;
  createdAt: string;
}

export interface PollResults {
  pollId: string;
  yesCount: number;
  noCount: number;
  totalVotes: number;
  yesPercent: number;
  noPercent: number;
}

export interface Poll {
  id: string;
  author: Resident;
  question: string;
  expiresAt: string | null;
  expired: boolean;
  results: PollResults;
  myVote: boolean | null;
  createdAt: string;
}

export type NotificationType =
  | 'NEW_POST'
  | 'NEW_POLL'
  | 'NEW_COMMENT'
  | 'POST_LIKED'
  | 'JOIN_REQUEST'
  | 'MEMBERSHIP_APPROVED'
  | 'TRIAL_ENDING';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: Resident | null;
  targetId: string | null;
  preview: string | null;
  count: number;
  read: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  newMessages: boolean;
  newPolls: boolean;
  newPosts: boolean;
}

export type BillingState = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'FREE';

export interface Billing {
  enabled: boolean;
  state: BillingState;
  accessAllowed: boolean;
  trialEndsAt: string;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceLabel: string | null;
  canSubscribe: boolean;
  canManage: boolean;
}

export interface FeeRow {
  unitId: string;
  floor: string;
  apartment: string;
  residents: string[];
  mine: boolean;
  /** 12 entries, January first: when it was marked paid, or null. */
  paid: (string | null)[];
}

export interface FeeTable {
  year: number;
  amount: number | null;
  currency: string;
  rows: FeeRow[];
}

/** Envelope of every STOMP message. */
export interface RealtimeEvent<T = unknown> {
  type: string;
  payload: T;
}

/** RFC 9457 error body from the backend. */
export interface ApiProblem {
  status: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string>;
}
