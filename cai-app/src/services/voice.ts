/**
 * Voice Agent — microphone input + TTS output
 * Uses Web Speech API (SpeechRecognition + SpeechSynthesis)
 */

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
}

export type VoiceCallback = (transcript: string) => void;
export type VoiceStateCallback = (state: VoiceState) => void;

class VoiceAgent {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private onResult: VoiceCallback | null = null;
  private onStateChange: VoiceStateCallback | null = null;
  private state: VoiceState = { isListening: false, isSpeaking: false, transcript: "", error: null };
  private available = false;

  constructor() {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.recognition.maxAlternatives = 1;
      this.available = true;

      this.recognition.onresult = (event: any) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        this.state.transcript = final || interim;
        this.emit();
        if (final && this.onResult) this.onResult(final);
      };

      this.recognition.onerror = (event: any) => {
        this.state.error = event.error;
        this.state.isListening = false;
        this.emit();
      };

      this.recognition.onend = () => {
        this.state.isListening = false;
        this.emit();
      };
    }

    this.synthesis = typeof window !== "undefined" ? window.speechSynthesis : null;
  }

  private emit() {
    this.onStateChange?.({ ...this.state });
  }

  isAvailable(): boolean {
    return this.available;
  }

  startListening(onResult: VoiceCallback, onStateChange?: VoiceStateCallback): void {
    if (!this.recognition) return;
    this.onResult = onResult;
    this.onStateChange = onStateChange ?? this.onStateChange;
    this.state.error = null;
    this.state.isListening = true;
    this.state.transcript = "";
    this.emit();
    try { this.recognition.start(); } catch {}
  }

  stopListening(): void {
    if (!this.recognition) return;
    try { this.recognition.stop(); } catch {}
    this.state.isListening = false;
    this.emit();
  }

  speak(text: string, onDone?: () => void): void {
    if (!this.synthesis) { onDone?.(); return; }
    this.synthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    // Pick a good voice
    const voices = this.synthesis.getVoices();
    const preferred = voices.find((v) => v.name.includes("Google") && v.lang.startsWith("en"))
      || voices.find((v) => v.lang.startsWith("en") && v.localService)
      || voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;

    utter.onstart = () => { this.state.isSpeaking = true; this.emit(); };
    utter.onend = () => { this.state.isSpeaking = false; this.emit(); onDone?.(); };
    utter.onerror = () => { this.state.isSpeaking = false; this.emit(); onDone?.(); };
    this.synthesis.speak(utter);
  }

  stopSpeaking(): void {
    this.synthesis?.cancel();
    this.state.isSpeaking = false;
    this.emit();
  }

  getState(): VoiceState {
    return { ...this.state };
  }
}

export const voiceAgent = new VoiceAgent();
