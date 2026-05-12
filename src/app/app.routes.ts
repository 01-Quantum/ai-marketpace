import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'landing-page' },
  {
    path: 'landing-page',
    loadComponent: () =>
      import('./landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: 'data-owner-workspace',
    loadComponent: () =>
      import('./data-owner-workspace/data-owner-workspace').then(
        (m) => m.DataOwnerWorkspace,
      ),
  },
];
