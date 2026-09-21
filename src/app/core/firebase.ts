import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { environment } from '../../environments/environment';

const app = initializeApp(environment.firebase);

/**
 * Persist auth in IndexedDB/localStorage so the customer stays signed in
 * across browser restarts until they explicitly log out.
 * Firebase refresh tokens keep the session alive for months on the same browser.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialized (HMR / duplicate import)
    return getAuth(app);
  }
}

export const firebaseAuth = createAuth();
