const API =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:5000";

export async function ensureStarterTokens(accessToken) {
  if (!accessToken) return false;

  try {
    const response = await fetch(`${API}/api/tokens/balance`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.warn("Starter token bootstrap failed:", error?.message || error);
    return false;
  }
}
