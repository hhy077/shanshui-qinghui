// All sound is synthesized locally. No network requests, microphone or audio files.
export class Soundscape {
  constructor(){ this.enabled=false; this.context=null; this.calls=0; this.nextBird=0; }
  async toggle(){
    if(!this.context) this.init();
    await this.context.resume();
    this.enabled=!this.enabled;
    const t=this.context.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.enabled ? .42 : 0,t,.7);
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
    for(let i=0;i<a.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;a[i]=brown*4;}
    this.noise=buffer;
    for(const [frequency,gain,rate] of [[360,.25,.073],[1150,.07,.11]]){
      const n=c.createBufferSource(); n.buffer=buffer;n.loop=true;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;
      const level=c.createGain();level.gain.value=gain;
      n.connect(filter).connect(level).connect(this.master);n.start();
      const lfo=c.createOscillator();lfo.frequency.value=rate;
      const depth=c.createGain();depth.gain.value=gain*.35;lfo.connect(depth).connect(level.gain);lfo.start();
    }
  }
  chirp(intensity=.7){
    if(!this.enabled)return;this.calls++;
    const c=this.context,t=c.currentTime;
    for(let i=0;i<2;i++){
      const osc=c.createOscillator(),g=c.createGain();osc.type='sine';
      const start=t+i*.23;osc.frequency.setValueAtTime(1850+i*330,start);osc.frequency.exponentialRampToValueAtTime(2850,start+.075);osc.frequency.exponentialRampToValueAtTime(2000,start+.18);
      g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.027*intensity,start+.035);g.gain.exponentialRampToValueAtTime(.0001,start+.22);
      osc.connect(g).connect(this.master);osc.start(start);osc.stop(start+.24);
    }
  }
  water(strength=.7){
    if(!this.enabled)return;
    const c=this.context,t=c.currentTime,osc=c.createOscillator(),g=c.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(520,t);osc.frequency.exponentialRampToValueAtTime(140,t+.2);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.023*strength,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.45);
    osc.connect(g).connect(this.master);osc.start();osc.stop(t+.5);
  }
  flap(strength=.6){
    if(!this.enabled)return;
    const c=this.context,t=c.currentTime,n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    n.buffer=this.noise;f.type='bandpass';f.frequency.value=650;f.Q.value=.7;
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.09*strength,t+.05);g.gain.exponentialRampToValueAtTime(.0001,t+.24);
    n.connect(f).connect(g).connect(this.master);n.start(t,Math.random()*5,.3);
  }
  update(time){ if(this.enabled&&time>this.nextBird){this.chirp(.35);this.nextBird=time+13+Math.random()*15;} }
  rms(){if(!this.meter)return 0;const data=new Float32Array(256);this.meter.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);}
}
