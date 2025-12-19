/**
 * RTVI Voice Chat Service
 * 
 * Provides WebRTC-based real-time voice interaction with Pipecat servers.
 * Implements the RTVI (Real-Time Voice Interface) protocol for seamless
 * voice chat that integrates with Open WebUI's chat history.
 */

export interface RTVIConfig {
  /** WebRTC server URL (e.g., "http://localhost:7860") */
  serverUrl: string;
  /** Enable microphone input */
  enableMic?: boolean;
  /** Enable camera input (optional) */
  enableCam?: boolean;
}

export interface RTVICallbacks {
  /** Called when user transcript is received */
  onUserTranscript?: (text: string, final: boolean) => void;
  /** Called when bot transcript chunk is received */
  onBotTranscript?: (text: string) => void;
  /** Called when bot starts speaking */
  onBotStartedSpeaking?: () => void;
  /** Called when bot stops speaking */
  onBotStoppedSpeaking?: () => void;
  /** Called when user starts speaking */
  onUserStartedSpeaking?: () => void;
  /** Called when user stops speaking */
  onUserStoppedSpeaking?: () => void;
  /** Called on connection state change */
  onConnectionStateChange?: (state: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/** RTVI message types from the server */
type RTVIMessageType = 
  | 'user-transcription'
  | 'bot-llm-text' 
  | 'bot-llm-started'
  | 'bot-llm-stopped'
  | 'bot-tts-text'
  | 'bot-tts-started'
  | 'bot-tts-stopped'
  | 'user-started-speaking'
  | 'user-stopped-speaking'
  | 'bot-started-speaking'
  | 'bot-stopped-speaking'
  | 'error';

interface RTVIMessage {
  type: RTVIMessageType;
  data?: {
    text?: string;
    final?: boolean;
    error?: string;
  };
}

/**
 * Direct WebRTC implementation for RTVI protocol.
 * Uses native WebRTC APIs without external transport dependencies.
 */
export class RTVIVoiceService {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private sessionId: string | null = null;
  private serverUrl: string = '';
  private callbacks: RTVICallbacks = {};
  private _connected: boolean = false;
  private accumulatedBotText: string = '';

  /** Whether the service is currently connected */
  get connected(): boolean {
    return this._connected;
  }

  /**
   * Connect to the RTVI server and establish WebRTC connection.
   */
  async connect(config: RTVIConfig, callbacks: RTVICallbacks = {}): Promise<void> {
    this.serverUrl = config.serverUrl;
    this.callbacks = callbacks;
    this.accumulatedBotText = '';

    try {
      // 1. Create session via /start endpoint
      console.log('[RTVI] Creating session...');
      const startResponse = await fetch(`${this.serverUrl}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableDefaultIceServers: true })
      });

      if (!startResponse.ok) {
        throw new Error(`Failed to create session: ${startResponse.status}`);
      }

      const { sessionId, iceConfig } = await startResponse.json();
      this.sessionId = sessionId;
      console.log('[RTVI] Session created:', sessionId);

      // 2. Create PeerConnection with ICE servers
      const iceServers = iceConfig?.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' }
      ];
      
      this.pc = new RTCPeerConnection({ iceServers });
      this.setupPeerConnectionHandlers();

      // 3. Get local audio stream
      if (config.enableMic !== false) {
        console.log('[RTVI] Requesting microphone access...');
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: config.enableCam || false
        });

        // Add tracks to peer connection
        this.localStream.getTracks().forEach(track => {
          this.pc!.addTrack(track, this.localStream!);
        });
        console.log('[RTVI] Local audio track added');
      }

      // 4. Create and send offer
      console.log('[RTVI] Creating WebRTC offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 5. Send offer to server and get answer
      const offerResponse = await fetch(
        `${this.serverUrl}/sessions/${sessionId}/api/offer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type
          })
        }
      );

      if (!offerResponse.ok) {
        throw new Error(`Failed to send offer: ${offerResponse.status}`);
      }

      const answer = await offerResponse.json();
      console.log('[RTVI] Received answer, pc_id:', answer.pc_id);

      // 6. Set remote description
      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: answer.type,
        sdp: answer.sdp
      }));

      this._connected = true;
      this.callbacks.onConnectionStateChange?.('connected');
      console.log('[RTVI] WebRTC connection established');

    } catch (error) {
      console.error('[RTVI] Connection error:', error);
      this.callbacks.onError?.(error as Error);
      await this.disconnect();
      throw error;
    }
  }

  /**
   * Setup handlers for peer connection events.
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.pc) return;

    // Handle incoming audio track
    this.pc.ontrack = (event) => {
      console.log('[RTVI] Received remote track:', event.track.kind);
      if (event.track.kind === 'audio') {
        // Create audio element for playback
        this.remoteAudio = new Audio();
        this.remoteAudio.srcObject = event.streams[0];
        this.remoteAudio.autoplay = true;
        console.log('[RTVI] Remote audio playback started');
      }
    };

    // Handle data channel from server
    this.pc.ondatachannel = (event) => {
      console.log('[RTVI] Data channel received:', event.channel.label);
      this.dc = event.channel;
      this.setupDataChannelHandlers();
    };

    // Handle ICE connection state changes
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState || 'unknown';
      console.log('[RTVI] ICE connection state:', state);
      this.callbacks.onConnectionStateChange?.(state);
      
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this._connected = false;
      }
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState || 'unknown';
      console.log('[RTVI] Peer connection state:', state);
      
      if (state === 'connected') {
        this._connected = true;
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this._connected = false;
      }
    };

    // Handle ICE candidates (for PATCH endpoint)
    this.pc.onicecandidate = async (event) => {
      if (event.candidate && this.sessionId) {
        try {
          await fetch(
            `${this.serverUrl}/sessions/${this.sessionId}/api/offer`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ candidate: event.candidate })
            }
          );
        } catch (error) {
          console.warn('[RTVI] Failed to send ICE candidate:', error);
        }
      }
    };
  }

  /**
   * Setup handlers for RTVI data channel messages.
   */
  private setupDataChannelHandlers(): void {
    if (!this.dc) return;

    this.dc.onopen = () => {
      console.log('[RTVI] Data channel open');
      // Send client-ready message - required by Pipecat RTVI protocol
      this.sendClientReady();
    };

    this.dc.onclose = () => {
      console.log('[RTVI] Data channel closed');
    };

    this.dc.onmessage = (event) => {
      try {
        const message: RTVIMessage = JSON.parse(event.data);
        this.handleRTVIMessage(message);
      } catch (error) {
        console.warn('[RTVI] Failed to parse message:', event.data);
      }
    };
  }

  /**
   * Handle incoming RTVI protocol messages.
   */
  private handleRTVIMessage(message: RTVIMessage): void {
    console.log('[RTVI] Message:', message.type, message.data);

    switch (message.type) {
      case 'user-transcription':
        if (message.data?.text !== undefined) {
          this.callbacks.onUserTranscript?.(
            message.data.text,
            message.data.final ?? false
          );
        }
        break;

      case 'bot-llm-text':
      case 'bot-tts-text':
        if (message.data?.text !== undefined) {
          this.accumulatedBotText += message.data.text;
          this.callbacks.onBotTranscript?.(this.accumulatedBotText);
        }
        break;

      case 'bot-llm-started':
        this.accumulatedBotText = '';
        break;

      case 'bot-llm-stopped':
        // LLM finished generating, TTS may still be playing
        break;

      case 'bot-started-speaking':
      case 'bot-tts-started':
        this.callbacks.onBotStartedSpeaking?.();
        break;

      case 'bot-stopped-speaking':
      case 'bot-tts-stopped':
        this.callbacks.onBotStoppedSpeaking?.();
        break;

      case 'user-started-speaking':
        this.callbacks.onUserStartedSpeaking?.();
        break;

      case 'user-stopped-speaking':
        this.callbacks.onUserStoppedSpeaking?.();
        break;

      case 'error':
        if (message.data?.error) {
          this.callbacks.onError?.(new Error(message.data.error));
        }
        break;
    }
  }


  /**
   * Send client-ready message to server.
   * Required by Pipecat RTVI protocol to start processing.
   */
  private sendClientReady(): void {
    if (!this.dc || this.dc.readyState !== "open") {
      console.warn("[RTVI] Cannot send client-ready: data channel not open");
      return;
    }

    const clientReadyMessage = {
      label: "rtvi-ai",
      type: "client-ready",
      id: crypto.randomUUID().slice(0, 8),
      data: {
        version: "1.0.0",
      },
    };

    this.dc.send(JSON.stringify(clientReadyMessage));
    console.log("[RTVI] Sent client-ready message");
  }

  /**
   * Disconnect from the RTVI server and clean up resources.
   */
  async disconnect(): Promise<void> {
    console.log('[RTVI] Disconnecting...');

    // Stop local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Stop remote audio
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }

    // Close data channel
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this._connected = false;
    this.sessionId = null;
    this.accumulatedBotText = '';
    this.callbacks.onConnectionStateChange?.('disconnected');
    console.log('[RTVI] Disconnected');
  }

  /**
   * Mute/unmute the local microphone.
   */
  setMicMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      console.log('[RTVI] Mic', muted ? 'muted' : 'unmuted');
    }
  }

  /**
   * Check if microphone is currently muted.
   */
  get isMicMuted(): boolean {
    if (!this.localStream) return true;
    const audioTrack = this.localStream.getAudioTracks()[0];
    return audioTrack ? !audioTrack.enabled : true;
  }
}

/**
 * Create a singleton instance for easy access.
 */
let rtviInstance: RTVIVoiceService | null = null;

export function getRTVIService(): RTVIVoiceService {
  if (!rtviInstance) {
    rtviInstance = new RTVIVoiceService();
  }
  return rtviInstance;
}
