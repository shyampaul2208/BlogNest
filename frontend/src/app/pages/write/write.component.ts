import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PostService } from '../../services/post.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

@Component({
  selector: 'app-write',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './write.component.html',
  styleUrl: './write.component.css',
})
export class WriteComponent {
  title = '';
  content = '';
  publishing = false;
  error = '';

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  uploadError = '';

  constructor(private posts: PostService, private router: Router) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.uploadError = 'Invalid file type. Only JPEG, PNG, GIF, WEBP allowed.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'Image too large (max 5MB).';
      return;
    }

    this.selectedFile = file;
    this.uploadError = '';

    const reader = new FileReader();
    reader.onload = () => { this.imagePreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.uploadError = '';
  }

  publish(): void {
    if (!this.title.trim() || !this.content.trim()) {
      this.error = 'Title and content are required.';
      return;
    }

    this.publishing = true;
    this.error = '';

    if (this.selectedFile) {
      this.posts.uploadImage(this.selectedFile).subscribe({
        next: (res) => this.createPostWithUrl(res.url),
        error: (err) => {
          this.publishing = false;
          this.error = err?.error?.error || 'Failed to upload image.';
        },
      });
    } else {
      this.createPostWithUrl(undefined);
    }
  }

  private createPostWithUrl(imageUrl?: string): void {
    this.posts.createPost(this.title.trim(), this.content.trim(), imageUrl).subscribe({
      next: () => {
        this.publishing = false;
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.publishing = false;
        this.error = err?.error?.error || 'Failed to publish. Please try again.';
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/home']);
  }
}
