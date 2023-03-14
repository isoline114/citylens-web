export type AuthUser = {
  id: string;
  email: string | null;
  displayName?: string | null;
};

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'unauthenticated'; user: null }
  | { status: 'authenticated'; user: AuthUser };

export type AuthActions = {
  signIn: (email?: string) => Promise<void> | void;
  signOut: () => Promise<void> | void;
  getAccessToken: (options?: {
    forceRefresh?: boolean;
  }) => Promise<string | null>;
};

export type AuthContextValue = AuthState & AuthActions;
