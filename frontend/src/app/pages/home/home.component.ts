import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PostService } from '../../services/post.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { User } from '../../models/user.model';
import { Post } from '../../models/post.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  user: User | null = null;
  myPosts: Post[] = [];
  loading = true;
  error = '';
  private sub?: Subscription;

  constructor(
    private auth: AuthService,
    private posts: PostService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.auth.user$.subscribe((u) => {
      this.user = u;
      this.cdr.markForCheck();
    });
    this.loadMyPosts();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadMyPosts(): void {
    this.loading = true;
    this.error = '';
    this.posts.getMyPosts().subscribe({
      next: (p) => {
        this.myPosts = p;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.posts.getPosts().subscribe({
          next: (all) => {
            this.myPosts = all.filter((p) => p.userId === this.user?.id);
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.error = 'Unable to load your posts.';
            this.loading = false;
            this.cdr.markForCheck();
          },
        });
      },
    });
  }

  goWrite(): void {
    this.router.navigate(['/write']);
  }

  goFeed(): void {
    this.router.navigate(['/feed']);
  }
}
