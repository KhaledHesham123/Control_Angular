import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-control-shell',
  standalone: false,
  templateUrl: './control-shell.html',
  styleUrl: './control-shell.css',
})
export class ControlShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  mobileOpen = false;

  readonly session = this.auth.session;
  readonly displayName = computed(() => {
    const session = this.session();
    return session?.fullName?.trim() || session?.email || 'User';
  });
  readonly vesselName = computed(() => this.session()?.vessel?.name ?? null);

  toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
  }

  closeMobile(): void {
    this.mobileOpen = false;
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
