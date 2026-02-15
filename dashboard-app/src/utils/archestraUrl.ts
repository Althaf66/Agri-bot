/**
 * Builds Archestra chat URL with role-based API key selection
 */
export function buildArchestraUrl(
  userId: string,
  userRole?: 'farmer' | 'trader'
): string {
  const baseUrl = import.meta.env.VITE_ARCHESTRA_URL;
  const agentId = import.meta.env.VITE_ARCHESTRA_AGENT_ID;

  // Select API key based on role
  const apiKey = userRole === 'trader'
    ? import.meta.env.VITE_ARCHESTRA_TRADER_API_KEY
    : import.meta.env.VITE_ARCHESTRA_API_KEY;

  // Build user prompt (same format for both roles)
  const userPrompt = encodeURIComponent(`I am ${userId}.`);

  // Construct URL with API key parameter
  return `${baseUrl}/chat/new?agent_id=${agentId}&api_key=${apiKey}&user_prompt=${userPrompt}`;
}

/**
 * Gets user role from localStorage
 */
export function getUserRole(): 'farmer' | 'trader' | undefined {
  try {
    const storedFarmer = localStorage.getItem('farmer');
    if (!storedFarmer) return undefined;

    const user = JSON.parse(storedFarmer);
    return user.role as 'farmer' | 'trader' | undefined;
  } catch {
    return undefined;
  }
}
