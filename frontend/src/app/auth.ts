import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  picture: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8080';
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const token = localStorage.getItem('token');
    if (token) {
      this.loadUser();
    }
  }

  loginWithGoogle() {
    window.location.href = `${this.apiUrl}/auth/google`;
  }

  handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      this.loadUser();
      // Navigation will be handled by the component subscriptions
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  loadUser() {
    const token = localStorage.getItem('token');
    if (token) {
      this.http.get<User>(`${this.apiUrl}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).subscribe({
        next: (user) => this.userSubject.next(user),
        error: () => this.logout()
      });
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  signup(firstName: string, lastName: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/signup`, {
      first_name: firstName,
      last_name: lastName,
      email,
      password
    }).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        this.userSubject.next(response.user);
      })
    );
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, {
      email,
      password
    }).pipe(
      tap((response: any) => {
        localStorage.setItem('token', response.token);
        this.userSubject.next(response.user);
      })
    );
  }
}
