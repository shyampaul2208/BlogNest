import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PostService } from '../../services/post.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { Post } from '../../models/post.model';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css',
})
export class FeedComponent implements OnInit, OnDestroy {
  posts: Post[] = [];
  loading = true;
  error = '';
  private currentUserId = '';
  private sub?: Subscription;

  constructor(
    private auth: AuthService,
    private postService: PostService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.auth.user$.subscribe((u) => {
      this.currentUserId = u?.id ?? '';
      this.cdr.markForCheck();
    });
    this.loadPosts();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadPosts(): void {
    this.loading = true;
    this.error = '';
    this.postService.getPosts().subscribe({
      next: (posts) => {
        this.posts = posts.filter((p) => p.userId !== this.currentUserId);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Unable to load posts. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}
