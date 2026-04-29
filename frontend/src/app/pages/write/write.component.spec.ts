import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { WriteComponent } from './write.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('WriteComponent', () => {
  let component: WriteComponent;
  let fixture: ComponentFixture<WriteComponent>;
  let postService: { createPost: ReturnType<typeof vi.fn>; getFollowCounts: ReturnType<typeof vi.fn>; followCountRefresh$: Subject<void> };
  let router: Router;

  beforeEach(async () => {
    postService = { createPost: vi.fn(), getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 0, following_count: 0 })), followCountRefresh$: new Subject<void>() };

    const authStub = {
      user$: new BehaviorSubject(null).asObservable(),
      isLoggedIn: () => true,
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WriteComponent],
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

    fixture = TestBed.createComponent(WriteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- publish validation ---

  it('publish sets error when title is empty', () => {
    component.title = '';
    component.content = 'Some content';
    component.publish();
    expect(component.error).toBe('Title and content are required.');
  });

  it('publish sets error when content is empty', () => {
    component.title = 'Title';
    component.content = '   ';
    component.publish();
    expect(component.error).toBe('Title and content are required.');
  });

  // --- publish success ---

  it('publish calls createPost and navigates to /home on success', () => {
    postService.createPost.mockReturnValue(of({} as any));
    component.title = 'My Title';
    component.content = 'My Content';
    component.publish();

    expect(postService.createPost).toHaveBeenCalledWith('My Title', 'My Content');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(component.publishing).toBe(false);
  });

  // --- publish failure ---

  it('publish sets error on failure', () => {
    postService.createPost.mockReturnValue(throwError(() => ({ error: { error: 'Server error' } })));
    component.title = 'Title';
    component.content = 'Content';
    component.publish();

    expect(component.error).toBe('Server error');
    expect(component.publishing).toBe(false);
  });

  // --- cancel ---

  it('cancel navigates to /home', () => {
    component.cancel();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
