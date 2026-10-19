/** Who is using the app, as the shell needs it. Built from `useSession()` in StudentApp. */
export interface ShellAccount {
  isAuthenticated: boolean;
  name?: string;
  email?: string;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** "Jordan Reyes" -> "JR"; "jr@uni.edu" -> "J"; nothing -> "?" */
export const initialsFor = (name?: string, email?: string): string => {
  const source = (name || email || '').trim();
  if (!source) {
    return '?';
  }
  if (!name) {
    return source[0].toUpperCase();
  }
  const words = source.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0][0];
  return letters.toUpperCase();
};
