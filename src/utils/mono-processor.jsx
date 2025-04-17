class MonoProcessor extends AudioWorkletProcessor {
    process(inputs, outputs) {
      // Only process the first input.
      const input = inputs[0];
  
      if (input.length > 0) {
        const channelCount = input.length;
        const inputLength = input[0].length;
        const outputBuffer = new Int16Array(inputLength);
  
        for (let i = 0; i < inputLength; i++) {
          let sum = 0;
          for (let channel = 0; channel < channelCount; channel++) {
            sum += input[channel][i];
          }
  
          // Average the sum to create mono output
          const monoValue = sum / channelCount;
  
          // Convert to PCM16 (Int16) from the float [-1, 1] range
          outputBuffer[i] = Math.max(-1, Math.min(1, monoValue)) * 0x7FFF;
        }
  
        // Send the PCM16 data to the main thread
        this.port.postMessage(outputBuffer);
      }
  
      return true;
    }
  }
  
  registerProcessor('mono-processor', MonoProcessor);