# Audio Streaming Example
This repo contains a minimal example of how to stream WAV-encoded audio to the Cavell API for transcription.
Batteries are included:
- Recovery mechanism for disrupted connections
- Volume measurements to easily identify microphone issues
- State tracking to dynamically adjust the UI based on the state of the audio stream (active, inactive, finishing)

# Install instructions (npm)
```
npm install
```

Also, please include a valid token in `src/utils/getSocket.jsx` where indicated.

# Run development mode locally (npm)
```
npm run dev
```

# Dependencies
Several dependencies are required to make this example work:
`extendable-media-recorder`
`extendable-media-recorder-wav-encoder`
`socket.io-client`
