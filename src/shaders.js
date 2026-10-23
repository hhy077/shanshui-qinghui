export const vertexShader = `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;

export const paperFragment = `
precision highp float;
varying vec2 vUv;
void main(){
  vec2 coarse=floor(vUv*vec2(1500.0,900.0));
  vec2 fine=floor(vUv*vec2(3200.0,1900.0));
  float grain=fract(sin(dot(coarse,vec2(12.9898,78.233)))*43758.5453);
  float fibre=fract(sin(dot(fine,vec2(31.17,11.73)))*17943.17);
  float edge=pow(clamp(distance(vUv,vec2(.5))*1.35,0.0,1.0),2.2);
  float alpha=clamp(.017+(grain-.5)*.018+(fibre-.5)*.008+edge*.022,.006,.065);
  gl_FragColor=vec4(vec3(.31,.27,.19),alpha);
}
`;
export const waterFragment = `
precision highp float;
uniform sampler2D uArt;
uniform sampler2D uMask;
uniform sampler2D uReflection;
uniform float uTime;
uniform vec4 uRipples[12];
varying vec2 vUv;
void main(){
  float mask=texture2D(uMask,vUv).r;
  if(mask<0.005)discard;
  vec2 flow=vec2(sin(vUv.y*370.0+uTime*.61)*.00042+sin(vUv.y*147.0-uTime*.32)*.00055,
    sin(vUv.y*220.0+vUv.x*8.0+uTime*.4)*.00020);
  float ringInk=0.0;
  for(int i=0;i<12;i++){
    vec4 r=uRipples[i];float age=uTime-r.z;
    if(age>=0.0&&age<5.5){
      vec2 d=(vUv-r.xy)*vec2(16.0,25.0);
      float dist=length(d),radius=age*.49;
      float envelope=exp(-pow((dist-radius)*8.0,2.0))*exp(-age*.62)*r.w*smoothstep(0.0,.14,age);
      float wave=sin((dist-radius)*47.0);
      flow+=normalize(d+vec2(.0001))*envelope*wave*.0018;
      ringInk+=envelope*wave*.048;
    }
  }
  vec2 distorted=vUv+flow*mask;
  vec3 paper=texture2D(uArt,distorted).rgb;
  vec4 reflection=texture2D(uReflection,distorted+vec2(flow.x*1.8,0.0));
  vec3 color=mix(paper,reflection.rgb,reflection.a*.7);
  float grain=fract(sin(dot(floor(vUv*vec2(2560.,1440.)),vec2(12.9898,78.233)))*43758.5453);
  color-=ringInk*(.6+grain*.4);
  gl_FragColor=vec4(color,mask);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
