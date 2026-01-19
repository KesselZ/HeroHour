import React from 'react';
import { useUIStore } from '../../store/uiStore';

/**
 * 性能监控面板组件 (仅在开发模式显示)
 * 职责：实时展示 FPS、DrawCalls、三角形数量以及分层性能耗时
 */
export const PerfPanel: React.FC = () => {
  const data = useUIStore(s => s.perfData);

  // 仅在开发模式显示 (通过简单的全局变量或 window 检查，因为 TS 对 import.meta.env 有时会有类型识别问题)
  // @ts-ignore
  if (import.meta.env.MODE !== 'development') return null;

  const isWarning = data.totalFrameTime && data.totalFrameTime > 16.6;
  const frameTimeColor = isWarning ? '#ff4444' : '#00ff00';

  return (
    <div 
      className="perf-panel-v2"
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#00ff00',
        padding: '10px',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '12px',
        borderRadius: '4px',
        zIndex: 9999,
        pointerEvents: 'none',
        lineHeight: '1.4',
        minWidth: '200px',
        border: '1px solid rgba(0, 255, 0, 0.3)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #00ff00', marginBottom: '5px' }}>
        PERFORMANCE MONITOR
      </div>
      
      <div>FPS: {data.fps}</div>
      <div>DrawCalls: {data.drawCalls}</div>
      <div>Triangles: {data.triangles}</div>
      
      {/* 补全：显存/对象监控 (Three.js 核心指标) */}
      {window.renderer && (
        <div style={{ opacity: 0.8, fontSize: '11px', marginTop: '5px', borderTop: '1px dashed rgba(0,255,0,0.2)' }}>
          Geometries: {window.renderer.info.memory.geometries}<br/>
          Textures: {window.renderer.info.memory.textures}
        </div>
      )}
      
      {data.totalFrameTime !== undefined && (
        <>
          <div style={{ marginTop: '5px', color: frameTimeColor }}>
            FrameTime: {data.totalFrameTime.toFixed(2)}ms
          </div>
          <div style={{ paddingLeft: '10px' }}>
            SpatialHash: {data.spatialHashBuildTime?.toFixed(2)}ms
          </div>
          <div style={{ paddingLeft: '10px' }}>
            UnitLogic: {data.unitUpdateTime?.toFixed(2)}ms
          </div>
          {data.subTimings && (
            <div style={{ paddingLeft: '15px', fontSize: '11px', opacity: 0.8 }}>
              * Physics: {data.subTimings.physics.toFixed(2)}ms<br/>
              * AI/Target: {data.subTimings.ai.toFixed(2)}ms<br/>
              * Visual: {data.subTimings.visual.toFixed(2)}ms
            </div>
          )}
          <div style={{ paddingLeft: '10px' }}>
            CollisionChecks: {data.collisionChecks}
          </div>
        </>
      )}
      {data.totalUnits !== undefined && (
        <div style={{ marginTop: '5px', color: '#44ccff' }}>
          Units: {data.totalUnits} (P:{data.playerUnits} E:{data.enemyUnits})
        </div>
      )}
    </div>
  );
};
