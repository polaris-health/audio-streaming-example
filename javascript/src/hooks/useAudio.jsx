import { useContext } from 'react';

// auth provider
import { AudioStateContext } from '../contexts/AudioContext';

// ==============================|| AUDIO HOOK ||============================== //

const useAudio = () => {
  const context = useContext(AudioStateContext);

  if (!context) throw new Error('context must be used inside provider');

  return context;
};

export default useAudio;
