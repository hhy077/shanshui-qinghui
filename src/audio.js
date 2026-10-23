// All sound is synthesized locally. No network requests, microphone or audio files.
export class Soundscape {
  constructor(){ this.enabled=false; this.context=null; this.calls=0; this.nextBird=0; }
  async toggle(){
    if(!this.context) this.init();
    await this.context.resume();
    this.enabled=!this.enabled;
    const t=this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    // Keep the soundscape comfortably below the artwork; the fade avoids an abrupt swell.
    this.master.gain.setTargetAtTime(this.enabled ? .22 : 0,t,1.1);
    return this.enabled;
  }
  init(){
    const AudioContext=window.AudioContext || window.webkitAudioContext;
    if(!AudioContext) throw new Error('此浏览器暂不支持自然声音');
    this.context=new AudioContext(); const c=this.context;
    this.master=c.createGain(); this.master.gain.value=0;
    const compressor=c.createDynamicsCompressor(); compressor.threshold.value=-20; compressor.ratio.value=3;
    this.meter=c.createAnalyser();this.meter.fftSize=256;
    this.master.connect(this.meter).connect(compressor).connect(c.destination);
    const buffer=c.createBuffer(1,c.sampleRate*8,c.sampleRate); const a=buffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<a.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;a[i]=brown*2.4;}
    this.noise=buffer;
    // Remove the low rumble that made the old continuous wind sound like a loud whoosh.
    // A restrained, slowly shifting filtered bed leaves room for water and bird cues.
    for(const [frequency,gain,rate] of [[520,.07,.055],[1250,.016,.083]]){
      const n=c.createBufferSource(); n.buffer=buffer;n.loop=true;
      const high=c.createBiquadFilter();high.type='highpass';high.frequency.value=190;high.Q.value=.55;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;
      const level=c.createGain();level.gain.value=gain*.42;
      n.connect(high).connect(filter).connect(level).connect(this.master);n.start();
      const lfo=c.createOscillator();lfo.frequency.value=rate;
      const depth=c.createGain();depth.gain.value=gain*.32;lfo.connect(depth).connect(level.gain);lfo.start();
    }
  }
  chirp(intensity=.7){
    if(!this.enabled)return;this.calls++;
    const c=this.context,t=c.currentTime;
    for(let i=0;i<2;i++){
      const osc=c.createOscillator(),g=c.createGain();osc.type='sine';
      const start=t+i*.23;osc.frequency.setValueAtTime(1850+i*330,start);osc.frequency.exponentialRampToValueAtTime(2850,start+.075);osc.frequency.exponentialRampToValueAtTime(2000,start+.18);
      g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.012*intensity,start+.045);g.gain.exponentialRampToValueAtTime(.0001,start+.24);
      osc.connect(g).connect(this.master);osc.start(start);osc.stop(start+.24);
    }
  }
  water(strength=.7){
    if(!this.enabled)return;
    const c=this.context,t=c.currentTime,osc=c.createOscillator(),g=c.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(520,t);osc.frequency.exponentialRampToValueAtTime(140,t+.2);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.011*strength,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.52);
    osc.connect(g).connect(this.master);osc.start();osc.stop(t+.5);
  }
  flap(strength=.6){
    if(!this.enabled)return;
    const c=this.context,t=c.currentTime,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    n.buffer=this.noise;f.type='bandpass';f.frequency.value=650;f.Q.value=.7;
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.035*strength,t+.07);g.gain.exponentialRampToValueAtTime(.0001,t+.3);
    n.connect(f).connect(g).connect(this.master);n.start(t,Math.random()*5,.3);
  }
  update(time){ if(this.enabled&&time>this.nextBird){this.chirp(.3);this.nextBird=time+22+Math.random()*20;} }
  rms(){if(!this.meter)return 0;const data=new Float32Array(256);this.meter.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);}
  peak(){if(!this.meter)return 0;const data=new Float32Array(256);this.meter.getFloatTimeDomainData(data);return data.reduce((peak,x)=>Math.max(peak,Math.abs(x)),0);}
}
