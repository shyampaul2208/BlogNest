import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PostService } from '../../services/post.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { Post, Comment, LikeStatus } from '../../models/post.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.css',
})
export class PostDetailComponent implements OnInit, OnDestroy {
  post: Post | null = null;
  comments: Comment[] = [];
  likeStatus: LikeStatus = { liked: false, like_count: 0 };
  user: User | null = null;

  loading = true;
  error = '';
  newComment = '';
  submittingComment = false;

  // Edit mode
  editing = false;
  editTitle = '';
  editContent = '';
  editImageUrl = '';
  editImageFile: File | null = null;
  editImagePreview: string | null = null;
  editError = '';
  saving = false;

  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private posts: PostService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.auth.user$.subscribe((u) => {
      this.user = u;
      this.cdr.detectChanges();
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPost(id);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadPost(id: string): void {
    this.loading = true;
    this.posts.getPost(id).subscribe({
      next: (post) => {
        this.post = post;
        this.loading = false;
        this.cdr.detectChanges();
        this.loadComments(id);
        this.loadLikeStatus(id);
      },
      error: (err) => {
        this.error = err?.status === 404 ? 'Post not found.' : 'Failed to load post.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadComments(postId: string): void {
    this.posts.getComments(postId).subscribe({
      next: (c) => {
        this.comments = c;
        this.cdr.detectChanges();
      },
    });
  }

  private loadLikeStatus(postId: string): void {
    this.posts.getLikeStatus(postId).subscribe({
      next: (s) => {
        this.likeStatus = s;
        this.cdr.detectChanges();
      },
    });
  }

  toggleLike(): void {
    if (!this.post) return;
    this.posts.toggleLike(this.post.id).subscribe({
      next: (s) => {
        this.likeStatus = s;
        this.cdr.detectChanges();
      },
    });
  }

  submitComment(): void {
    if (!this.post || !this.newComment.trim()) return;
    this.submittingComment = true;
    this.posts.createComment(this.post.id, this.newComment.trim()).subscribe({
      next: (c) => {
        this.comments.push(c);
        this.newComment = '';
        this.submittingComment = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.submittingComment = false;
        this.cdr.detectChanges();
      },
    });
  }

  removeComment(commentId: string): void {
    this.posts.deleteComment(commentId).subscribe({
      next: () => {
        this.comments = this.comments.filter((c) => c.id !== commentId);
        this.cdr.detectChanges();
      },
    });
  }

  isOwner(): boolean {
    return !!this.user && !!this.post && this.post.userId === this.user.id;
  }

  startEdit(): void {
    if (!this.post) return;
    this.editing = true;
    this.editTitle = this.post.title;
    this.editContent = this.post.content;
    this.editImageUrl = this.post.imageUrl ?? '';
    this.editImagePreview = this.post.imageUrl ?? null;
    this.editImageFile = null;
    this.editError = '';
  }

  cancelEdit(): void {
    this.editing = false;
    this.editImageFile = null;
    this.editImagePreview = null;
    this.editError = '';
  }

  onEditFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.editError = 'Invalid file type. Only JPEG, PNG, GIF, WEBP allowed.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.editError = 'Image too large (max 5MB).';
      return;
    }
    this.editImageFile = file;
    this.editError = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.editImagePreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  removeEditImage(): void {
    this.editImageFile = null;
    this.editImagePreview = null;
    this.editImageUrl = '';
  }

  saveEdit(): void {
    if (!this.post) return;
    if (!this.editTitle.trim() || !this.editContent.trim()) {
      this.editError = 'Title and content are required.';
      return;
    }
    this.saving = true;
    this.editError = '';

    if (this.editImageFile) {
      this.posts.uploadImage(this.editImageFile).subscribe({
        next: (res) => this.doSaveEdit(res.url),
        error: (err) => {
          this.editError = err?.error?.error || 'Failed to upload image.';
          this.saving = false;
          this.cdr.detectChanges();
        },
      });
    } else {
      this.doSaveEdit(this.editImageUrl);
    }
  }

  private doSaveEdit(imageUrl: string): void {
    if (!this.post) return;
    this.posts.updatePost(this.post.id, this.editTitle.trim(), this.editContent.trim(), imageUrl).subscribe({
      next: (updated) => {
        this.post = updated;
        this.editing = false;
        this.saving = false;
        this.editImageFile = null;
        this.editImagePreview = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.editError = err?.error?.error || 'Failed to update post.';
        this.saving = false;
        this.cdr.detectChanges();
      },
    });
  }

  confirmDelete(): void {
    if (!this.post) return;
    if (!confirm('Are you sure you want to delete this post?')) return;
    this.posts.deletePost(this.post.id).subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: () => {
        this.error = 'Failed to delete post.';
        this.cdr.detectChanges();
      },
    });
  }

  getCommentAuthor(comment: Comment): string {
    if (!comment.user) return 'Unknown';
    return comment.user.name || comment.user.Name || 'Unknown';
  }

  goBack(): void {
    this.router.navigate(['/feed']);
  }
}
