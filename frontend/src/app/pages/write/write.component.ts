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

  constructor(private posts: PostService, private router: Router) {}

  publish(): void {
    if (!this.title.trim() || !this.content.trim()) {
      this.error = 'Title and content are required.';
      return;
    }

    this.publishing = true;
    this.error = '';

    this.posts.createPost(this.title.trim(), this.content.trim()).subscribe({
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
