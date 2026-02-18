import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Post, RawPost } from '../models/post.model';

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private baseUrl = '';

  constructor(private http: HttpClient) {}

  getPosts(): Observable<Post[]> {
    const token = localStorage.getItem('token');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return this.http.get<RawPost[]>('/api/posts', { headers }).pipe(
      map((raw) => (raw || []).map(r => this.normalize(r))),
      catchError(err => {
        console.error('Failed to fetch posts', err);
        return of([]);
      })
    );
  }

  private normalize(r: RawPost): Post {
    const id = r.id || r.ID || '';
    const title = r.title || r.Title || '';
    const content = r.content || r.Content || '';
    const imageUrl = r.image_url || r.ImageURL || undefined;
    const createdRaw = r.createdAt || r.CreatedAt;
    const createdAt = createdRaw ? new Date(createdRaw).toISOString() : new Date().toISOString();

    const user = r.user || r.User;
    const authorName = user ? (user.name || user.Name || 'Unknown') : 'Unknown';

    return { id, title, content, imageUrl, createdAt, authorName } as Post;
  }
}
