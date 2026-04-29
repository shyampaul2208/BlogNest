import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  isSignup = false;
  isLoading = false;
  error = '';

  loginEmail = '';
  loginPassword = '';

  firstName = '';
  lastName = '';
  signupEmail = '';
  signupPassword = '';
  confirmPassword = '';

  private sub?: Subscription;

  constructor(private auth: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.auth.handleAuthCallback();
    this.sub = this.auth.user$.subscribe((user) => {
      if (user) this.router.navigate(['/home']);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggleMode(): void {
    this.isSignup = !this.isSignup;
    this.error = '';
  }

  googleLogin(): void {
    this.auth.loginWithGoogle();
  }

  submitLogin(): void {
    if (!this.loginEmail || !this.loginPassword) {
      this.error = 'Please fill in all fields.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    this.auth.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || 'Login failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  submitSignup(): void {
    if (!this.firstName || !this.lastName || !this.signupEmail || !this.signupPassword || !this.confirmPassword) {
      this.error = 'Please fill in all fields.';
      return;
    }
    if (this.signupPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.signupPassword.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }
    this.isLoading = true;
    this.error = '';
    this.auth.signup(this.firstName, this.lastName, this.signupEmail, this.signupPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || 'Signup failed. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }
}
