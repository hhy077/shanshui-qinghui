import * as THREE from 'three';
const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
const ink=new THREE.MeshBasicMaterial({color:0x343a32,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false});
function oval(x,y,rx,ry,material){const m=new THREE.Mesh(new THREE.CircleGeometry(1,16),material);m.position.set(x,y,0);m.scale.set(rx,ry,1);return m;}
function taperedWing(material){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(9*2*3),indices=[];
  for(let i=0;i<8;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  return new THREE.Mesh(geometry,material);
}
function model(material){
  const g=new THREE.Group();
  g.add(oval(0,0,.65,.23,material),oval(.49,.22,.18,.19,material));
  const beak=new THREE.Shape();beak.moveTo(.59,.25);beak.lineTo(.94,.16);beak.lineTo(.59,.13);
  const tail=new THREE.Shape();tail.moveTo(-.42,.1);tail.lineTo(-1,.28);tail.lineTo(-.7,-.15);
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(beak),material),new THREE.Mesh(new THREE.ShapeGeometry(tail),material));
  const wings=[taperedWing(material),taperedWing(material)];wings.forEach(w=>g.add(w));
  g.userData.wings=wings;return g;
}
function pose(g,time,activity,phase){
  for(let side=0;side<2;side++){
    const positions=g.userData.wings[side].geometry.attributes.position;
    const beat=Math.sin(time*(activity>0 ? 7.7:1.2)+phase+side*.46);
    const shoulder=.22+beat*.7,tip=.18+Math.sin(time*7.7+phase+side*.46-.65)*1.6;
    for(let i=0;i<9;i++){
      const s=i/8,sign=side===0?1:-1;
      const x=-.04-s*.60+side*.16;
      const y=(.08+(1-s)*s*shoulder*2+s*s*tip)*activity;
      const spread=sign*s*(1.26*activity+.18);
      const width=(1-s)*.2*activity+.012;
      positions.setXYZ(i*2,x+spread,y+width,side*.004+.01);
      positions.setXYZ(i*2+1,x+spread,y-width,side*.004+.01);
    }
    positions.needsUpdate=true;
  }
}
export class Birds {
  constructor(scene,{ripple,sound}){
    this.scene=scene;this.ripple=ripple;this.sound=sound;this.time=0;
    // Fixed identities, permanent home coordinates. No birds are created by input.
    const homes=[[.39,.772],[.425,.787],[.46,.752],[.50,.785],[.535,.755],[.79,.715],[.82,.739],[.85,.717],[.89,.745]];
    this.water=homes.map(([u,v],i)=>{
      const material=ink.clone();const mesh=model(material),reflection=model(material.clone());scene.add(mesh,reflection);
      const b={id:i,home:{u,v},u,v,size:i<5?.112:.084,phase:i*1.72,start:Infinity,state:'rest',cycles:0,mesh,reflection,altitude:0,lastFlap:-1};
      return b;
    });
    this.sky=Array.from({length:5},(_,i)=>{const mesh=model(ink.clone());scene.add(mesh);return {id:i,mesh,phase:i*2.1};});
  }
  disturb(u,v,time){
    const candidates=this.water.filter(b=>b.state==='rest'&&Math.hypot((b.u-u)*16,(b.v-v)*9)<.72);
    if(!candidates.length)return 0;
    candidates.sort((a,b)=>Math.hypot(a.u-u,a.v-v)-Math.hypot(b.u-u,b.v-v));const nearest=candidates[0];
    const cluster=this.water.filter(b=>b.state==='rest'&&Math.hypot((b.u-nearest.u)*16,(b.v-nearest.v)*9)<1.3);
    for(const b of cluster){
      const d=Math.hypot((b.u-nearest.u)*16,(b.v-nearest.v)*9);
      b.start=time+d*.72;b.state='waiting';b.lastFlap=-1;
    }
    this.sound.chirp(.6);return cluster.length;
  }
  update(time){
    this.time=time;
    for(const b of this.water){
      const t=time-b.start;let excursion=0,altitude=0,activity=0;
      if(Number.isFinite(b.start)&&t>=0){
        if(t<.75){b.state='alert';activity=.2*smooth(0,.75,t);}
        else if(t<2.5){b.state='takeoff';activity=smooth(.75,1.2,t);}
        else if(t<9){b.state='flight';activity=1;}
        else if(t<12.8){b.state='landing';activity=1-smooth(11.5,12.8,t);}
        else{b.state='rest';b.start=Infinity;b.cycles++;this.ripple(b.home.u,b.home.v,.38);}
        if(t>=.75&&t<12.8){
          const p=(t-.75)/12.05;
          excursion=Math.sin(Math.PI*p)*(.8+.12*Math.sin(p*6.28+b.phase));
          altitude=Math.sin(Math.PI*p)*(.68+.07*Math.sin(p*8+b.phase));
          const flapIndex=Math.floor(t*2.1);
          if(t<3.3&&flapIndex!==b.lastFlap){this.sound.flap(.3);b.lastFlap=flapIndex;}
        }
      }
      b.u=b.home.u+excursion*.115;
      b.v=b.home.v-excursion*.025;
      b.altitude=altitude;
      const x=b.u*16,y=(1-b.v)*9;
      b.mesh.position.set(x,y+altitude+.007*Math.sin(time*.8+b.phase),.16);
      b.mesh.scale.set(b.size,b.size,1);
      b.mesh.rotation.z=activity*.09*Math.cos(time*.9+b.phase);
      pose(b.mesh,time,activity,b.phase);
      b.reflection.position.set(x,y-altitude*.60-.052,.12);
      b.reflection.scale.set(b.size,-b.size*.57,1);
      b.reflection.rotation.z=-b.mesh.rotation.z;
      b.reflection.children.forEach(m=>m.material.opacity=.15*(1-altitude*.6));
      pose(b.reflection,time,activity,b.phase);
    }
    for(const b of this.sky){
      const p=(time*.0036+b.id*.043)%1;
      b.mesh.position.set((.10+p*.72)*16, (1-(.28+Math.sin(time*.13+b.id)*.012+b.id*.012))*9,.14);
      b.mesh.scale.set(.075+b.id*.003,.075+b.id*.003,1);
      b.mesh.rotation.z=.07*Math.sin(time*.5+b.phase);
      b.mesh.children.forEach(m=>m.material.opacity=.52);
      pose(b.mesh,time*.67,1,b.phase);
    }
  }
  snapshot(){return this.water.map(b=>({id:b.id,state:b.state,u:b.u,v:b.v,home:{...b.home},altitude:b.altitude,cycles:b.cycles,start:Number.isFinite(b.start)?b.start:null}));}
}
