import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const publicCall = /\/auth\/otp\//.test(req.url);

  return from(auth.getIdTokenFresh()).pipe(
    switchMap((token) => {
      const authed =
        token && !publicCall
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req;

      return next(authed).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status !== 401 || publicCall || req.headers.has('X-Auth-Retry')) {
            return throwError(() => error);
          }

          return from(auth.getIdTokenFresh(true)).pipe(
            switchMap((fresh) => {
              if (!fresh) {
                void auth.logout().then(() => {
                  if (!router.url.startsWith('/login')) {
                    void router.navigateByUrl('/login');
                  }
                });
                return throwError(() => error);
              }

              const retry = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${fresh}`,
                  'X-Auth-Retry': '1',
                },
              });

              return next(retry).pipe(
                catchError((retryErr: HttpErrorResponse) => {
                  if (retryErr.status === 401) {
                    void auth.logout().then(() => {
                      if (!router.url.startsWith('/login')) {
                        void router.navigateByUrl('/login');
                      }
                    });
                  }
                  return throwError(() => retryErr);
                }),
              );
            }),
          );
        }),
      );
    }),
  );
};
