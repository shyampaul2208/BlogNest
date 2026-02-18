import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../auth';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  isSignup = false;
  isLoading = false;
  error = '';

  // Login form
  loginEmail = '';
  loginPassword = '';

  // Signup form
  firstName = '';
  lastName = '';
  signupEmail = '';
  signupPassword = '';
  confirmPassword = '';

  constructor(private authService: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.router.navigate(['/home']);
      }
    });
    this.authService.handleAuthCallback();
  }

  login() {
    this.authService.loginWithGoogle();
  }

  toggleMode() {
    this.isSignup = !this.isSignup;
    this.error = '';
    this.resetForms();
  }

  resetForms() {
    this.loginEmail = '';
    this.loginPassword = '';
    this.firstName = '';
    this.lastName = '';
    this.signupEmail = '';
    this.signupPassword = '';
    this.confirmPassword = '';
  }

  handleEmailLogin() {
    if (!this.loginEmail || !this.loginPassword) {
      this.error = 'Please fill in all fields';
      return;
    }

    console.log('Starting login with:', this.loginEmail);
    this.isLoading = true;
    this.error = '';

    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: (response) => {
        console.log('Login success:', response);
        this.isLoading = false;
        // If we get a response, navigation happens automatically
      },
      error: (err) => {
        console.log('LOGIN ERROR HANDLER CALLED');
        console.log('Full error object:', err);
        console.log('err.error:', err?.error);
        console.log('err.status:', err?.status);
        
        this.isLoading = false;
        
        let errorMessage = 'Login failed. Please try again.';
        
        // Try err.error.error (standard REST error format)
        if (err?.error?.error) {
          errorMessage = err.error.error;
          console.log('Using err.error.error:', errorMessage);
        }
        // Try err.error as string
        else if (typeof err?.error === 'string') {
          errorMessage = err.error;
          console.log('Using err.error as string:', errorMessage);
        }
        // Try err.message
        else if (err?.message) {
          errorMessage = err.message;
          console.log('Using err.message:', errorMessage);
        }
        // Try err.statusText
        else if (err?.statusText && err.statusText !== 'Unknown Error') {
          errorMessage = err.statusText;
          console.log('Using err.statusText:', errorMessage);
        }
        
        console.log('Final error message:', errorMessage);
        console.log('Setting this.error to:', errorMessage);
        this.error = errorMessage;
        this.cdr.markForCheck();
        console.log('After setting, this.error is:', this.error);
        console.log('After setting, isLoading is:', this.isLoading);
      }
    });
  }

  handleSignup() {
    if (!this.firstName || !this.lastName || !this.signupEmail || !this.signupPassword || !this.confirmPassword) {
      this.error = 'Please fill in all fields';
      return;
    }

    if (this.signupPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match';
      return;
    }

    if (this.signupPassword.length < 6) {
      this.error = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.signup(this.firstName, this.lastName, this.signupEmail, this.signupPassword).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Navigation happens automatically via ngOnInit subscription
      },
      error: (err) => {
        this.isLoading = false;
        
        // Try multiple ways to extract the error message
        let errorMessage = 'Signup failed. Please try again.';
        
        // Try err.error.error (standard REST error format)
        if (err?.error?.error) {
          errorMessage = err.error.error;
        }
        // Try err.error as string
        else if (typeof err?.error === 'string') {
          errorMessage = err.error;
        }
        // Try err.message
        else if (err?.message) {
          errorMessage = err.message;
        }
        // Try err.statusText
        else if (err?.statusText && err.statusText !== 'Unknown Error') {
          errorMessage = err.statusText;
        }
        
        this.error = errorMessage;
        this.cdr.markForCheck();
        console.error('Signup failed:', {
          fullError: err,
          errorMessage: errorMessage,
          status: err?.status,
          statusText: err?.statusText
        });
      }
    });
  }
}
