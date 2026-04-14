import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PostService } from '../../services/post.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { Post, LikeStatus, FollowStatus } from '../../models/post.model';

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
  likeMap: Record<string, LikeStatus> = {};
  followMap: Record<string, FollowStatus> = {};
  private allPosts: Post[] = [];
  private sub?: Subscription;

  constructor(
    private auth: AuthService,
    private postService: PostService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.auth.user$.subscribe((u) => {
      const currentUserId = u?.id ?? '';
      this.posts = this.allPosts.filter((p) => p.userId !== currentUserId);
      this.cdr.detectChanges();
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
        this.allPosts = posts;
        const currentUserId = this.auth.getUser()?.id ?? '';
        this.posts = posts.filter((p) => p.userId !== currentUserId);
        this.loading = false;
        this.cdr.detectChanges();
        // Load like status for each post
        this.posts.forEach((p) => {
          this.postService.getLikeStatus(p.id).subscribe({
            next: (s) => {
              this.likeMap[p.id] = s;
              this.cdr.detectChanges();
            },
          });
          // Load follow status for each author
          if (!this.followMap[p.userId]) {
            this.postService.getFollowStatus(p.userId).subscribe({
              next: (fs) => {
                this.followMap[p.userId] = fs;
                this.cdr.detectChanges();
              },
            });
          }
        });
      },
      error: () => {
        this.error = 'Unable to load posts. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openPost(postId: string): void {
    this.router.navigate(['/post', postId]);
  }

  toggleLike(event: Event, postId: string): void {
    event.stopPropagation();
    this.postService.toggleLike(postId).subscribe({
      next: (s) => {
        this.likeMap[postId] = s;
        this.cdr.detectChanges();
      },
    });
  }

  getLikeCount(postId: string): number {
    return this.likeMap[postId]?.like_count ?? 0;
  }

  isLiked(postId: string): boolean {
    return this.likeMap[postId]?.liked ?? false;
  }

  toggleFollow(event: Event, userId: string): void {
    event.stopPropagation();
    this.postService.toggleFollow(userId).subscribe({
      next: (fs) => {
        this.followMap[userId] = fs;
        this.cdr.detectChanges();
      },
    });
  }

  isFollowing(userId: string): boolean {
    return this.followMap[userId]?.following ?? false;
  }
}
