import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Post, RawPost, Comment, LikeStatus, FollowStatus, FollowUser } from '../models/post.model';

@Injectable({ providedIn: 'root' })
export class PostService {
  followCountRefresh$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getPosts(): Observable<Post[]> {
    return this.http
      .get<RawPost[]>('/api/posts', { headers: this.authHeaders() })
      .pipe(map((raw) => (raw || []).map((r) => this.normalize(r))));
  }

  getMyPosts(): Observable<Post[]> {
    return this.http
      .get<RawPost[]>('/api/my-posts', { headers: this.authHeaders() })
      .pipe(map((raw) => (raw || []).map((r) => this.normalize(r))));
  }

  createPost(title: string, content: string): Observable<Post> {
    return this.http
      .post<RawPost>('/api/posts', { title, content }, { headers: this.authHeaders() })
      .pipe(map((r) => this.normalize(r)));
  }

  getPost(id: string): Observable<Post> {
    return this.http
      .get<{ post: RawPost; comment_count: number; like_count: number }>(`/api/posts/${id}`, { headers: this.authHeaders() })
      .pipe(map((res) => this.normalize(res.post)));
  }

  updatePost(id: string, title: string, content: string): Observable<Post> {
    return this.http
      .put<RawPost>(`/api/posts/${id}`, { title, content }, { headers: this.authHeaders() })
      .pipe(map((r) => this.normalize(r)));
  }

  deletePost(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/posts/${id}`, { headers: this.authHeaders() });
  }

  // --- Comments ---

  getComments(postId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(`/api/posts/${postId}/comments`, { headers: this.authHeaders() })
      .pipe(map((c) => c || []));
  }

  createComment(postId: string, content: string): Observable<Comment> {
    return this.http.post<Comment>(`/api/posts/${postId}/comments`, { content }, { headers: this.authHeaders() });
  }

  deleteComment(commentId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/comments/${commentId}`, { headers: this.authHeaders() });
  }

  // --- Likes ---

  getLikeStatus(postId: string): Observable<LikeStatus> {
    return this.http.get<LikeStatus>(`/api/posts/${postId}/like`, { headers: this.authHeaders() });
  }

  toggleLike(postId: string): Observable<LikeStatus> {
    return this.http.post<LikeStatus>(`/api/posts/${postId}/like`, {}, { headers: this.authHeaders() });
  }

  // --- Users / Search ---

  searchUsers(query: string): Observable<any[]> {
    return this.http.get<any[]>(`/api/users/search`, {
      headers: this.authHeaders(),
      params: { q: query },
    }).pipe(map((users) => users || []));
  }

  getUserPosts(userId: string): Observable<{ user: any; posts: Post[] }> {
    return this.http.get<{ user: any; posts: RawPost[] }>(`/api/users/${userId}/posts`, {
      headers: this.authHeaders(),
    }).pipe(map((res) => ({
      user: res.user,
      posts: (res.posts || []).map((r) => this.normalize(r)),
    })));
  }

  // --- Follow ---

  toggleFollow(userId: string): Observable<FollowStatus> {
    return this.http.post<FollowStatus>(`/api/users/${userId}/follow`, {}, { headers: this.authHeaders() }).pipe(
      tap(() => this.followCountRefresh$.next()),
    );
  }

  getFollowStatus(userId: string): Observable<FollowStatus> {
    return this.http.get<FollowStatus>(`/api/users/${userId}/follow-status`, { headers: this.authHeaders() });
  }

  getFollowCounts(userId: string): Observable<{ follower_count: number; following_count: number }> {
    return this.http.get<{ follower_count: number; following_count: number }>(`/api/users/${userId}/counts`, {
      headers: this.authHeaders(),
    });
  }

  getFollowers(userId: string): Observable<FollowUser[]> {
    return this.http.get<FollowUser[]>(`/api/users/${userId}/followers`, { headers: this.authHeaders() }).pipe(
      map(users => users || []),
    );
  }

  getFollowing(userId: string): Observable<FollowUser[]> {
    return this.http.get<FollowUser[]>(`/api/users/${userId}/following`, { headers: this.authHeaders() }).pipe(
      map(users => users || []),
    );
  }

  normalize(r: RawPost): Post {
    const id = r.id || r.ID || '';
    const user = r.user || r.User;
    const userId = r.user_id || r.UserID || user?.id || user?.ID || '';
    const title = r.title || r.Title || '';
    const content = r.content || r.Content || '';
    const imageUrl = r.image_url || r.ImageURL || undefined;
    const createdRaw = r.createdAt || r.CreatedAt;
    const createdAt = createdRaw ? new Date(createdRaw).toISOString() : new Date().toISOString();
    const authorName = user ? (user.name || user.Name || 'Unknown') : 'Unknown';
    const authorPicture = user ? (user.picture || user.Picture || '') : '';

    return { id, userId, title, content, imageUrl, createdAt, authorName, authorPicture };
  }
}
