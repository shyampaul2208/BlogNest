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
