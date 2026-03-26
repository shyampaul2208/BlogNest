import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let userSubject: BehaviorSubject<any>;
  let authService: {
    handleAuthCallback: ReturnType<typeof vi.fn>;
    loginWithGoogle: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    signup: ReturnType<typeof vi.fn>;
    user$: any;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    userSubject = new BehaviorSubject<any>(null);
    authService = {
      handleAuthCallback: vi.fn(),
      loginWithGoogle: vi.fn(),
      login: vi.fn(),
      signup: vi.fn(),
      user$: userSubject.asObservable(),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls handleAuthCallback on init', () => {
    expect(authService.handleAuthCallback).toHaveBeenCalled();
  });

  // --- toggleMode ---

  it('toggleMode switches between login and signup', () => {
    expect(component.isSignup).toBe(false);
    component.toggleMode();
    expect(component.isSignup).toBe(true);
    component.toggleMode();
    expect(component.isSignup).toBe(false);
  });

  it('toggleMode clears error', () => {
    component.error = 'some error';
    component.toggleMode();
    expect(component.error).toBe('');
  });

  // --- googleLogin ---

  it('googleLogin delegates to AuthService', () => {
    component.googleLogin();
    expect(authService.loginWithGoogle).toHaveBeenCalled();
  });

  // --- submitLogin ---

  it('submitLogin sets error when fields are empty', () => {
    component.loginEmail = '';
    component.loginPassword = '';
    component.submitLogin();
    expect(component.error).toBe('Please fill in all fields.');
  });

  it('submitLogin calls auth.login on valid input', () => {
    authService.login.mockReturnValue(of({ token: 'jwt', user: {} as any }));
    component.loginEmail = 'a@b.com';
    component.loginPassword = 'pass';
    component.submitLogin();

    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'pass');
    expect(component.isLoading).toBe(false);
  });

  it('submitLogin sets error on failure', () => {
    authService.login.mockReturnValue(throwError(() => ({ error: { error: 'Bad creds' } })));
    component.loginEmail = 'a@b.com';
    component.loginPassword = 'pass';
    component.submitLogin();

    expect(component.error).toBe('Bad creds');
    expect(component.isLoading).toBe(false);
  });

  // --- submitSignup ---

  it('submitSignup sets error when fields are empty', () => {
    component.isSignup = true;
    component.firstName = '';
    component.submitSignup();
    expect(component.error).toBe('Please fill in all fields.');
  });

  it('submitSignup sets error when passwords do not match', () => {
    component.isSignup = true;
    component.firstName = 'A';
    component.lastName = 'B';
    component.signupEmail = 'x@y.com';
    component.signupPassword = 'pass123';
    component.confirmPassword = 'pass456';
    component.submitSignup();
    expect(component.error).toBe('Passwords do not match.');
  });

  it('submitSignup sets error when password is too short', () => {
    component.isSignup = true;
    component.firstName = 'A';
    component.lastName = 'B';
    component.signupEmail = 'x@y.com';
    component.signupPassword = '123';
    component.confirmPassword = '123';
    component.submitSignup();
    expect(component.error).toBe('Password must be at least 6 characters.');
  });

  it('submitSignup calls auth.signup on valid input', () => {
    authService.signup.mockReturnValue(of({ token: 'jwt', user: {} as any }));
    component.isSignup = true;
    component.firstName = 'A';
    component.lastName = 'B';
    component.signupEmail = 'x@y.com';
    component.signupPassword = 'secret123';
    component.confirmPassword = 'secret123';
    component.submitSignup();

    expect(authService.signup).toHaveBeenCalledWith('A', 'B', 'x@y.com', 'secret123');
    expect(component.isLoading).toBe(false);
  });

  it('submitSignup sets error on failure', () => {
    authService.signup.mockReturnValue(throwError(() => ({ error: { error: 'Email taken' } })));
    component.isSignup = true;
    component.firstName = 'A';
    component.lastName = 'B';
    component.signupEmail = 'x@y.com';
    component.signupPassword = 'secret123';
    component.confirmPassword = 'secret123';
    component.submitSignup();

    expect(component.error).toBe('Email taken');
  });

  // --- navigation on user emission ---

  it('navigates to /home when user is emitted', () => {
    userSubject.next({ id: '1', name: 'Test' });
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
