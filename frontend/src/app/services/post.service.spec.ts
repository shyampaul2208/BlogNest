import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PostService } from './post.service';
import { Post } from '../models/post.model';

describe('PostService', () => {
  let service: PostService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-jwt');

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PostService);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- getPosts ---

  it('getPosts sends GET /api/posts with auth header and normalizes response', () => {
    const raw = [
      {
        ID: 'p1',
        UserID: 'u1',
        User: { ID: 'u1', Name: 'Author', Picture: 'pic.jpg' },
        Title: 'Post 1',
        Content: 'Body 1',
        CreatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    let result: Post[] = [];
    service.getPosts().subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush(raw);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].title).toBe('Post 1');
    expect(result[0].authorName).toBe('Author');
  });

  it('getPosts handles null response as empty array', () => {
    let result: Post[] | undefined;
    service.getPosts().subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts');
    req.flush(null);

    expect(result).toEqual([]);
  });

  // --- getMyPosts ---

  it('getMyPosts sends GET /api/my-posts with auth header', () => {
    let result: Post[] = [];
    service.getMyPosts().subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/my-posts');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush([]);

    expect(result).toEqual([]);
  });

  // --- createPost ---

  it('createPost sends POST /api/posts with title and content', () => {
    const raw = {
      id: 'p2',
      user_id: 'u1',
      user: { id: 'u1', name: 'Me', picture: '' },
      title: 'New Post',
      content: 'New Body',
      createdAt: '2026-03-25T00:00:00Z',
    };

    let result: Post | undefined;
    service.createPost('New Post', 'New Body').subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'New Post', content: 'New Body' });
    req.flush(raw);

    expect(result?.id).toBe('p2');
    expect(result?.title).toBe('New Post');
    expect(result?.authorName).toBe('Me');
  });

  // --- normalize edge cases ---

  it('normalize handles lowercase field names', () => {
    const raw = [
      {
        id: 'p3',
        user_id: 'u2',
        user: { id: 'u2', name: 'Lower', picture: 'low.jpg' },
        title: 'Lower',
        content: 'Lower body',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    let result: Post[] = [];
    service.getPosts().subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts');
    req.flush(raw);

    expect(result[0].authorName).toBe('Lower');
    expect(result[0].authorPicture).toBe('low.jpg');
  });

  it('normalize defaults authorName to Unknown when no user', () => {
    const raw = [{ ID: 'p4', Title: 'Orphan', Content: 'No user', CreatedAt: '2026-01-01T00:00:00Z' }];

    let result: Post[] = [];
    service.getPosts().subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts');
    req.flush(raw);

    expect(result[0].authorName).toBe('Unknown');
    expect(result[0].authorPicture).toBe('');
  });

  // --- authHeaders without token ---

  it('sends no Authorization header when token is absent', () => {
    localStorage.removeItem('token');

    service.getPosts().subscribe();

    const req = httpTesting.expectOne('/api/posts');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });
});
