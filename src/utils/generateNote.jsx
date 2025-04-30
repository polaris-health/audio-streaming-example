export async function generateNote(payload) {
    const endpoint = 'http://localhost/api/v1/generate-soap-note';
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        // Tell the server we’re sending JSON
        "Content-Type": "application/json",
        // Standard HTTP auth header
        "Authorization": `Bearer ${import.meta.env.VITE_TOKEN}`
      },
      body: JSON.stringify(payload)
    });
  
    if (!response.ok) {
      // Surface a helpful error if the call failed
      const msg = await response.text();
      throw new Error(`Request failed (${response.status}): ${msg}`);
    }
  
    return response.json();           // Parsed JSON body
  }