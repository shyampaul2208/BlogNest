import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { Post } from '../../models/post.model';
import { vi, type Mock } from 'vitest';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let postService: {
    getMyPosts: ReturnType<typeof vi.fn>;
    getPosts: ReturnType<typeof vi.fn>;
    getLikeStatus: ReturnType<typeof vi.fn>;
    deletePost: ReturnType<typeof vi.fn>;
    getFollowCounts: ReturnType<typeof vi.fn>;
    followCountRefresh$: Subject<void>;
  };
  let router: Router;
  let userSubject: BehaviorSubject<any>;

  const myPosts: Post[] = [
    { id: 'p1', userId: 'u1', title: 'Mine', content: 'body', authorName: 'Me', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
  ];

  beforeEach(async () => {
    postService = {
      getMyPosts: vi.fn().mockReturnValue(of(myPosts)),
      getPosts: vi.fn(),
      getLikeStatus: vi.fn().mockReturnValue(of({ liked: false, like_count: 3 })),
      deletePost: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
      getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 5, following_count: 2 })),
      followCountRefresh$: new Subject<void>(),
    };
    userSubject = new BehaviorSubject<any>({ id: 'u1', name: 'Me' });

    const authStub = {
      user$: userSubject.asObservable(),
      isLoggedIn: () => true,
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
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

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads my posts on init', () => {
    expect(postService.getMyPosts).toHaveBeenCalled();
    expect(component.myPosts.length).toBe(1);
    expect(component.myPosts[0].title).toBe('Mine');
  });

  it('sets loading to false after posts load', () => {
    expect(component.loading).toBe(false);
  });

  it('loads total likes count', () => {
    expect(postService.getLikeStatus).toHaveBeenCalledWith('p1');
    expect(component.totalLikes).toBe(3);
  });

  it('falls back to getPosts filtered by user on getMyPosts failure', () => {
    const allPosts: Post[] = [
      { id: 'p1', userId: 'u1', title: 'Mine', content: 'b', authorName: 'Me', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'p2', userId: 'u2', title: 'Other', content: 'b', authorName: 'X', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
    ];
    postService.getMyPosts.mockReturnValue(throwError(() => new Error('fail')));
    postService.getPosts.mockReturnValue(of(allPosts));

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(postService.getPosts).toHaveBeenCalled();
    expect(component.myPosts.length).toBe(1);
    expect(component.myPosts[0].userId).toBe('u1');
  });

  // --- openPost ---

  it('openPost navigates to /post/:id', () => {
    component.openPost('p1');
    expect(router.navigate).toHaveBeenCalledWith(['/post', 'p1']);
  });

  // --- deletePost ---

  it('deletePost removes post from list', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const event = { stopPropagation: vi.fn() } as any;
    component.deletePost(event, 'p1');
    expect(postService.deletePost).toHaveBeenCalledWith('p1');
    expect(component.myPosts.length).toBe(0);
  });

  it('deletePost does nothing when cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const event = { stopPropagation: vi.fn() } as any;
    component.deletePost(event, 'p1');
    expect(postService.deletePost).not.toHaveBeenCalled();
  });

  // --- goWrite ---

  it('goWrite navigates to /write', () => {
    component.goWrite();
    expect(router.navigate).toHaveBeenCalledWith(['/write']);
  });

  // --- goFeed ---

  it('goFeed navigates to /feed', () => {
    component.goFeed();
    expect(router.navigate).toHaveBeenCalledWith(['/feed']);
  });

  // --- Follow counts ---

  it('loads follower and following counts for current user', () => {
    expect(postService.getFollowCounts).toHaveBeenCalledWith('u1');
    expect(component.followerCount).toBe(5);
    expect(component.followingCount).toBe(2);
  });
});
