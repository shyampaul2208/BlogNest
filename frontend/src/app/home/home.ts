import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../auth';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  user: User | null = null;
  activeTab: string = 'home';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      this.user = user;
      if (!user) {
        this.router.navigate(['/login']);
      }
    });
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    // TODO: Implement tab switching logic
  }

  logout() {
    this.authService.logout();
  }

  createPost() {
    // TODO: Navigate to create post page
    alert('Create post functionality coming soon!');
  }
}
