// mGBA WeChat Mini Program glue
// This file provides a minimal adapter for Emscripten-built mgba.js or direct WebAssembly
// It maps WeChat sensor APIs to mGBA sensor setters and exposes simple load/start helpers.

(function(wxGlobal){
  'use strict';

  const Glue = {
    Module: null,
    cwraps: {},
    async initFromEmscripten(Module){
      this.Module = Module;
      if (Module.ready) await Module.ready;
      this._bindFunctions();
      return this.Module;
    },
    async initFromWasmBuffer(wasmArrayBuffer, importObject){
      const { instance } = await WebAssembly.instantiate(wasmArrayBuffer, importObject || {});
      // If the wasm exports use names without underscore, adapt as needed
      this.Module = { exports: instance.exports, HEAPF32: new Float32Array(1024*16) };
      this._bindFunctionsRaw();
      return this.Module;
    },
    _bindFunctions(){
      const M = this.Module;
      const names = ['_malloc','_free','_memcpy','_memset','_mgba_set_accelerometer','_mgba_set_gyroscope','_mgba_set_light_sensor','_mgba_get_save_type','_retro_init','_retro_run','_retro_load_game'];
      names.forEach(n => { try{ this.cwraps[n] = M.cwrap ? M.cwrap(n.replace(/^_/, ''), 'number', ['number']) : (M._ && M._[n] ? (...a)=>M._[n].apply(M, a) : null); }catch(e){ this.cwraps[n]=null; }});
    },
    _bindFunctionsRaw(){
      const E = this.Module.exports;
      const names = ['malloc','free','memcpy','memset','mgba_set_accelerometer','mgba_set_gyroscope','mgba_set_light_sensor','mgba_get_save_type','retro_init','retro_run','retro_load_game'];
      names.forEach(n => { this.cwraps['_' + n] = E[n] ? (...a)=>E[n](...a) : null; });
    },
    setAccelerometer(x,y,z){ if(this.cwraps['_mgba_set_accelerometer']) this.cwraps['_mgba_set_accelerometer'](this._packVec3(x,y,z)); },
    setGyroscope(x,y,z){ if(this.cwraps['_mgba_set_gyroscope']) this.cwraps['_mgba_set_gyroscope'](this._packVec3(x,y,z)); },
    setLight(level){ if(this.cwraps['_mgba_set_light_sensor']) this.cwraps['_mgba_set_light_sensor'](level); },
    _packVec3(x,y,z){
      const M = this.Module;
      if (M._malloc){
        const p = M._malloc(12);
        const f32 = new Float32Array(M.HEAPF32.buffer, p, 3);
        f32[0]=x; f32[1]=y; f32[2]=z; return p;
      }
      return 0;
    },
    bindWxSensors(){
      if (wxGlobal && wxGlobal.onAccelerometerChange){
        wxGlobal.onAccelerometerChange(res => { const a=res && res.value?res.value:res; this.setAccelerometer(a.x||0,a.y||0,a.z||0); });
      }
      if (wxGlobal && wxGlobal.onGyroscopeChange){
        wxGlobal.onGyroscopeChange(res => { const g=res && res.value?res.value:res; this.setGyroscope(g.x||0,g.y||0,g.z||0); });
      }
    }
  };

  // export
  if (typeof module !== 'undefined' && module.exports) module.exports = Glue;
  if (typeof window !== 'undefined') window.mgbaWxGlue = Glue;
  if (typeof wx !== 'undefined') wx.mgbaWxGlue = Glue;
})(typeof wx !== 'undefined' ? wx : (typeof window !== 'undefined' ? window : {}));
