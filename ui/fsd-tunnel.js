/* <fsd-tunnel> — raw WebGL1 hyperspace tunnel behind the flight panel's jump
   sequence. Attributes: phase (off|charge|tunnel|arrival), variant
   (standard|neutron|critical), intensity (0..1), progress (0..1, charge only),
   rflash ("1" caps flashes). Zero deps; adaptive resolution keeps iPad-class
   GPUs at 60fps. Stays outside ui/src on purpose: it is a self-contained
   custom element in the same plain-script tier as hb.js. */
(function () {
  "use strict";
  if (customElements.get("fsd-tunnel")) return;

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "precision mediump float;",
    "uniform vec2 u_res;",
    "uniform float u_t,u_z,u_speed,u_cloud,u_streak,u_swirl,u_chroma,u_flash,u_star,u_field,u_expo;",
    "uniform vec3 u_tint,u_starCol;",
    "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}",
    "float fbm(vec2 p){float s=0.,a=.55;",
    " for(int i=0;i<3;i++){s+=a*n2(p);p=p*2.03+vec2(7.3,3.1);a*=.5;}return s;}",
    "float rfbm(vec2 p){float s=0.,a=.6;",
    " for(int i=0;i<3;i++){float n=1.-abs(2.*n2(p)-1.);s+=a*n*n;p=p*2.13+vec2(5.2,1.7);a*=.5;}return s;}",
    "float streakLayer(float sa,float depth,float zOff,float sectors,float thick,float lenBias){",
    " float sc=sa*sectors;float sid=floor(sc);float fa=fract(sc);",
    " float lane=h(vec2(sid,3.7));",
    " if(lane>.5)return 0.;",
    " float ph=h(vec2(sid,9.13));",
    " float sp=fract(depth*.32+zOff*1.5+ph*7.);",
    " float seg=smoothstep(0.,lenBias,sp)*(1.-smoothstep(.6,1.02,sp));",
    " float line=1.-smoothstep(0.,thick,abs(fa-.5));",
    " return line*seg;}",
    "void main(){",
    " vec2 uv=(gl_FragCoord.xy*2.-u_res)/u_res.y;",
    " float roll=u_z*.045;",
    " uv=mat2(cos(roll),-sin(roll),sin(roll),cos(roll))*uv;",
    " uv-=vec2(sin(u_z*.5+u_t*.1),cos(u_z*.37))*(.025+.025*u_swirl);",
    " float r=length(uv)+1e-4;",
    " float depth=1./r;",
    " float ang=atan(uv.y,uv.x);",
    " float tw1=ang+u_swirl*(depth*.5+u_z*.26);",
    " float tw2=ang-u_swirl*(depth*.22+u_z*.16)+2.1;",
    " vec2 dv=vec2(cos(tw1),sin(tw1));",
    " vec2 dv2=vec2(cos(tw2),sin(tw2));",
    " vec3 col=vec3(.006,.008,.014);",
    // sparse ridged plasma filaments over near-black walls, two parallax layers
    " float wall=smoothstep(.06,.7,r)*(1.-smoothstep(.8,2.9,r));",
    " float warp=fbm(dv*1.6+vec2(u_z*.4,depth*.6));",
    " float f1=rfbm(dv*2.6+vec2(warp*1.8,depth*1.35+u_z));",
    " float f2=rfbm(dv2*1.6+vec2(-warp*.9,depth*.7+u_z*.55));",
    " vec3 steel=mix(u_tint,vec3(.5,.56,.66),.55);",
    " col+=u_tint*pow(f1,3.2)*u_cloud*1.9*wall;",
    " col+=steel*pow(f2,2.4)*u_cloud*.5*wall;",
    " col+=u_tint*.3*pow(warp,2.)*u_cloud*wall*(1.-smoothstep(.5,1.4,r));",
    // event-horizon rim fringe
    " float rim=exp(-abs(r-.34)*9.)*u_cloud;",
    " col+=mix(u_tint,vec3(.9,.95,1.05),.35)*rim*.5;",
    // star streaks w/ cheap chroma split
    " float sa=ang/6.2831853+.5;",
    " float fade=smoothstep(.12,.4,r)*(1.-smoothstep(1.1,2.8,r));",
    " float thick=mix(.5,.38,clamp(u_speed,0.,1.));",
    " float lb=mix(.55,.34,clamp(u_speed,0.,1.));",
    " float co=u_chroma*.05;",
    " float sG=streakLayer(sa,depth,u_z,110.,thick,lb);",
    " float sR=streakLayer(sa,depth,u_z+co,110.,thick,lb);",
    " float sB=streakLayer(sa,depth,u_z-co,110.,thick,lb);",
    " float s2=streakLayer(sa+.5,depth*.55,u_z*1.35,64.,thick*1.6,lb*.8);",
    " float sb=(.1+.52*clamp(u_speed,0.,1.2))*u_streak*fade;",
    " vec3 sCol=mix(vec3(1.),u_tint*1.3,.62);",
    " col+=sCol*vec3(sR,sG,sB)*sb;",
    " col+=u_tint*s2*sb*.5;",
    // dark witch-core
    " col*=mix(1.,smoothstep(.06,.5,r),u_cloud*.95);",
    // destination star
    " if(u_star>.001){",
    "  float g=u_star*.05/(r*r+.004);",
    "  float spikes=u_star*.016/(abs(uv.x*uv.y)*38.+.012);",
    "  col+=u_starCol*(g+spikes*smoothstep(1.,0.,r));",
    "  col+=u_starCol*exp(-r*7.)*u_star*.8;}",
    // static starfield (normal space)
    " if(u_field>.001){",
    "  vec2 gp=uv*34.;vec2 gi=floor(gp);",
    "  float st=h(gi);vec2 sf=fract(gp)-vec2(h(gi+7.1),h(gi+3.3));",
    "  float pt=(1.-smoothstep(0.,.12,length(sf)))*step(.93,st);",
    "  col+=vec3(.85,.9,1.)*pt*u_field*(.4+.6*h(gi+1.7));}",
    // grade
    " col*=u_expo*(1.-.55*smoothstep(.8,1.7,r));",
    " col+=(h(gl_FragCoord.xy+fract(u_t)*61.)-.5)*.02;",
    " col=mix(col,vec3(.97,.985,1.),clamp(u_flash,0.,1.));",
    " col=col/(1.+col*.45);",
    " col=mix(col,col*col*(3.-2.*col),.4);",
    " gl_FragColor=vec4(col,1.);}",
  ].join("\n");

  var VARIANTS = {
    standard: { tint: [0.45, 0.6, 0.95], star: [1.0, 0.76, 0.42], speed: 1.0, swirl: 0.95, strobe: 0 },
    neutron: { tint: [0.3, 0.88, 1.05], star: [0.78, 0.92, 1.0], speed: 1.4, swirl: 1.35, strobe: 1 },
    critical: { tint: [1.0, 0.32, 0.24], star: [1.0, 0.45, 0.3], speed: 0.92, swirl: 0.8, strobe: 0 },
  };

  var KEYS = ["speed", "cloud", "streak", "swirl", "chroma", "star", "field", "expo"];
  var RATE = { speed: 2.6, cloud: 2.2, streak: 2.6, swirl: 2.0, chroma: 2.4, star: 1.9, field: 2.2, expo: 2.4 };

  class FsdTunnel extends HTMLElement {
    static get observedAttributes() {
      return ["phase", "variant", "intensity", "progress", "rflash"];
    }
    constructor() {
      super();
      this._cur = { speed: 0, cloud: 0, streak: 0, swirl: 0, chroma: 0, star: 0, field: 0.7, expo: 0.8 };
      this._tgt = Object.assign({}, this._cur);
      this._z = 0;
      this._dir = 1;
      this._flash = 0;
      this._phase = "off";
      this._variant = VARIANTS.standard;
      this._intensity = 0.85;
      this._progress = 0;
      this._rflash = false;
      this._phaseT = 0;
      this._timeline = [];
      this._raf = 0;
      this._last = 0;
      this._scale = 1;
      this._dtAvg = 16;
      this._frames = 0;
      this._strobeAt = 0;
      this._reduced =
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    connectedCallback() {
      if (this._canvas) {
        this._syncSize();
        this._ensureLoop();
        return;
      }
      this.style.display = "block";
      this.style.position = "absolute";
      this.style.inset = "0";
      this.style.width = "100%";
      this.style.height = "100%";
      var c = document.createElement("canvas");
      c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
      this.appendChild(c);
      this._canvas = c;
      var gl = c.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      if (!gl) return;
      this._gl = gl;
      var prog = gl.createProgram();
      var vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, VERT);
      gl.compileShader(vs);
      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, FRAG);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
        console.error("fsd-tunnel shader:", gl.getShaderInfoLog(fs));
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this._u = {};
      var names = ["u_res", "u_t", "u_z", "u_speed", "u_cloud", "u_streak", "u_swirl", "u_chroma", "u_flash", "u_star", "u_field", "u_expo", "u_tint", "u_starCol"];
      for (var i = 0; i < names.length; i++) this._u[names[i]] = gl.getUniformLocation(prog, names[i]);
      var self = this;
      this._ro = new ResizeObserver(function () {
        self._syncSize();
      });
      this._ro.observe(this);
      this._onVis = function () {
        if (document.hidden) self._stopLoop();
        else self._ensureLoop();
      };
      document.addEventListener("visibilitychange", this._onVis);
      this._syncSize();
      this._applyPhase(this.getAttribute("phase") || "off", true);
      this._ensureLoop();
    }
    disconnectedCallback() {
      this._stopLoop();
      if (this._ro) this._ro.disconnect();
      if (this._onVis) document.removeEventListener("visibilitychange", this._onVis);
    }
    attributeChangedCallback(name, _o, v) {
      if (name === "phase") this._applyPhase(v || "off", false);
      else if (name === "variant") {
        this._variant = VARIANTS[v] || VARIANTS.standard;
        if (this._phase !== "off") this._retarget();
      } else if (name === "intensity") {
        var f = parseFloat(v);
        this._intensity = isNaN(f) ? 0.85 : Math.max(0, Math.min(1, f));
        if (this._phase !== "off") this._retarget();
      } else if (name === "progress") {
        var p = parseFloat(v);
        this._progress = isNaN(p) ? 0 : Math.max(0, Math.min(1, p));
        if (this._phase === "charge") this._retarget();
      } else if (name === "rflash") {
        this._rflash = v === "1" || v === "true";
      }
    }
    _pulse(amt) {
      var cap = this._rflash || this._reduced ? 0.4 : 1;
      this._flash = Math.max(this._flash, amt * cap);
    }
    _syncSize() {
      if (!this._canvas) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this._scale;
      var w = Math.max(2, Math.round(this.clientWidth * dpr));
      var hgt = Math.max(2, Math.round(this.clientHeight * dpr));
      if (this._canvas.width !== w || this._canvas.height !== hgt) {
        this._canvas.width = w;
        this._canvas.height = hgt;
        if (this._gl) this._gl.viewport(0, 0, w, hgt);
      }
    }
    _retarget() {
      this._applyPhase(this._phase, true);
    }
    _applyPhase(phase, keepClock) {
      var v = this._variant, I = this._intensity, t = this._tgt, self = this;
      if (!keepClock || phase !== this._phase) {
        this._phaseT = 0;
        this._timeline = [];
      }
      var changed = phase !== this._phase;
      this._phase = phase;
      var red = this._reduced ? 0.45 : 1;
      if (phase === "charge") {
        var p = this._progress;
        this._dir = -1;
        t.speed = (0.1 + 0.1 * p) * red;
        t.cloud = 0.05 + 0.06 * p;
        t.streak = (0.05 + 0.25 * p) * I;
        t.swirl = 0.25;
        t.chroma = 0.15;
        t.star = 0;
        t.field = 0.85 - 0.4 * p;
        t.expo = 0.62 + 0.35 * p;
      } else if (phase === "tunnel") {
        this._dir = 1;
        t.speed = (0.42 + 0.34 * I) * v.speed * red;
        t.cloud = (0.68 + 0.34 * I) * red;
        t.streak = (0.06 + 0.12 * I) * red;
        t.swirl = v.swirl * (0.9 + 0.7 * I);
        t.chroma = 0.35 * I;
        t.star = 0;
        t.field = 0;
        t.expo = 1.0;
        if (changed) {
          this._cur.speed = 0.12;
          this._pulse(0.55);
          this._strobeAt = 1.1;
        }
      } else if (phase === "arrival") {
        // exit rush: accelerate + tighten, then the flash masks the drop into normal space
        t.speed = 1.7;
        t.swirl = this._variant.swirl * 1.5;
        t.cloud = 1.0;
        t.streak = 0.18;
        t.chroma = 0.6;
        t.expo = 1.1;
        if (changed) {
          this._timeline = [
            { at: 0.9, fn: function () {
              self._pulse(1.0);
              self._tgt.speed = 0.04; self._tgt.swirl = 0.3; self._tgt.cloud = 0.02;
              self._tgt.streak = 0; self._tgt.chroma = 0.15; self._tgt.expo = 0.85;
              self._tgt.star = 1; self._tgt.field = 0.95;
            } },
            { at: 2.0, fn: function () { self._tgt.star = 0.55; self._tgt.expo = 0.78; } },
          ];
        }
      } else {
        t.speed = 0; t.cloud = 0; t.streak = 0; t.star = 0; t.field = 0.7; t.expo = 0.8; t.chroma = 0;
      }
      this._ensureLoop();
    }
    _ensureLoop() {
      if (this._raf || !this._gl || document.hidden) return;
      if (this._phase === "off") { this._drawBlack(); return; }
      var self = this;
      this._last = performance.now();
      this._raf = requestAnimationFrame(function step(ts) {
        self._raf = 0;
        self._frame(ts);
        if (self._phase !== "off" && !document.hidden)
          self._raf = requestAnimationFrame(step);
        else if (self._phase === "off") self._drawBlack();
      });
    }
    _stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    _drawBlack() {
      var gl = this._gl;
      if (!gl) return;
      gl.clearColor(0.02, 0.024, 0.035, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    _frame(ts) {
      if (this._canvas.width <= 4) this._syncSize();
      var dt = Math.min(0.05, (ts - this._last) / 1000 || 0.016);
      this._last = ts;
      this._phaseT += dt;
      // timeline one-shots
      for (var i = this._timeline.length - 1; i >= 0; i--) {
        if (this._phaseT >= this._timeline[i].at) {
          this._timeline[i].fn();
          this._timeline.splice(i, 1);
        }
      }
      // neutron strobe
      if (this._phase === "tunnel" && this._variant.strobe && this._phaseT >= this._strobeAt) {
        this._pulse(0.05 + Math.random() * 0.05);
        this._strobeAt = this._phaseT + 1.2 + Math.random() * 0.9;
      }
      // envelope
      var c = this._cur, t = this._tgt;
      for (var k = 0; k < KEYS.length; k++) {
        var key = KEYS[k];
        var rate = RATE[key];
        if (this._phase === "tunnel" && key === "speed") rate *= 1.15;
        if (this._phase === "arrival") {
          if (this._phaseT < 0.9) rate *= 2.2; // snap into the rush
          else if (key === "star" || key === "field" || key === "speed" || key === "cloud") rate *= 2.6; // post-flash drop
        }
        c[key] += (t[key] - c[key]) * Math.min(1, rate * dt);
      }
      this._flash *= Math.exp(-dt * 4.2);
      this._z += c.speed * this._dir * dt * 1.35;
      // adaptive resolution
      this._dtAvg += (dt * 1000 - this._dtAvg) * 0.05;
      if (++this._frames % 48 === 0) {
        if (this._dtAvg > 21 && this._scale > 0.55) {
          this._scale = Math.max(0.55, this._scale - 0.15);
          this._syncSize();
        } else if (this._dtAvg < 13 && this._scale < 1) {
          this._scale = Math.min(1, this._scale + 0.15);
          this._syncSize();
        }
      }
      var gl = this._gl, u = this._u, v = this._variant;
      gl.uniform2f(u.u_res, this._canvas.width, this._canvas.height);
      gl.uniform1f(u.u_t, (ts / 1000) % 60);
      gl.uniform1f(u.u_z, this._z % 1000);
      gl.uniform1f(u.u_speed, c.speed);
      gl.uniform1f(u.u_cloud, c.cloud);
      gl.uniform1f(u.u_streak, c.streak);
      gl.uniform1f(u.u_swirl, c.swirl);
      gl.uniform1f(u.u_chroma, c.chroma);
      gl.uniform1f(u.u_flash, this._flash);
      gl.uniform1f(u.u_star, c.star);
      gl.uniform1f(u.u_field, c.field);
      gl.uniform1f(u.u_expo, c.expo);
      gl.uniform3f(u.u_tint, v.tint[0], v.tint[1], v.tint[2]);
      gl.uniform3f(u.u_starCol, v.star[0], v.star[1], v.star[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
  customElements.define("fsd-tunnel", FsdTunnel);
})();
