import { Routes } from '@angular/router';
import { authGuard } from './shared/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'landing-page' },
  {
    path: 'landing-page',
    loadComponent: () =>
      import('./landing-page/landing-page').then((m) => m.LandingPage),
  },
  {
    path: 'data-owner-workspace',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./data-owner-workspace/data-owner-workspace').then(
        (m) => m.DataOwnerWorkspace,
      ),
  },
  {
    path: 'decrypt-result-workspace',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./decrypt-result-workspace/decrypt-result-workspace').then(
        (m) => m.DecryptResultWorkspace,
      ),
  },
  {
    path: 'model-builder-studio',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./model-builder-studio/model-builder-studio').then(
        (m) => m.ModelBuilderStudio,
      ),
  },
];
