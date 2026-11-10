import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../core/api.config';
import { Result } from '../core/api.model';
import { AuthSession, LoginCommand, LoginResponseDto } from './auth.model';

const STORAGE_KEY = 'ships-control.auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => {
    const session = this.sessionSignal();
    return !!session?.accessToken && !this.isExpired(session);
  });

  login(command: LoginCommand): Observable<Result<LoginResponseDto>> {
    return this.http
      .post<Result<LoginResponseDto>>(`${API_BASE_URL}/Auth/Login`, command)
      .pipe(
        tap((result) => {
          if (result.succeeded && result.data) {
            this.persistSession(result.data, command.rememberMe);
          }
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    this.sessionSignal.set(null);
  }

  getAccessToken(): string | null {
    const session = this.sessionSignal();
    if (!session || this.isExpired(session)) {
      return null;
    }
    return session.accessToken;
  }

  private persistSession(data: LoginResponseDto, rememberMe: boolean): void {
    const session: AuthSession = {
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      accessToken: data.token.accessToken,
      refreshToken: data.token.refreshToken,
      expires: data.token.expires,
      rememberMe,
      vessel: data.vessel ?? null,
    };

    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  private readStoredSession(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      if (!session?.accessToken || this.isExpired(session)) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private isExpired(session: AuthSession): boolean {
    const expires = new Date(session.expires).getTime();
    if (Number.isNaN(expires)) {
      return false;
    }
    return expires <= Date.now();
  }
}
