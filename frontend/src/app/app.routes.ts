import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { FeedComponent } from './pages/feed/feed.component';
import { WriteComponent } from './pages/write/write.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'feed', component: FeedComponent, canActivate: [authGuard] },
  { path: 'write', component: WriteComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/home' },
];
