import { useContext } from 'react';

// auth provider
import AudioStreamerContext from '../contexts/AudioStreamerContext';

// ==============================|| AUDIO STREAMER HOOK ||============================== //

const useAudioStreamer = () => {
  const context = useContext(AudioStreamerContext);

  if (!context) throw new Error('context must be used inside provider');

  return context;
};

export default useAudioStreamer;
