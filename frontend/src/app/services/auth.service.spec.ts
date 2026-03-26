import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { vi } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- isLoggedIn ---

  it('isLoggedIn returns false when no token in localStorage', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  it('isLoggedIn returns true when token exists', () => {
    localStorage.setItem('token', 'some-jwt');
    expect(service.isLoggedIn()).toBe(true);
  });

  // --- getUser ---

  it('getUser returns null initially', () => {
    expect(service.getUser()).toBeNull();
  });

  // --- login ---

  it('login stores token and emits user', () => {
    const fakeResponse = {
      token: 'jwt-123',
      user: { id: '1', google_id: '', email: 'a@b.com', name: 'Test', first_name: 'T', last_name: 'U', picture: '' },
    };

    let emittedUser: any;
    service.user$.subscribe((u) => (emittedUser = u));

    service.login('a@b.com', 'pass').subscribe();

    const req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'pass' });
    req.flush(fakeResponse);

    expect(localStorage.getItem('token')).toBe('jwt-123');
    expect(emittedUser?.email).toBe('a@b.com');
  });

  // --- signup ---

  it('signup stores token and emits user', () => {
    const fakeResponse = {
      token: 'jwt-456',
      user: { id: '2', google_id: '', email: 'b@c.com', name: 'New User', first_name: 'New', last_name: 'User', picture: '' },
    };

    service.signup('New', 'User', 'b@c.com', 'secret').subscribe();

    const req = httpTesting.expectOne('/api/auth/signup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ first_name: 'New', last_name: 'User', email: 'b@c.com', password: 'secret' });
    req.flush(fakeResponse);

    expect(localStorage.getItem('token')).toBe('jwt-456');
    expect(service.getUser()?.name).toBe('New User');
  });

  // --- logout ---

  it('logout clears token, emits null, and navigates to /login', () => {
    localStorage.setItem('token', 'jwt');
    service.logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(service.getUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  // --- loadUser ---

  it('loadUser fetches /api/me and emits user', () => {
    localStorage.setItem('token', 'jwt-789');
    service.loadUser();

    const req = httpTesting.expectOne('/api/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-789');
    req.flush({ id: '3', google_id: '', email: 'c@d.com', name: 'Loaded', first_name: 'L', last_name: 'U', picture: '' });

    expect(service.getUser()?.email).toBe('c@d.com');
  });

  it('loadUser calls logout on error', () => {
    localStorage.setItem('token', 'bad-jwt');
    const logoutSpy = vi.spyOn(service, 'logout');
    service.loadUser();

    const req = httpTesting.expectOne('/api/me');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(logoutSpy).toHaveBeenCalled();
  });

  // --- handleAuthCallback ---

  it('handleAuthCallback stores token from query param and loads user', () => {
    // Simulate ?token=callback-jwt in the URL
    const originalSearch = window.location.search;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '?token=callback-jwt', pathname: '/login', assign: vi.fn() },
    });
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

    service.handleAuthCallback();

    expect(localStorage.getItem('token')).toBe('callback-jwt');
    expect(replaceStateSpy).toHaveBeenCalled();

    // loadUser fires a /api/me request
    const req = httpTesting.expectOne('/api/me');
    req.flush({ id: '5', google_id: 'g1', email: 'cb@test.com', name: 'CB User', first_name: 'CB', last_name: 'User', picture: '' });

    expect(service.getUser()?.email).toBe('cb@test.com');

    replaceStateSpy.mockRestore();
  });

  it('handleAuthCallback does nothing when no token param present', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '', pathname: '/login' },
    });

    service.handleAuthCallback();

    expect(localStorage.getItem('token')).toBeNull();
  });

  // --- loginWithGoogle ---

  it('loginWithGoogle is a callable method', () => {
    expect(typeof service.loginWithGoogle).toBe('function');
  });
});
