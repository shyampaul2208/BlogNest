import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Home } from './home/home';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'home', component: Home }
];
