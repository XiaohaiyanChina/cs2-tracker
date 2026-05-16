const ADMIN_PASSWORD = 'cs2admin2024';

const AUTH_KEY = 'cs2_tracker_auth';

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

export function login(password: string): boolean {
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}
