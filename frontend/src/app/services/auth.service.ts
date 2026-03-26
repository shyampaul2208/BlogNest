import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    if (this.isLoggedIn()) {
      this.loadUser();
    }
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  loadUser(): void {
    const token = localStorage.getItem('token');
    if (!token) return;

    this.http.get<User>('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: (user) => this.userSubject.next(user),
      error: () => this.logout(),
    });
  }

  /** Handle the ?token= query param from Google OAuth callback redirect. */
  handleAuthCallback(): void {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      this.loadUser();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  loginWithGoogle(): void {
    window.location.assign('/api/auth/google');
  }

  login(email: string, password: string): Observable<{ token: string; user: User }> {
    return this.http.post<{ token: string; user: User }>('/api/auth/login', { email, password }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.token);
        this.userSubject.next(res.user);
      }),
    );
  }

  signup(firstName: string, lastName: string, email: string, password: string): Observable<{ token: string; user: User }> {
    return this.http.post<{ token: string; user: User }>('/api/auth/signup', {
      first_name: firstName,
      last_name: lastName,
      email,
      password,
    }).pipe(
      tap((res) => {
        localStorage.setItem('token', res.token);
        this.userSubject.next(res.user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }
}
