import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Stage, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import { 
  Box, 
  Layers, 
  Maximize2, 
  Info, 
  Settings, 
  Search, 
  ChevronRight,
  Box as CubeIcon,
  HardHat,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function BuildingModel() {
  // Simulating a BIM model with basic shapes for demonstration
  // In a real app, you would use useIFC or similar
  return (
    <group>
      {/* Foundation */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[10, 1, 10]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      
      {/* First Floor Walls */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[9.5, 4, 9.5]} />
        <meshStandardMaterial color="#f1f5f9" opacity={0.5} transparent />
      </mesh>

      {/* Interior Structure (Slab) */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[9.5, 0.4, 9.5]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      {/* Columns */}
      <mesh position={[4, 2, 4]}>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <mesh position={[-4, 2, 4]}>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <mesh position={[4, 2, -4]}>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <mesh position={[-4, 2, -4]}>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

export default function BimViewer() {
  const [activeLayer, setActiveLayer] = useState<string>('all');
  const [showMetadata, setShowMetadata] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const layers = [
    { id: 'arch', name: 'Architektur', color: 'bg-blue-500' },
    { id: 'stat', name: 'Statik', color: 'bg-red-500' },
    { id: 'shk', name: 'TGA / SHK', color: 'bg-emerald-500' },
    { id: 'elec', name: 'Elektro', color: 'bg-amber-500' }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-[2.5rem] overflow-hidden relative border border-slate-800 shadow-2xl">
      {/* BIM Toolbar Top */}
      <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-4 pointer-events-auto">
          <div className="glass-card bg-slate-900/40 backdrop-blur-xl border-slate-700 p-2 rounded-2xl flex items-center gap-1">
            <button className="p-3 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20">
              <CubeIcon size={20} />
            </button>
            <button className="p-3 text-slate-400 hover:text-white rounded-xl">
              <Layers size={20} />
            </button>
            <button className="p-3 text-slate-400 hover:text-white rounded-xl" onClick={() => setShowMetadata(!showMetadata)}>
              <Info size={20} />
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1" />
            <button className="p-3 text-slate-400 hover:text-white rounded-xl">
              <Maximize2 size={20} />
            </button>
          </div>

          {/* Layer Toggle */}
          <div className="glass-card bg-slate-900/40 backdrop-blur-xl border-slate-700 p-4 rounded-3xl flex flex-col gap-3 min-w-[200px]">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-1">Modell-Layer (IFC)</p>
            {layers.map(layer => (
              <button 
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                  activeLayer === layer.id ? 'bg-white/10 text-white border border-white/20' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${layer.color}`} />
                  <span className="text-xs font-bold">{layer.name}</span>
                </div>
                {activeLayer === layer.id ? <Eye size={14} className="text-brand-primary" /> : <EyeOff size={14} />}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col gap-4 items-end">
          <div className="glass-card bg-slate-900/40 backdrop-blur-xl border-slate-700 p-2 rounded-2xl flex items-center gap-2">
            <div className="w-40 px-4 py-2 bg-slate-800 rounded-xl text-xs text-white flex items-center gap-2">
              <Search size={14} className="text-slate-500" />
              <input type="text" placeholder="Objekt suchen..." className="bg-transparent border-none outline-none w-full" />
            </div>
            <button className="p-2.5 bg-slate-800 text-slate-400 rounded-xl hover:text-white">
              <Settings size={20} />
            </button>
          </div>

          <div className="bg-brand-primary text-white p-6 rounded-3xl shadow-xl shadow-brand-primary/20 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <HardHat size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Bauphase</p>
              <h4 className="text-lg font-black tracking-tight">Rohbau OG1</h4>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Canvas Area */}
      <div className="flex-1 w-full relative">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <pointLight position={[-10, -10, -10]} intensity={0.5} />
          
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6}>
              <BuildingModel />
            </Stage>
          </Suspense>

          <Grid 
            infiniteGrid 
            cellSize={1} 
            sectionSize={5} 
            fadeDistance={50} 
            fadeStrength={5} 
            followCamera={false}
            sectionColor="#334155"
            cellColor="#1e293b"
          />
          <OrbitControls 
            makeDefault 
            enableDamping 
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={50}
          />
          <ContactShadows position={[0, -0.49, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
        </Canvas>

        {/* Selected Element Info Overlay */}
        <AnimatePresence>
          {showMetadata && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900/80 backdrop-blur-2xl border-l border-slate-700 z-30 p-8 text-white flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black tracking-tight">Eigenschaften</h3>
                <button onClick={() => setShowMetadata(false)} className="text-slate-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-3">Ausgewähltes Objekt</p>
                  <h4 className="text-lg font-bold">Stahlbetonstütze C30/37</h4>
                  <p className="text-slate-400 text-xs mt-1">IfcColumn • ID: 29xk_012</p>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Abmessungen</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Breite</p>
                      <p className="text-sm font-black">500 mm</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Höhe</p>
                      <p className="text-sm font-black">4000 mm</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Material & Statik</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs py-3 border-b border-white/5">
                      <span className="text-slate-500">Klasse</span>
                      <span className="font-bold">C30/37</span>
                    </div>
                    <div className="flex justify-between text-xs py-3 border-b border-white/5">
                      <span className="text-slate-500">Bewehrung</span>
                      <span className="font-bold">B500B</span>
                    </div>
                    <div className="flex justify-between text-xs py-3">
                      <span className="text-slate-500">Brandschutz</span>
                      <span className="font-bold">R90</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
                  <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-2">Bauleiter Notiz</p>
                  <p className="text-xs text-brand-primary/80 leading-relaxed italic">
                    "Bewehrungsabnahme für morgen 08:00 Uhr eingeplant."
                  </p>
                </div>
              </div>

              <button className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs mt-8 shadow-xl shadow-brand-primary/20">
                Mangel zuweisen
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BIM View Controls Bottom */}
      <div className="bg-slate-800/50 backdrop-blur-xl p-4 border-t border-slate-700 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Box size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">3D Orbit Mode</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-4">
            <button className="text-[10px] font-bold text-white bg-slate-700 px-4 py-1.5 rounded-lg border border-slate-600">Drahtmodell</button>
            <button className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors">Schattiert</button>
            <button className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors">X-Ray</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2">Status:</span>
          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">IFC Modell synchronisiert</span>
          </div>
        </div>
      </div>
    </div>
  );
}
