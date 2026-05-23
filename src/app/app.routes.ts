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
  {
    path: 'model-owner-workspace',
    loadComponent: () =>
      import('./model-owner-workspace/model-owner-workspace').then(
        (m) => m.ModelOwnerWorkspace,
      ),
  },
  {
    path: 'decrypt-result-workspace',
    loadComponent: () =>
      import('./decrypt-result-workspace/decrypt-result-workspace').then(
        (m) => m.DecryptResultWorkspace,
      ),
  },
  {
    path: 'model-builder-studio',
    loadComponent: () =>
      import('./model-builder-studio/model-builder-studio').then(
        (m) => m.ModelBuilderStudio,
      ),
  },
];
