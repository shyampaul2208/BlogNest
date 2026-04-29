import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../services/auth.service';
import { PostService } from '../../services/post.service';
import { vi } from 'vitest';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let userSubject: BehaviorSubject<any>;
  let logoutFn: ReturnType<typeof vi.fn>;
  let postServiceStub: {
    getFollowCounts: ReturnType<typeof vi.fn>;
    getFollowers: ReturnType<typeof vi.fn>;
    getFollowing: ReturnType<typeof vi.fn>;
    followCountRefresh$: Subject<void>;
  };

  beforeEach(async () => {
    userSubject = new BehaviorSubject<any>(null);
    logoutFn = vi.fn();

    const authStub = {
      user$: userSubject.asObservable(),
      isLoggedIn: () => false,
      logout: logoutFn,
    };

    postServiceStub = {
      getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 10, following_count: 4 })),
      getFollowers: vi.fn().mockReturnValue(of([])),
      getFollowing: vi.fn().mockReturnValue(of([])),
      followCountRefresh$: new Subject<void>(),
    };

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: PostService, useValue: postServiceStub },
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

  it('loads follow counts when user is set', () => {
    const fakeUser = { id: '1', name: 'Test', email: 'a@b.com', picture: '' };
    userSubject.next(fakeUser);
    expect(postServiceStub.getFollowCounts).toHaveBeenCalledWith('1');
    expect(component.followerCount).toBe(10);
    expect(component.followingCount).toBe(4);
  });

  it('does not load follow counts when user is null', () => {
    expect(postServiceStub.getFollowCounts).not.toHaveBeenCalled();
  });
});
