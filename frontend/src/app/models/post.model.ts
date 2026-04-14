export interface RawPostUser {
  ID?: string;
  id?: string;
  Name?: string;
  name?: string;
  Picture?: string;
  picture?: string;
  Email?: string;
  email?: string;
}

export interface RawPost {
  ID?: string;
  id?: string;
  UserID?: string;
  user_id?: string;
  User?: RawPostUser;
  user?: RawPostUser;
  Title?: string;
  title?: string;
  Content?: string;
  content?: string;
  ImageURL?: string;
  image_url?: string;
  CreatedAt?: string;
  createdAt?: string;
}

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  authorName: string;
  authorPicture: string;
  createdAt: string;
  imageUrl?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  user?: RawPostUser;
  CreatedAt?: string;
}

export interface LikeStatus {
  liked: boolean;
  like_count: number;
}

export interface FollowStatus {
  following: boolean;
  follower_count: number;
  following_count: number;
}

export interface FollowUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}
