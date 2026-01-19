import React from 'react';
import { useUIStore } from '../../store/uiStore';

/**
 * 性能监控面板组件 (开发模式增强版)
 */
export const PerfPanel: React.FC = () => {
  const data = useUIStore(s => s.perfData);

  // @ts-ignore
  if (import.meta.env.MODE !== 'development') return null;

  return (
    <div 
      className="perf-panel-v2"
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: '#00ff00',
        padding: '10px',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '11px',
        borderRadius: '4px',
        zIndex: 9999,
        pointerEvents: 'none',
        lineHeight: '1.3',
        minWidth: '180px',
        border: '1px solid rgba(0, 255, 0, 0.3)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #00ff00', marginBottom: '5px', fontSize: '12px' }}>
        SYSTEM MONITOR
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>FPS:</span>
        <span style={{ color: data.fps < 50 ? '#ff4444' : '#00ff00' }}>{data.fps}</span>
      </div>
      
      <div style={{ marginTop: '5px', opacity: 0.8 }}>
        DrawCalls: {data.drawCalls}<br/>
        Triangles: {data.triangles}
      </div>

      <div style={{ marginTop: '5px', borderTop: '1px dashed rgba(0,255,0,0.2)', paddingTop: '5px' }}>
        <div style={{ color: '#44ccff' }}>SCENE STATS:</div>
        Objects: {data.totalUnits || 0}<br/>
        Active VFX: {data.activeVFX || 0}
      </div>

      <div style={{ marginTop: '5px', borderTop: '1px dashed rgba(0,255,0,0.2)', paddingTop: '5px' }}>
        <div style={{ color: '#ffcc00' }}>TIME (MS):</div>
        Logic: {data.logicTime?.toFixed(2)}ms<br/>
        Render: {data.renderTime?.toFixed(2)}ms
      </div>
      
      {/* 补全：显存/对象监控 (Three.js 核心指标) */}
      {/* @ts-ignore */}
      {window.renderer && (
        <div style={{ opacity: 0.6, fontSize: '10px', marginTop: '5px' }}>
          {/* @ts-ignore */}
          MEM: G:{window.renderer.info.memory.geometries} T:{window.renderer.info.memory.textures}
        </div>
      )}
    </div>
  );
};
