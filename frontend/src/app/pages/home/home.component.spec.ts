import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { Post } from '../../models/post.model';
import { vi, type Mock } from 'vitest';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let postService: { getMyPosts: ReturnType<typeof vi.fn>; getPosts: ReturnType<typeof vi.fn> };
  let router: Router;
  let userSubject: BehaviorSubject<any>;

  const myPosts: Post[] = [
    { id: 'p1', userId: 'u1', title: 'Mine', content: 'body', authorName: 'Me', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
  ];

  beforeEach(async () => {
    postService = { getMyPosts: vi.fn().mockReturnValue(of(myPosts)), getPosts: vi.fn() };
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
});
