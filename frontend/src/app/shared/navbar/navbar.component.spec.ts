import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let userSubject: BehaviorSubject<any>;
  let logoutFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    userSubject = new BehaviorSubject<any>(null);
    logoutFn = vi.fn();

    const authStub = {
      user$: userSubject.asObservable(),
      isLoggedIn: () => false,
      logout: logoutFn,
    };

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('user is null initially', () => {
    expect(component.user).toBeNull();
  });

  it('updates user when user$ emits', () => {
    const fakeUser = { id: '1', name: 'Test', email: 'a@b.com', picture: '' };
    userSubject.next(fakeUser);
    expect(component.user).toEqual(fakeUser);
  });

  it('logout delegates to AuthService.logout', () => {
    component.logout();
    expect(logoutFn).toHaveBeenCalled();
  });
});
