import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { PostService } from '../services/post.service';
import { Post } from '../models/post.model';

@Component({
  selector: 'app-feed',
  imports: [CommonModule],
  templateUrl: './feed.html',
  styleUrl: './feed.css'
})
export class Feed implements OnInit {
  posts$!: Observable<Post[]>;
  loading: boolean = true;
  error: string | null = null;

  constructor(private postService: PostService) {}

  ngOnInit() {
    this.loading = true;
    this.error = null;
    this.posts$ = this.postService.getPosts().pipe(
      finalize(() => (this.loading = false)),
      catchError(err => {
        this.error = 'Unable to load posts. Please try again later.';
        return of([]);
      })
    );
  }
}
