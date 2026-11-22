import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AppNotification,
  Billing,
  ChatMessage,
  Comment,
  CursorPage,
  Entrance,
  FeeTable,
  FileDto,
  LikeResponse,
  Member,
  NotificationSettings,
  Poll,
  Post,
  Resident,
  User,
} from './models';

/** Thin typed wrapper around the REST API. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ---- files ----
  uploadImage(file: File): Observable<FileDto> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<FileDto>('/api/files', body);
  }

  // ---- me / residents ----
  updateMe(body: Pick<User, 'firstName' | 'lastName' | 'floor' | 'apartment'>): Observable<User> {
    return this.http.put<User>('/api/users/me', body);
  }
  updateAvatar(file: File): Observable<User> {
    const body = new FormData();
    body.append('file', file);
    return this.http.put<User>('/api/users/me/avatar', body);
  }
  residents(): Observable<Resident[]> {
    return this.http.get<Resident[]>('/api/users');
  }
  resident(id: string): Observable<Resident> {
    return this.http.get<Resident>(`/api/users/${id}`);
  }
  online(): Observable<Resident[]> {
    return this.http.get<Resident[]>('/api/presence');
  }
  entrance(): Observable<Entrance> {
    return this.http.get<Entrance>('/api/entrances/current');
  }

  // ---- feed ----
  posts(cursor?: string | null, authorId?: string): Observable<CursorPage<Post>> {
    let params = new HttpParams();
    if (cursor) params = params.set('cursor', cursor);
    if (authorId) params = params.set('authorId', authorId);
    return this.http.get<CursorPage<Post>>('/api/posts', { params });
  }
  post(id: string): Observable<Post> {
    return this.http.get<Post>(`/api/posts/${id}`);
  }
  createPost(text: string, imageIds: string[]): Observable<Post> {
    return this.http.post<Post>('/api/posts', { text, imageIds });
  }
  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`/api/posts/${id}`);
  }
  like(id: string, like: boolean): Observable<LikeResponse> {
    return like
      ? this.http.put<LikeResponse>(`/api/posts/${id}/like`, {})
      : this.http.delete<LikeResponse>(`/api/posts/${id}/like`);
  }
  comments(postId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`/api/posts/${postId}/comments`);
  }
  addComment(postId: string, text: string): Observable<Comment> {
    return this.http.post<Comment>(`/api/posts/${postId}/comments`, { text });
  }
  deleteComment(postId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`/api/posts/${postId}/comments/${commentId}`);
  }

  // ---- chat ----
  messages(cursor?: string | null): Observable<CursorPage<ChatMessage>> {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http.get<CursorPage<ChatMessage>>('/api/chat/messages', { params });
  }
  sendMessage(text: string | null, imageId: string | null): Observable<ChatMessage> {
    return this.http.post<ChatMessage>('/api/chat/messages', { text, imageId });
  }

  // ---- polls ----
  polls(status: 'ACTIVE' | 'EXPIRED'): Observable<Poll[]> {
    return this.http.get<Poll[]>('/api/polls', { params: { status } });
  }
  createPoll(question: string, expiresAt: string | null): Observable<Poll> {
    return this.http.post<Poll>('/api/polls', { question, expiresAt });
  }
  vote(id: string, value: boolean): Observable<Poll> {
    return this.http.put<Poll>(`/api/polls/${id}/vote`, { value });
  }
  deletePoll(id: string): Observable<void> {
    return this.http.delete<void>(`/api/polls/${id}`);
  }

  // ---- notifications ----
  notifications(cursor?: string | null): Observable<CursorPage<AppNotification>> {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http.get<CursorPage<AppNotification>>('/api/notifications', { params });
  }
  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>('/api/notifications/unread-count');
  }
  markRead(id: string): Observable<AppNotification> {
    return this.http.post<AppNotification>(`/api/notifications/${id}/read`, {});
  }
  markAllRead(): Observable<void> {
    return this.http.post<void>('/api/notifications/read-all', {});
  }
  notificationSettings(): Observable<NotificationSettings> {
    return this.http.get<NotificationSettings>('/api/notifications/settings');
  }
  updateNotificationSettings(s: NotificationSettings): Observable<NotificationSettings> {
    return this.http.put<NotificationSettings>('/api/notifications/settings', s);
  }

  // ---- push ----
  vapidKey(): Observable<{ enabled: boolean; publicKey: string | null }> {
    return this.http.get<{ enabled: boolean; publicKey: string | null }>('/api/push/vapid-public-key');
  }
  pushSubscribe(sub: PushSubscriptionJSON): Observable<void> {
    return this.http.post<void>('/api/push/subscriptions', sub);
  }
  pushUnsubscribe(endpoint: string): Observable<void> {
    return this.http.delete<void>('/api/push/subscriptions', { body: { endpoint } });
  }

  // ---- billing ----
  billing(): Observable<Billing> {
    return this.http.get<Billing>('/api/billing');
  }
  checkout(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/admin/billing/checkout', {});
  }
  billingPortal(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/admin/billing/portal', {});
  }
  syncBilling(): Observable<Billing> {
    return this.http.post<Billing>('/api/admin/billing/sync', {});
  }

  // ---- cleaning fee ----
  fees(year: number): Observable<FeeTable> {
    return this.http.get<FeeTable>('/api/fees', { params: { year } });
  }
  setFeePaid(unitId: string, year: number, month: number, paid: boolean): Observable<void> {
    return this.http.put<void>('/api/admin/fees/payments', { unitId, year, month, paid });
  }
  updateFeeSettings(amount: number, currency: string): Observable<void> {
    return this.http.put<void>('/api/admin/fees/settings', { amount, currency });
  }
  addFeeUnit(floor: string, apartment: string): Observable<void> {
    return this.http.post<void>('/api/admin/fees/units', { floor, apartment });
  }
  removeFeeUnit(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/fees/units/${id}`);
  }

  // ---- admin ----
  members(status: 'PENDING' | 'ACTIVE'): Observable<Member[]> {
    return this.http.get<Member[]>('/api/admin/members', { params: { status } });
  }
  approve(id: string): Observable<Member> {
    return this.http.post<Member>(`/api/admin/members/${id}/approve`, {});
  }
  reject(id: string): Observable<Member> {
    return this.http.post<Member>(`/api/admin/members/${id}/reject`, {});
  }
  changeRole(id: string, role: 'RESIDENT' | 'ENTRANCE_ADMIN'): Observable<Member> {
    return this.http.put<Member>(`/api/admin/members/${id}/role`, { role });
  }
  removeMember(id: string): Observable<void> {
    return this.http.delete<void>(`/api/admin/members/${id}`);
  }
  regenerateInviteCode(): Observable<{ inviteCode: string }> {
    return this.http.post<{ inviteCode: string }>('/api/admin/entrance/invite-code', {});
  }
}
