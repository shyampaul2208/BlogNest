import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.router.navigate(['/home']);
      }
    });
    this.authService.handleAuthCallback();
  }

  login() {
    this.authService.loginWithGoogle();
  }
}
