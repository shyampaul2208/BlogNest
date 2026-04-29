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
  let postService: { createPost: ReturnType<typeof vi.fn>; uploadImage: ReturnType<typeof vi.fn>; getFollowCounts: ReturnType<typeof vi.fn>; followCountRefresh$: Subject<void> };
  let router: Router;

  beforeEach(async () => {
    postService = { createPost: vi.fn(), uploadImage: vi.fn(), getFollowCounts: vi.fn().mockReturnValue(of({ follower_count: 0, following_count: 0 })), followCountRefresh$: new Subject<void>() };

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

  it('publish calls createPost with undefined imageUrl and navigates to /home on success', () => {
    postService.createPost.mockReturnValue(of({} as any));
    component.title = 'My Title';
    component.content = 'My Content';
    component.publish();

    expect(postService.createPost).toHaveBeenCalledWith('My Title', 'My Content', undefined);
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

  // --- Sprint 4: image upload ---

  it('onFileSelected sets selectedFile and imagePreview for a valid image', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as any;
    component.onFileSelected(event);

    expect(component.selectedFile).toBe(file);
    expect(component.uploadError).toBe('');
  });

  it('onFileSelected sets uploadError for an invalid file type', () => {
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    const event = { target: { files: [file] } } as any;
    component.onFileSelected(event);

    expect(component.selectedFile).toBeNull();
    expect(component.uploadError).toBeTruthy();
  });

  it('onFileSelected sets uploadError when file exceeds 5 MB', () => {
    const bigContent = new Uint8Array(6 * 1024 * 1024);
    const file = new File([bigContent], 'big.png', { type: 'image/png' });
    const event = { target: { files: [file] } } as any;
    component.onFileSelected(event);

    expect(component.selectedFile).toBeNull();
    expect(component.uploadError).toBe('Image too large (max 5MB).');
  });

  it('removeImage clears selectedFile, imagePreview, and uploadError', () => {
    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    component.selectedFile = file;
    component.imagePreview = 'data:image/jpeg;base64,abc';
    component.uploadError = 'some error';

    component.removeImage();

    expect(component.selectedFile).toBeNull();
    expect(component.imagePreview).toBeNull();
    expect(component.uploadError).toBe('');
  });

  it('publish uploads image then calls createPost with returned URL when file is selected', () => {
    postService.uploadImage.mockReturnValue(of({ url: '/uploads/uuid.jpg' }));
    postService.createPost.mockReturnValue(of({} as any));

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    component.selectedFile = file;
    component.title = 'Title';
    component.content = 'Content';
    component.publish();

    expect(postService.uploadImage).toHaveBeenCalledWith(file);
    expect(postService.createPost).toHaveBeenCalledWith('Title', 'Content', '/uploads/uuid.jpg');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('publish calls createPost with undefined when no file is selected', () => {
    postService.createPost.mockReturnValue(of({} as any));
    component.selectedFile = null;
    component.title = 'Title';
    component.content = 'Content';
    component.publish();

    expect(postService.uploadImage).not.toHaveBeenCalled();
    expect(postService.createPost).toHaveBeenCalledWith('Title', 'Content', undefined);
  });

  it('publish sets error when uploadImage fails', () => {
    postService.uploadImage.mockReturnValue(throwError(() => ({ error: { error: 'Upload failed' } })));

    const file = new File(['x'], 'x.jpg', { type: 'image/jpeg' });
    component.selectedFile = file;
    component.title = 'Title';
    component.content = 'Content';
    component.publish();

    expect(component.error).toBe('Upload failed');
    expect(component.publishing).toBe(false);
  });
});
