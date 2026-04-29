import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, BehaviorSubject, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { PostDetailComponent } from './post-detail.component';
import { PostService } from '../../services/post.service';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('PostDetailComponent', () => {
  let component: PostDetailComponent;
  let fixture: ComponentFixture<PostDetailComponent>;
  let postService: any;
  let router: Router;
  let userSubject: BehaviorSubject<any>;

  const fakePost = {
    id: 'p1', userId: 'u1', title: 'Test Post', content: 'Test body',
    authorName: 'Author', authorPicture: '', createdAt: '2026-01-01T00:00:00Z',
  };
  const fakeComments = [
    { id: 'c1', post_id: 'p1', user_id: 'u1', content: 'Nice!', user: { name: 'Author' }, CreatedAt: '2026-01-01T00:00:00Z' },
  ];

  beforeEach(async () => {
    postService = {
      getPost: vi.fn().mockReturnValue(of(fakePost)),
      getPosts: vi.fn().mockReturnValue(of([fakePost])),
      getComments: vi.fn().mockReturnValue(of(fakeComments)),
      getLikeStatus: vi.fn().mockReturnValue(of({ liked: false, like_count: 2 })),
      toggleLike: vi.fn().mockReturnValue(of({ liked: true, like_count: 3 })),
      createComment: vi.fn().mockReturnValue(of({ id: 'c2', post_id: 'p1', user_id: 'u1', content: 'New', user: { name: 'Author' }, CreatedAt: '2026-01-02T00:00:00Z' })),
      deleteComment: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
      updatePost: vi.fn().mockReturnValue(of({ ...fakePost, title: 'Updated Title', content: 'Updated Content' })),
      deletePost: vi.fn().mockReturnValue(of({ message: 'Deleted' })),
      getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 0, following_count: 0 })),
      followCountRefresh$: new Subject<void>(),
    };
    userSubject = new BehaviorSubject<any>({ id: 'u1', name: 'Author' });

    const authStub = {
      user$: userSubject.asObservable(),
      isLoggedIn: () => true,
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PostDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PostService, useValue: postService },
        { provide: AuthService, useValue: authStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'p1' } } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(PostDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads post on init', () => {
    expect(postService.getPost).toHaveBeenCalledWith('p1');
    expect(component.post?.title).toBe('Test Post');
    expect(component.loading).toBe(false);
  });

  it('loads comments on init', () => {
    expect(postService.getComments).toHaveBeenCalledWith('p1');
    expect(component.comments.length).toBe(1);
  });

  it('loads like status on init', () => {
    expect(postService.getLikeStatus).toHaveBeenCalledWith('p1');
    expect(component.likeStatus.like_count).toBe(2);
  });

  it('toggleLike calls postService and updates status', () => {
    component.toggleLike();
    expect(postService.toggleLike).toHaveBeenCalledWith('p1');
    expect(component.likeStatus.liked).toBe(true);
    expect(component.likeStatus.like_count).toBe(3);
  });

  it('submitComment adds comment to list', () => {
    component.newComment = 'New';
    component.submitComment();
    expect(postService.createComment).toHaveBeenCalledWith('p1', 'New');
    expect(component.comments.length).toBe(2);
    expect(component.newComment).toBe('');
  });

  it('submitComment does nothing with empty text', () => {
    component.newComment = '   ';
    component.submitComment();
    expect(postService.createComment).not.toHaveBeenCalled();
  });

  it('removeComment calls deleteComment service', () => {
    component.removeComment('c1');
    expect(postService.deleteComment).toHaveBeenCalledWith('c1');
  });

  it('isOwner returns true when user matches post author', () => {
    expect(component.isOwner()).toBe(true);
  });

  it('isOwner returns false for different user', () => {
    userSubject.next({ id: 'u2', name: 'Other' });
    expect(component.isOwner()).toBe(false);
  });

  it('startEdit enters edit mode with current post values', () => {
    component.startEdit();
    expect(component.editing).toBe(true);
    expect(component.editTitle).toBe('Test Post');
    expect(component.editContent).toBe('Test body');
  });

  it('cancelEdit exits edit mode', () => {
    component.startEdit();
    component.cancelEdit();
    expect(component.editing).toBe(false);
  });

  it('saveEdit updates post and exits edit mode', () => {
    component.startEdit();
    component.editTitle = 'Updated Title';
    component.editContent = 'Updated Content';
    component.saveEdit();
    expect(postService.updatePost).toHaveBeenCalledWith('p1', 'Updated Title', 'Updated Content');
    expect(component.post?.title).toBe('Updated Title');
    expect(component.editing).toBe(false);
  });

  it('saveEdit sets error when title is empty', () => {
    component.startEdit();
    component.editTitle = '';
    component.editContent = 'Content';
    component.saveEdit();
    expect(component.editError).toBe('Title and content are required.');
    expect(postService.updatePost).not.toHaveBeenCalled();
  });

  it('confirmDelete calls deletePost and navigates home', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.confirmDelete();
    expect(postService.deletePost).toHaveBeenCalledWith('p1');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('confirmDelete does nothing when cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.confirmDelete();
    expect(postService.deletePost).not.toHaveBeenCalled();
  });

  it('getCommentAuthor returns author name', () => {
    const name = component.getCommentAuthor(fakeComments[0] as any);
    expect(name).toBe('Author');
  });

  it('getCommentAuthor returns Unknown for missing user', () => {
    expect(component.getCommentAuthor({ id: 'c', post_id: 'p', user_id: 'u', content: 'x' } as any)).toBe('Unknown');
  });

  it('goBack navigates to /feed', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/feed']);
  });

  it('sets error when post not found', () => {
    postService.getPost.mockReturnValue(throwError(() => ({ status: 404 })));
    fixture = TestBed.createComponent(PostDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.error).toBe('Post not found.');
  });

  it('sets error on load failure', () => {
    postService.getPost.mockReturnValue(throwError(() => ({ status: 500 })));
    fixture = TestBed.createComponent(PostDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.error).toBe('Failed to load post.');
  });
});
