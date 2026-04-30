import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { provideRouter, Router } from '@angular/router';
import { FeedComponent } from './feed.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { Post } from '../../models/post.model';
import { vi } from 'vitest';

describe('FeedComponent', () => {
  let component: FeedComponent;
  let fixture: ComponentFixture<FeedComponent>;
  let postService: {
    getPosts: ReturnType<typeof vi.fn>;
    getLikeStatus: ReturnType<typeof vi.fn>;
    toggleLike: ReturnType<typeof vi.fn>;
    getFollowStatus: ReturnType<typeof vi.fn>;
    toggleFollow: ReturnType<typeof vi.fn>;
    getFollowCounts: ReturnType<typeof vi.fn>;
    followCountRefresh$: Subject<void>;
  };
  let userSubject: BehaviorSubject<any>;
  let router: Router;

  const fakePosts: Post[] = [
    { id: 'p1', userId: 'u1', title: 'A', content: 'body', authorName: 'Author', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'p2', userId: 'u2', title: 'B', content: 'body2', authorName: 'Other', authorPicture: '', createdAt: '2026-01-02T00:00:00Z' },
  ];

  beforeEach(async () => {
    postService = {
      getPosts: vi.fn().mockReturnValue(of(fakePosts)),
      getLikeStatus: vi.fn().mockReturnValue(of({ liked: false, like_count: 0 })),
      toggleLike: vi.fn().mockReturnValue(of({ liked: true, like_count: 1 })),
      getFollowStatus: vi.fn().mockReturnValue(of({ following: false, follower_count: 0, following_count: 0 })),
      toggleFollow: vi.fn().mockReturnValue(of({ following: true, follower_count: 1, following_count: 0 })),
      getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 0, following_count: 0 })),
      followCountRefresh$: new Subject<void>(),
    };
    userSubject = new BehaviorSubject<any>({ id: 'u1', name: 'Me' });

    const authStub = {
      user$: userSubject.asObservable(),
      isLoggedIn: () => true,
      getUser: () => userSubject.value,
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [FeedComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PostService, useValue: postService },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads all posts on init including current user own posts', () => {
    expect(postService.getPosts).toHaveBeenCalled();
    // Sprint 4: feed shows ALL posts, not filtered by current user
    expect(component.posts.length).toBe(2);
  });

  it('sets loading to false after posts load', () => {
    expect(component.loading).toBe(false);
  });

  it('sets error on load failure', async () => {
    postService.getPosts.mockReturnValue(throwError(() => new Error('fail')));

    // Re-create component so ngOnInit fires again with the error
    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error).toBe('Unable to load posts. Please try again.');
    expect(component.loading).toBe(false);
  });

  it('loads like status for all posts including current user posts', () => {
    expect(postService.getLikeStatus).toHaveBeenCalledWith('p1');
    expect(postService.getLikeStatus).toHaveBeenCalledWith('p2');
  });

  it('openPost navigates to /post/:id', () => {
    component.openPost('p2');
    expect(router.navigate).toHaveBeenCalledWith(['/post', 'p2']);
  });

  it('toggleLike updates likeMap', () => {
    const event = { stopPropagation: vi.fn() } as any;
    component.toggleLike(event, 'p2');
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(postService.toggleLike).toHaveBeenCalledWith('p2');
    expect(component.isLiked('p2')).toBe(true);
    expect(component.getLikeCount('p2')).toBe(1);
  });

  it('getLikeCount returns 0 for unknown post', () => {
    expect(component.getLikeCount('unknown')).toBe(0);
  });

  it('isLiked returns false for unknown post', () => {
    expect(component.isLiked('unknown')).toBe(false);
  });

  // --- Follow ---

  it('loads follow status for all post authors', () => {
    expect(postService.getFollowStatus).toHaveBeenCalledWith('u1');
    expect(postService.getFollowStatus).toHaveBeenCalledWith('u2');
  });

  it('isFollowing returns false for unfollowed user', () => {
    expect(component.isFollowing('u2')).toBe(false);
  });

  it('isFollowing returns false for unknown user', () => {
    expect(component.isFollowing('unknown')).toBe(false);
  });

  it('toggleFollow updates followMap', () => {
    const event = { stopPropagation: vi.fn() } as any;
    component.toggleFollow(event, 'u2');
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(postService.toggleFollow).toHaveBeenCalledWith('u2');
    expect(component.isFollowing('u2')).toBe(true);
  });

  // --- Sprint 4: image thumbnails & all-posts feed ---

  it('includes posts with imageUrl in the feed', () => {
    const postsWithImage: Post[] = [
      { id: 'p3', userId: 'u3', title: 'With Image', content: 'body', authorName: 'Author', authorPicture: '', createdAt: '2026-01-01T00:00:00Z', imageUrl: '/uploads/img.jpg' },
    ];
    postService.getPosts.mockReturnValue(of(postsWithImage));

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.posts[0].imageUrl).toBe('/uploads/img.jpg');
  });

  it('includes posts without imageUrl in the feed', () => {
    const postsNoImage: Post[] = [
      { id: 'p4', userId: 'u4', title: 'No Image', content: 'body', authorName: 'Author', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
    ];
    postService.getPosts.mockReturnValue(of(postsNoImage));

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.posts[0].imageUrl).toBeUndefined();
  });

  it('shows own posts in feed (no self-filtering)', () => {
    // u1 is the logged-in user; both posts are returned
    expect(component.posts.some((p) => p.userId === 'u1')).toBe(true);
  });
});
