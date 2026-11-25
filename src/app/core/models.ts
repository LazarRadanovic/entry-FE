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

export type AnnouncementKind = 'RENOVATION' | 'CELEBRATION' | 'MOVING' | 'OTHER';

/** Planned noise. Dates are "YYYY-MM-DD" (inclusive); times "HH:mm:ss" (both null = all day). */
export interface Announcement {
  id: string;
  author: Resident;
  kind: AnnouncementKind;
  startDate: string;
  endDate: string;
  fromTime: string | null;
  toTime: string | null;
  note: string | null;
  ongoing: boolean;
  createdAt: string;
}

export interface AnnouncementRequest {
  kind: AnnouncementKind;
  startDate: string;
  endDate: string;
  fromTime: string | null;
  toTime: string | null;
  note: string | null;
}

export type LostFoundKind = 'FOUND' | 'LOST';
export type LostFoundCategory = 'KEYS' | 'PACKAGE' | 'PET' | 'TOY' | 'DOCUMENTS' | 'CLOTHING' | 'OTHER';

/** responders: neighbours who said "it's mine" (FOUND) / "I found it" (LOST). resolvedAt: null while open. */
export interface LostFoundItem {
  id: string;
  author: Resident;
  kind: LostFoundKind;
  category: LostFoundCategory;
  title: string;
  description: string | null;
  location: string | null;
  photo: FileDto | null;
  responders: Resident[];
  resolvedAt: string | null;
  createdAt: string;
}

export interface LostFoundRequest {
  kind: LostFoundKind;
  category: LostFoundCategory;
  title: string;
  description: string | null;
  location: string | null;
  photoFileId: string | null;
}

export type NotificationType =
  | 'NEW_POST'
  | 'NEW_POLL'
  | 'NEW_COMMENT'
  | 'POST_LIKED'
  | 'JOIN_REQUEST'
  | 'MEMBERSHIP_APPROVED'
  | 'TRIAL_ENDING'
  | 'NEW_ANNOUNCEMENT'
  | 'NEW_LOST_FOUND'
  | 'LOST_FOUND_RESPONSE';

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
  /** Trial over without a subscription: everything can be read, nothing posted or changed. */
  readOnly: boolean;
  trialEndsAt: string;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceLabel: string | null;
  canSubscribe: boolean;
  canManage: boolean;
}

export type CostType = 'PER_APARTMENT' | 'BY_AREA';
export type CostRecurrence = 'MONTHLY' | 'ONE_TIME';

/** An apartment. residents: app users living there (empty for admin-added apartments). */
export interface Unit {
  id: string;
  floor: string;
  apartment: string;
  areaM2: number | null;
  residents: string[];
  mine: boolean;
}

export interface Cost {
  id: string;
  name: string;
  description: string | null;
  type: CostType;
  /** Per-apartment amount (PER_APARTMENT) or the total to split (BY_AREA). */
  amount: number;
  currency: string;
  recurrence: CostRecurrence;
  appliesToAll: boolean;
  /** Assigned apartments; empty when appliesToAll. */
  unitIds: string[];
  dueDate: string | null;
  /** BY_AREA cost with an apartment without area: shares can't be computed. */
  missingArea: boolean;
}

export interface CostRequest {
  name: string;
  description: string | null;
  type: CostType;
  amount: number;
  currency: string;
  recurrence: CostRecurrence;
  dueDate: string | null;
  appliesToAll: boolean;
  unitIds: string[];
}

export interface CostRow {
  unitId: string;
  floor: string;
  apartment: string;
  areaM2: number | null;
  residents: string[];
  mine: boolean;
  /** What the apartment owes per period; null when area is missing. */
  share: number | null;
  /** 12 entries (January first) for monthly costs, 1 for one-time: when it was marked paid, or null. */
  paid: (string | null)[];
}

export interface CostTable {
  year: number;
  cost: Cost;
  rows: CostRow[];
}

export interface MyCost {
  cost: Cost;
  share: number | null;
  paid: (string | null)[];
}

export interface MyCosts {
  year: number;
  unitId: string | null;
  floor: string | null;
  apartment: string | null;
  costs: MyCost[];
}

export type Trade =
  | 'PLUMBER'
  | 'ELECTRICIAN'
  | 'LOCKSMITH'
  | 'PAINTER'
  | 'CARPENTER'
  | 'HVAC'
  | 'CLEANING'
  | 'ELEVATOR'
  | 'MOVING'
  | 'OTHER';

export interface Craftsman {
  id: string;
  name: string;
  trade: Trade;
  phone: string;
  email: string | null;
  website: string | null;
  description: string | null;
  photo: FileDto | null;
  addedBy: string | null;
  canEdit: boolean;
  recommendations: number;
  recommendedByMe: boolean;
  createdAt: string;
}

export interface CraftsmanRequest {
  name: string;
  trade: Trade;
  phone: string;
  email: string | null;
  website: string | null;
  description: string | null;
  photoFileId: string | null;
}

export interface RecommendResponse {
  craftsmanId: string;
  recommendations: number;
  recommendedByMe: boolean;
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
