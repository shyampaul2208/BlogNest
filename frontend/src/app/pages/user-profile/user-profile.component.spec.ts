import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { UserProfileComponent } from './user-profile.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('UserProfileComponent', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;
  let postService: {
    getUserPosts: ReturnType<typeof vi.fn>;
    getLikeStatus: ReturnType<typeof vi.fn>;
    getFollowStatus: ReturnType<typeof vi.fn>;
    getFollowCounts: ReturnType<typeof vi.fn>;
    toggleFollow: ReturnType<typeof vi.fn>;
    getFollowers: ReturnType<typeof vi.fn>;
    getFollowing: ReturnType<typeof vi.fn>;
    followCountRefresh$: Subject<void>;
  };
  let router: Router;

  const fakeUser = { id: 'u2', name: 'Bob', email: 'bob@test.com', picture: 'bob.jpg' };
  const fakePosts = [
    { id: 'p1', userId: 'u2', title: 'Post 1', content: 'Body 1', authorName: 'Bob', authorPicture: 'bob.jpg', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'p2', userId: 'u2', title: 'Post 2', content: 'Body 2', authorName: 'Bob', authorPicture: 'bob.jpg', createdAt: '2026-01-02T00:00:00Z' },
  ];

  beforeEach(async () => {
    postService = {
      getUserPosts: vi.fn().mockReturnValue(of({ user: fakeUser, posts: fakePosts })),
      getLikeStatus: vi.fn().mockReturnValue(of({ liked: false, like_count: 3 })),
      getFollowStatus: vi.fn().mockReturnValue(of({ following: false, follower_count: 5, following_count: 2 })),
      getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 5, following_count: 2 })),
      toggleFollow: vi.fn().mockReturnValue(of({ following: true, follower_count: 6, following_count: 2 })),
      getFollowers: vi.fn().mockReturnValue(of([])),
      getFollowing: vi.fn().mockReturnValue(of([])),
      followCountRefresh$: new Subject<void>(),
    };

    const activatedRouteStub = {
      snapshot: { paramMap: { get: (key: string) => 'u2' } },
    };

    const authStub = {
      user$: of({ id: 'u1', name: 'Me' }),
      isLoggedIn: () => true,
      getUser: () => ({ id: 'u1', name: 'Me' }),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PostService, useValue: postService },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads user and posts on init', () => {
    expect(postService.getUserPosts).toHaveBeenCalledWith('u2');
    expect(component.user).toEqual(fakeUser);
    expect(component.posts.length).toBe(2);
    expect(component.loading).toBe(false);
  });

  it('loads like status for each post', () => {
    expect(postService.getLikeStatus).toHaveBeenCalledTimes(2);
    expect(postService.getLikeStatus).toHaveBeenCalledWith('p1');
    expect(postService.getLikeStatus).toHaveBeenCalledWith('p2');
  });

  it('getLikeCount returns count from likeMap', () => {
    expect(component.getLikeCount('p1')).toBe(3);
  });

  it('getLikeCount returns 0 for unknown post', () => {
    expect(component.getLikeCount('unknown')).toBe(0);
  });

  it('openPost navigates to /post/:id', () => {
    component.openPost('p1');
    expect(router.navigate).toHaveBeenCalledWith(['/post', 'p1']);
  });

  it('goBack navigates to /search', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/search']);
  });

  it('sets error on 404', async () => {
    postService.getUserPosts.mockReturnValue(throwError(() => ({ status: 404 })));

    // Re-create component
    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error).toBe('User not found.');
    expect(component.loading).toBe(false);
  });

  it('sets generic error on failure', async () => {
    postService.getUserPosts.mockReturnValue(throwError(() => ({ status: 500 })));

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error).toBe('Failed to load user profile.');
    expect(component.loading).toBe(false);
  });

  // --- Follow ---

  it('sets isOwnProfile to false for other user profile', () => {
    expect(component.isOwnProfile).toBe(false);
  });

  it('loads follow status for other user profile', () => {
    expect(postService.getFollowStatus).toHaveBeenCalledWith('u2');
    expect(component.followStatus).toBeTruthy();
    expect(component.followStatus!.following).toBe(false);
    expect(component.followStatus!.follower_count).toBe(5);
  });

  it('toggleFollow updates followStatus', () => {
    component.toggleFollow();
    expect(postService.toggleFollow).toHaveBeenCalledWith('u2');
    expect(component.followStatus!.following).toBe(true);
    expect(component.followStatus!.follower_count).toBe(6);
  });

  it('toggleFollow does nothing for own profile', () => {
    component.isOwnProfile = true;
    component.toggleFollow();
    expect(postService.toggleFollow).not.toHaveBeenCalled();
  });
});
