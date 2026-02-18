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
  UpdatedAt?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: string; // ISO string
  imageUrl?: string;
}
