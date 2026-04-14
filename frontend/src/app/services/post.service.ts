import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Post, RawPost } from '../models/post.model';

@Injectable({ providedIn: 'root' })
export class PostService {
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

  private normalize(r: RawPost): Post {
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
