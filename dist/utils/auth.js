import { getAuth } from "@clerk/express";
export const getAuthContext = (req) => {
    const auth = getAuth(req);
    const userId = "userId" in auth && auth.userId ? auth.userId : undefined;
    const sessionId = "sessionId" in auth && auth.sessionId ? auth.sessionId : undefined;
    return {
        userId,
        sessionId,
        isAuthenticated: Boolean(userId),
    };
};
