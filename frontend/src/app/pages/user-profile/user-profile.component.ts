import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { Post, LikeStatus, FollowStatus, FollowUser } from '../../models/post.model';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css',
})
export class UserProfileComponent implements OnInit {
  user: any = null;
  posts: Post[] = [];
  likeMap: Record<string, LikeStatus> = {};
  followStatus: FollowStatus | null = null;
  isOwnProfile = false;
  loading = true;
  error = '';
  showFollowModal = false;
  followModalTitle = '';
  followModalUsers: FollowUser[] = [];
  followModalLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private postService: PostService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadUser(id);
    }
  }

  private loadUser(userId: string): void {
    this.loading = true;
    const currentUser = this.auth.getUser();
    this.isOwnProfile = currentUser?.id === userId;

    this.postService.getUserPosts(userId).subscribe({
      next: (res) => {
        this.user = res.user;
        this.posts = res.posts;
        this.loading = false;
        this.cdr.detectChanges();
        this.posts.forEach((p) => {
          this.postService.getLikeStatus(p.id).subscribe({
            next: (s) => {
              this.likeMap[p.id] = s;
              this.cdr.detectChanges();
            },
          });
        });
        // Load follow status
        if (!this.isOwnProfile) {
          this.postService.getFollowStatus(userId).subscribe({
            next: (fs) => {
              this.followStatus = fs;
              this.cdr.detectChanges();
            },
          });
        } else {
          this.postService.getFollowCounts(userId).subscribe({
            next: (c) => {
              this.followStatus = { following: false, follower_count: c.follower_count, following_count: c.following_count };
              this.cdr.detectChanges();
            },
          });
        }
      },
      error: (err) => {
        this.error = err?.status === 404 ? 'User not found.' : 'Failed to load user profile.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openPost(postId: string): void {
    this.router.navigate(['/post', postId]);
  }

  getLikeCount(postId: string): number {
    return this.likeMap[postId]?.like_count ?? 0;
  }

  goBack(): void {
    this.router.navigate(['/search']);
  }

  toggleFollow(): void {
    if (!this.user || this.isOwnProfile) return;
    this.postService.toggleFollow(this.user.id).subscribe({
      next: (fs) => {
        this.followStatus = fs;
        this.cdr.detectChanges();
      },
    });
  }

  openFollowModal(type: 'followers' | 'following'): void {
    if (!this.user) return;
    this.followModalTitle = type === 'followers' ? 'Followers' : 'Following';
    this.followModalUsers = [];
    this.followModalLoading = true;
    this.showFollowModal = true;
    this.cdr.detectChanges();

    const obs = type === 'followers'
      ? this.postService.getFollowers(this.user.id)
      : this.postService.getFollowing(this.user.id);

    obs.subscribe({
      next: (users) => {
        this.followModalUsers = users;
        this.followModalLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.followModalLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeFollowModal(): void {
    this.showFollowModal = false;
    this.cdr.detectChanges();
  }

  viewUser(userId: string): void {
    this.closeFollowModal();
    this.router.navigate(['/user', userId]);
  }
}
