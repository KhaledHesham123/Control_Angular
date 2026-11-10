import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly title = inject(Title);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  email = '';
  password = '';
  rememberMe = true;

  ngOnInit(): void {
    this.title.setTitle('Login | Ships Control');
  }

  submit(): void {
    this.error.set(null);

    if (!this.email.trim() || !this.password) {
      this.error.set('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    this.loading.set(true);

    this.auth
      .login({
        email: this.email.trim(),
        password: this.password,
        rememberMe: this.rememberMe,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          if (!result.succeeded || !result.data) {
            this.error.set(result.messages?.join(' ') || 'تعذر تسجيل الدخول.');
            return;
          }

          void this.router.navigateByUrl('/');
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.readError(err));
        },
      });
  }

  private readError(err: HttpErrorResponse): string {
    const payload = err.error as
      | { messages?: string[]; title?: string; detail?: string }
      | string
      | null;

    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      if (payload.messages?.length) {
        return payload.messages.join(' ');
      }
      if (payload.detail) {
        return payload.detail;
      }
      if (payload.title) {
        return payload.title;
      }
    }

    return 'تعذر تسجيل الدخول. حاول مرة أخرى.';
  }
}
