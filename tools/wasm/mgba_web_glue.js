// mGBA Web glue for H5 (browser)
// Usage: include the emscripten-generated mgba.js before this file, or load mgba.js as Module
// This wrapper exposes: initModule(), loadRom(url), start(), stop(), setSensor({accel,gyro,light})

(function(global){
  'use strict';

  // Recommended emcc flags (example):
  // emcc mgba_libretro.a -o mgba.js \
  //  -O2 -flto -fno-rtti -fno-exceptions \
  //  -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=50331648 -s MAXIMUM_MEMORY=134217728 \
  //  -s STACK_SIZE=4194304 -s USE_PTHREADS=0 \
  //  -s EXPORTED_FUNCTIONS='["_malloc","_free","_memcpy","_memset", "_mgba_set_accelerometer", "_mgba_set_gyroscope", "_mgba_set_light_sensor", "_mgba_get_save_type", "_retro_init", "_retro_deinit", "_retro_api_version", "_retro_get_system_info", "_retro_get_system_av_info", "_retro_set_environment", "_retro_set_video_refresh", "_retro_set_audio_sample_batch", "_retro_set_input_poll", "_retro_set_input_state", "_retro_reset", "_retro_run", "_retro_serialize_size", "_retro_serialize", "_retro_unserialize", "_retro_load_game", "_retro_unload_game"]'

  function makePromise() {
    let res, rej;
    const p = new Promise((r, j) => { res = r; rej = j; });
    p.resolve = res; p.reject = rej; return p;
  }

  const Glue = {
    ModuleReady: makePromise(),
    Module: null,
    cwraps: {},
    async initModule(moduleOverrides){
      if (typeof Module !== 'undefined' && Module && Module.ready) {
        // Emscripten already included
        this.Module = Module;
        await Module.ready;
      } else {
        // Expect caller to have loaded mgba.js which defines Module
        if (!moduleOverrides) moduleOverrides = {};
        // create a Module placeholder if emscripten script will attach later
        this.Module = moduleOverrides;
      }
      // wait for runtime if present
      if (this.Module && this.Module.ready) await this.Module.ready;
      this._bindFunctions();
      this.ModuleReady.resolve(this.Module);
      return this.Module;
    },

    _bindFunctions(){
      const M = this.Module;
      const need = ['_malloc','_free','_memcpy','_memset','_mgba_set_accelerometer','_mgba_set_gyroscope','_mgba_set_light_sensor','_mgba_get_save_type','_retro_init','_retro_deinit','_retro_api_version','_retro_get_system_info','_retro_get_system_av_info','_retro_set_environment','_retro_set_video_refresh','_retro_set_audio_sample_batch','_retro_set_input_poll','_retro_set_input_state','_retro_reset','_retro_run','_retro_serialize_size','_retro_serialize','_retro_unserialize','_retro_load_game','_retro_unload_game'];
      need.forEach(fn => {
        try{ this.cwraps[fn] = M.cwrap ? M.cwrap(fn.replace(/^_/, ''), 'number', ['number']) : (M._ && M._[fn] ? function(){ return M._[fn].apply(M, arguments); } : null);
        }catch(e){ this.cwraps[fn] = null; }
      });
    },

    // ROM helper: fetch ROM and write to MEMFS, then call libretro load
    async loadRom(url, romName){
      await this.ModuleReady;
      const M = this.Module;
      romName = romName || 'rom.gba';
      const res = await fetch(url);
      if(!res.ok) throw new Error('Failed to fetch ROM');
      const ab = await res.arrayBuffer();
      const data = new Uint8Array(ab);
      // create file in FS
      if (M.FS) {
        try{ if (M.FS.analyzePath('/roms').exists) M.FS.rmdir('/roms'); }catch(e){}
        try{ M.FS.mkdir('/roms'); }catch(e){}
        M.FS.writeFile('/roms/' + romName, data);
        // build a retro_game_info structure? libretro frontend may accept path via environment callback
        // Call _retro_load_game with pointer to whatever the libretro core expects. Many cores parse the ROM from FS.
        if (this.cwraps['_retro_load_game']){
          // Simple cores expect a pointer to struct; to be conservative, call with 0 and let core open FS path
          this.cwraps['_retro_load_game'](0);
        }
      } else {
        throw new Error('Module.FS not available; build with MEMFS support');
      }
    },

    // Sensor setters (call into C)
    setAccelerometer(x,y,z){ if(this.cwraps['_mgba_set_accelerometer']) this.cwraps['_mgba_set_accelerometer'](this._packVec3(x,y,z)); }
    ,setGyroscope(x,y,z){ if(this.cwraps['_mgba_set_gyroscope']) this.cwraps['_mgba_set_gyroscope'](this._packVec3(x,y,z)); }
    ,setLight(level){ if(this.cwraps['_mgba_set_light_sensor']) this.cwraps['_mgba_set_light_sensor'](level); }

    ,_packVec3(x,y,z){
      // allocate 12 bytes and write floats
      const M = this.Module; const p = M._malloc(12);
      const heapF = new Float32Array(M.HEAPF32.buffer, p, 3);
      heapF[0]=x; heapF[1]=y; heapF[2]=z; return p;
    }
  };

  // Browser sensor auto-mapping
  Glue._bindSensorsToWindow = function(){
    if (window && window.addEventListener && window.DeviceMotionEvent){
      window.addEventListener('devicemotion', ev => {
        if (!ev.accelerationIncludingGravity) return;
        const a = ev.accelerationIncludingGravity;
        Glue.setAccelerometer(a.x||0, a.y||0, a.z||0);
      });
    }
    if (window && window.DeviceOrientationEvent){
      window.addEventListener('deviceorientation', ev => {
        // map alpha/beta/gamma to gyro-like values
        Glue.setGyroscope(ev.alpha||0, ev.beta||0, ev.gamma||0);
      });
    }
  };

  // Expose
  global.mgbaGlue = Glue;
})(this);
