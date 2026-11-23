import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
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

  menuOpen = false;
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );
  readonly shipWorkspace = computed(() => this.url().startsWith('/ship'));

  readonly session = this.auth.session;
  readonly displayName = computed(() => {
    const session = this.session();
    return session?.fullName?.trim() || session?.email || 'User';
  });
  readonly vesselName = computed(() => this.session()?.vessel?.name ?? null);

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
