import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/** Blocks unauthenticated access; only landing-page is public. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.initialized).pipe(
    filter(Boolean),
    take(1),
    map(() => (auth.isAuthenticated() ? true : router.createUrlTree(['/landing-page']))),
  );
};
