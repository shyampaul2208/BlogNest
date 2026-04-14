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

  // --- Sprint 3: getPost ---

  it('getPost sends GET /api/posts/:id and normalizes wrapped response', () => {
    const raw = {
      post: { id: 'p1', user_id: 'u1', user: { id: 'u1', name: 'Me' }, title: 'Single', content: 'Body', CreatedAt: '2026-01-01T00:00:00Z' },
      comment_count: 3,
      like_count: 5,
    };

    let result: any;
    service.getPost('p1').subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts/p1');
    expect(req.request.method).toBe('GET');
    req.flush(raw);

    expect(result.id).toBe('p1');
    expect(result.title).toBe('Single');
    expect(result.authorName).toBe('Me');
  });

  // --- Sprint 3: updatePost ---

  it('updatePost sends PUT /api/posts/:id with title and content', () => {
    const raw = { id: 'p1', user_id: 'u1', user: { id: 'u1', name: 'Me' }, title: 'Updated', content: 'New body', createdAt: '2026-03-25T00:00:00Z' };

    let result: any;
    service.updatePost('p1', 'Updated', 'New body').subscribe((p) => (result = p));

    const req = httpTesting.expectOne('/api/posts/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: 'Updated', content: 'New body' });
    req.flush(raw);

    expect(result?.title).toBe('Updated');
  });

  // --- Sprint 3: deletePost ---

  it('deletePost sends DELETE /api/posts/:id', () => {
    let result: any;
    service.deletePost('p1').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/posts/p1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Post deleted' });

    expect(result.message).toBe('Post deleted');
  });

  // --- Sprint 3: getComments ---

  it('getComments sends GET /api/posts/:id/comments', () => {
    const comments = [{ id: 'c1', post_id: 'p1', user_id: 'u1', content: 'Nice', CreatedAt: '2026-01-01T00:00:00Z' }];

    let result: any;
    service.getComments('p1').subscribe((c) => (result = c));

    const req = httpTesting.expectOne('/api/posts/p1/comments');
    expect(req.request.method).toBe('GET');
    req.flush(comments);

    expect(result.length).toBe(1);
    expect(result[0].content).toBe('Nice');
  });

  it('getComments handles null as empty array', () => {
    let result: any;
    service.getComments('p1').subscribe((c) => (result = c));

    const req = httpTesting.expectOne('/api/posts/p1/comments');
    req.flush(null);

    expect(result).toEqual([]);
  });

  // --- Sprint 3: createComment ---

  it('createComment sends POST /api/posts/:id/comments', () => {
    const comment = { id: 'c2', post_id: 'p1', user_id: 'u1', content: 'Great!', CreatedAt: '2026-01-01T00:00:00Z' };

    let result: any;
    service.createComment('p1', 'Great!').subscribe((c) => (result = c));

    const req = httpTesting.expectOne('/api/posts/p1/comments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'Great!' });
    req.flush(comment);

    expect(result.content).toBe('Great!');
  });

  // --- Sprint 3: deleteComment ---

  it('deleteComment sends DELETE /api/comments/:id', () => {
    let result: any;
    service.deleteComment('c1').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/comments/c1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Comment deleted' });

    expect(result.message).toBe('Comment deleted');
  });

  // --- Sprint 3: getLikeStatus ---

  it('getLikeStatus sends GET /api/posts/:id/like', () => {
    let result: any;
    service.getLikeStatus('p1').subscribe((s) => (result = s));

    const req = httpTesting.expectOne('/api/posts/p1/like');
    expect(req.request.method).toBe('GET');
    req.flush({ liked: true, like_count: 5 });

    expect(result.liked).toBe(true);
    expect(result.like_count).toBe(5);
  });

  // --- Sprint 3: toggleLike ---

  it('toggleLike sends POST /api/posts/:id/like', () => {
    let result: any;
    service.toggleLike('p1').subscribe((s) => (result = s));

    const req = httpTesting.expectOne('/api/posts/p1/like');
    expect(req.request.method).toBe('POST');
    req.flush({ liked: true, like_count: 1 });

    expect(result.liked).toBe(true);
    expect(result.like_count).toBe(1);
  });

  // --- Users / Search ---

  it('searchUsers sends GET /api/users/search?q=query with auth header', () => {
    const fakeUsers = [{ id: 'u1', name: 'Alice', email: 'alice@test.com' }];

    let result: any;
    service.searchUsers('alice').subscribe((u) => (result = u));

    const req = httpTesting.expectOne((r) => r.url === '/api/users/search' && r.params.get('q') === 'alice');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush(fakeUsers);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Alice');
  });

  it('searchUsers handles null response as empty array', () => {
    let result: any;
    service.searchUsers('nobody').subscribe((u) => (result = u));

    const req = httpTesting.expectOne((r) => r.url === '/api/users/search');
    req.flush(null);

    expect(result).toEqual([]);
  });

  it('getUserPosts sends GET /api/users/:id/posts and normalizes posts', () => {
    const rawResponse = {
      user: { id: 'u2', name: 'Bob', email: 'bob@test.com' },
      posts: [
        { id: 'p10', user_id: 'u2', user: { id: 'u2', name: 'Bob' }, title: 'Post', content: 'Body', createdAt: '2026-01-01T00:00:00Z' },
      ],
    };

    let result: any;
    service.getUserPosts('u2').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/users/u2/posts');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush(rawResponse);

    expect(result.user.name).toBe('Bob');
    expect(result.posts.length).toBe(1);
    expect(result.posts[0].id).toBe('p10');
    expect(result.posts[0].authorName).toBe('Bob');
  });

  it('getUserPosts handles null posts as empty array', () => {
    let result: any;
    service.getUserPosts('u2').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/users/u2/posts');
    req.flush({ user: { id: 'u2', name: 'Bob' }, posts: null });

    expect(result.posts).toEqual([]);
  });

  // --- Follow ---

  it('toggleFollow sends POST /api/users/:id/follow with auth header', () => {
    const followRes = { following: true, follower_count: 1, following_count: 0 };
    let result: any;
    service.toggleFollow('u2').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/users/u2/follow');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush(followRes);

    expect(result.following).toBe(true);
    expect(result.follower_count).toBe(1);
  });

  it('getFollowStatus sends GET /api/users/:id/follow-status with auth header', () => {
    const statusRes = { following: false, follower_count: 5, following_count: 3 };
    let result: any;
    service.getFollowStatus('u2').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/users/u2/follow-status');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush(statusRes);

    expect(result.following).toBe(false);
    expect(result.follower_count).toBe(5);
  });

  it('getFollowCounts sends GET /api/users/:id/counts with auth header', () => {
    const countsRes = { follower_count: 10, following_count: 7 };
    let result: any;
    service.getFollowCounts('u2').subscribe((r) => (result = r));

    const req = httpTesting.expectOne('/api/users/u2/counts');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    req.flush(countsRes);

    expect(result.follower_count).toBe(10);
    expect(result.following_count).toBe(7);
  });
});
