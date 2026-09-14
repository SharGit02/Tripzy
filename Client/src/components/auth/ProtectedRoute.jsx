import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchCurrentUser, request } from "../../lib/authApi";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    const authCheck = async () => {
      // 1. Check if we are returning from an OAuth flow with an exchange token
      const urlParams = new URLSearchParams(window.location.search);
      const exchangeToken = urlParams.get("exchange_token");

      if (exchangeToken) {
        try {
          await request("/auth/oauth/exchange", {
            method: "POST",
            body: JSON.stringify({ token: exchangeToken }),
          });
          // Remove the token from the URL so it's not visible/shared
          window.history.replaceState({}, document.title, window.location.pathname);
          if (isMounted) setStatus("authenticated");
          return;
        } catch (error) {
          console.error("OAuth token exchange failed:", error);
          // Fall through to normal auth check if it fails
        }
      }

      // 2. Normal auth check
      try {
        await fetchCurrentUser();
        if (isMounted) setStatus("authenticated");
      } catch (error) {
        if (isMounted) setStatus("unauthenticated");
      }
    };

    authCheck();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/?auth=login" replace />;
  }

  return children;
}
