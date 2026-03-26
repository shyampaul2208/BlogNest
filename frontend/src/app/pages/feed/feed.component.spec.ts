import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { FeedComponent } from './feed.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { Post } from '../../models/post.model';
import { vi } from 'vitest';

describe('FeedComponent', () => {
  let component: FeedComponent;
  let fixture: ComponentFixture<FeedComponent>;
  let postService: { getPosts: ReturnType<typeof vi.fn> };
  let userSubject: BehaviorSubject<any>;

  const fakePosts: Post[] = [
    { id: 'p1', userId: 'u1', title: 'A', content: 'body', authorName: 'Author', authorPicture: '', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'p2', userId: 'u2', title: 'B', content: 'body2', authorName: 'Other', authorPicture: '', createdAt: '2026-01-02T00:00:00Z' },
  ];

  beforeEach(async () => {
    postService = { getPosts: vi.fn().mockReturnValue(of(fakePosts)) };
    userSubject = new BehaviorSubject<any>({ id: 'u1', name: 'Me' });

    const authStub = {
      user$: userSubject.asObservable(),
      isLoggedIn: () => true,
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

    fixture = TestBed.createComponent(FeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads posts on init and filters out current user posts', () => {
    expect(postService.getPosts).toHaveBeenCalled();
    // u1 is the current user, so only u2's post should remain
    expect(component.posts.length).toBe(1);
    expect(component.posts[0].userId).toBe('u2');
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
});
