import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, of, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { PostService } from '../../services/post.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent implements OnDestroy {
  query = '';
  users: any[] = [];
  searching = false;
  searched = false;

  private searchSubject = new Subject<string>();
  private sub: Subscription;

  constructor(
    private postService: PostService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.sub = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim()) {
            this.users = [];
            this.searched = false;
            this.searching = false;
            this.cdr.detectChanges();
            return EMPTY;
          }
          this.searching = true;
          this.cdr.detectChanges();
          return this.postService.searchUsers(q.trim()).pipe(
            catchError(() => of([]))
          );
        }),
      )
      .subscribe((users) => {
        if (Array.isArray(users)) {
          this.users = users;
        }
        this.searching = false;
        this.searched = true;
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onQueryChange(): void {
    this.searchSubject.next(this.query);
  }

  viewUser(userId: string): void {
    this.router.navigate(['/user', userId]);
  }
}
