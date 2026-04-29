import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PostService } from '../../services/post.service';
import { User } from '../../models/user.model';
import { FollowUser } from '../../models/post.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  user: User | null = null;
  followerCount = 0;
  followingCount = 0;
  showFollowModal = false;
  followModalTitle = '';
  followModalUsers: FollowUser[] = [];
  followModalLoading = false;
  private sub?: Subscription;
  private followSub?: Subscription;

  constructor(private auth: AuthService, private postService: PostService, private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit(): void {
    this.sub = this.auth.user$.subscribe((u) => {
      this.user = u;
      this.cdr.detectChanges();
      if (u) {
        this.loadFollowCounts(u.id);
      }
    });
    this.followSub = this.postService.followCountRefresh$.subscribe(() => {
      if (this.user) {
        this.loadFollowCounts(this.user.id);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.followSub?.unsubscribe();
  }

  private loadFollowCounts(userId: string): void {
    this.postService.getFollowCounts(userId).subscribe({
      next: (c) => {
        this.followerCount = c.follower_count;
        this.followingCount = c.following_count;
        this.cdr.detectChanges();
      },
    });
  }

  logout(): void {
    this.auth.logout();
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
