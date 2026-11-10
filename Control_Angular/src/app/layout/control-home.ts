import { Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

interface ControlModule {
  title: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-control-home',
  standalone: false,
  templateUrl: './control-home.html',
  styleUrl: './control-home.css',
})
export class ControlHome implements OnInit {
  private readonly title = inject(Title);
  private readonly router = inject(Router);

  readonly modules: ControlModule[] = [
    {
      title: 'Product Management',
      description: 'View products, details, edit, and delete.',
      route: '/products',
    },
    {
      title: 'Vessel Management',
      description: 'View vessels, details, create, edit, delete, and link users.',
      route: '/vessels',
    },
  ];

  ngOnInit(): void {
    this.title.setTitle('Control Center | Ships Control');
  }

  open(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
