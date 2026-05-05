import { getAuth } from "@clerk/express";

type AuthContext = {
  userId?: string;
  sessionId?: string;
  isAuthenticated: boolean;
};

export const getAuthContext = (req: unknown): AuthContext => {
  const auth = getAuth(req as never);
  const userId = "userId" in auth && auth.userId ? auth.userId : undefined;
  const sessionId = "sessionId" in auth && auth.sessionId ? auth.sessionId : undefined;

  return {
    userId,
    sessionId,
    isAuthenticated: Boolean(userId),
  };
};
