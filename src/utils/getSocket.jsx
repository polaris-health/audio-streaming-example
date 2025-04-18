import io from 'socket.io-client';

export function getSocket(){
  const token = 'your token here'; // Replace with your actual token
  const endpoint = 'wss://staging.corilus.cavell.app';
  const socket = io(endpoint, {
    path: "/api/v1/live-transcription/",
    transports: ["websocket"],
    autoConnect: false,
    auth: {
      // Make sure to get a new token at the start of each transcription session,
      // to avoid the token from expiring during the session.
      Authorization: `Bearer ${token}`,
    }
  });
  return socket;
}