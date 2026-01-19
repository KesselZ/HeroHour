import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useHeroStore } from '../../store/heroStore';
import { talentManager } from '../../systems/TalentManager';
import { spriteFactory } from '../../engine/SpriteFactory';
import { audioManager } from '../../engine/AudioManager';
import { uiManager } from '../../core/UIManager';

declare global {
  interface Window {
    setGamePaused: (paused: boolean) => void;
  }
}

/**
 * 奇穴节点组件
 */
const TalentNode: React.FC<{
  id: string;
  nodeData: any;
  currentLevel: number;
  isLocked: boolean;
  unlockReason?: string;
  onUpgrade: (id: string) => void;
}> = ({ id, nodeData, currentLevel, isLocked, unlockReason, onUpgrade }) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (nodeRef.current && window.uiManager) {
      window.uiManager.bindTooltip(nodeRef.current, () => {
        let statusText = currentLevel < nodeData.maxLevel ? `升级需求: 1 奇穴点数` : '已修至最高重';
        let statusColor = currentLevel < nodeData.maxLevel ? 'var(--jx3-gold)' : '#ccc';
        
        if (isLocked) {
          statusText = `<span style="color: #ff4d4d;">${unlockReason}</span>`;
          statusColor = '#ff4d4d';
        }

        return {
          name: nodeData.name,
          level: `当前等级: ${currentLevel}/${nodeData.maxLevel}`,
          description: `<div style="margin-bottom: 8px;">${nodeData.description}</div>`,
          status: statusText,
          color: statusColor
        };
      });
    }
  }, [id, nodeData, currentLevel, isLocked, unlockReason]);

  const iconStyle = spriteFactory.getIconStyle(nodeData.icon) as React.CSSProperties;

  return (
    <div 
      className={`talent-node node-type-${nodeData.type} ${currentLevel > 0 ? 'active' : ''} ${isLocked ? 'is-locked' : ''}`}
      style={{
        left: `${nodeData.pos.x + 2500}px`,
        top: `${nodeData.pos.y + 2500}px`
      }}
      onClick={(e) => {
        e.stopPropagation();
        onUpgrade(id);
      }}
      ref={nodeRef}
    >
      <div className="talent-node-inner" style={iconStyle}></div>
      <div className="talent-node-level">{currentLevel}/{nodeData.maxLevel}</div>
      <div className="talent-node-name">{nodeData.name}</div>
    </div>
  );
};

/**
 * 奇穴系统面板 (TalentPanel) - 已迁移至 React
 * 职责：沉浸式奇穴加点，支持平移、缩放和星空视差
 */
export const TalentPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { hero } = useHeroStore();
  const isVisible = activePanel === 'talent';

  // --- 视图状态 ---
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1.0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, viewX: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // --- 动画状态 (用于模拟 UIManager 中的扭曲效果) ---
  const [isEntering, setIsEntering] = useState(false);

  // --- 核心数据：从 TalentManager 获取当前的奇穴树 ---
  const talentTree = useMemo(() => talentManager.currentTree, [hero.id, isVisible]);
  const activeTalents = hero.talents || {};

  // --- 效果：打开面板时的初始化逻辑 ---
  useEffect(() => {
    if (isVisible) {
      setIsEntering(true);
      // 暂停游戏
      if (window.setGamePaused) window.setGamePaused(true);
      
      // 触发全画面扭曲效果 (操作原生 DOM 以获得最快反馈)
      document.getElementById('ui-layer')?.classList.add('ui-layer-distort-out');
      document.getElementById('game-canvas')?.classList.add('ui-layer-distort-out');

      // 居中视图
      const panelWidth = window.innerWidth;
      const panelHeight = window.innerHeight;
      setViewport({
        x: (panelWidth / 2) - 2500,
        y: (panelHeight / 2) - 2500,
        scale: 1.0
      });

      // 0.2s 后彻底隐藏底层
      const timer = setTimeout(() => {
        const uiLayer = document.getElementById('ui-layer');
        const canvas = document.getElementById('game-canvas');
        if (uiLayer) uiLayer.style.visibility = 'hidden';
        if (canvas) canvas.style.visibility = 'hidden';
      }, 200);

      return () => {
        clearTimeout(timer);
        setIsEntering(false);
      };
    }
  }, [isVisible]);

  const handleClose = () => {
    // 恢复底层
    document.getElementById('ui-layer')?.classList.remove('ui-layer-distort-out');
    document.getElementById('game-canvas')?.classList.remove('ui-layer-distort-out');
    
    const uiLayer = document.getElementById('ui-layer');
    const canvas = document.getElementById('game-canvas');
    if (uiLayer) {
      uiLayer.style.visibility = 'visible';
      uiLayer.classList.add('ui-layer-distort-in');
    }
    if (canvas) {
      canvas.style.visibility = 'visible';
      canvas.classList.add('ui-layer-distort-in');
    }

    if (window.setGamePaused) window.setGamePaused(false);
    
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();

    // 清理动画类
    setTimeout(() => {
      uiLayer?.classList.remove('ui-layer-distort-in');
      canvas?.classList.remove('ui-layer-distort-in');
    }, 600);
  };

  // --- 交互逻辑：拖拽 ---
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, viewX: viewport.x, viewY: viewport.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    setViewport(prev => ({
      ...prev,
      x: dragStart.current.viewX + dx,
      y: dragStart.current.viewY + dy
    }));
  };

  const onMouseUp = () => {
    setIsDragging(false);
    // TODO: 实现回弹逻辑
  };

  const onWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setViewport(prev => ({
      ...prev,
      scale: Math.max(0.4, Math.min(1.8, prev.scale + delta))
    }));
  };

  const handleUpgrade = (id: string) => {
    if (talentManager.upgradeTalent(id)) {
      // @ts-ignore
      audioManager.play('talent_upgrade');
      // 注意：talentManager 会发出 talents-updated 事件，HeroManager 监听后会同步到 store
    } else {
      const check = talentManager.canUpgrade(id);
      // @ts-ignore
      uiManager.showNotification(check.reason);
      // @ts-ignore
      audioManager.play('ui_invalid');
    }
  };

  if (!isVisible) return null;

  // --- 渲染逻辑：连线 ---
  const links = talentTree?.links.map((link: any, index: number) => {
    const source = talentTree.nodes[link.source];
    const target = talentTree.nodes[link.target];
    if (!source || !target) return null;

    const offsetX = 2500;
    const offsetY = 2500;
    const x1 = source.pos.x + offsetX;
    const y1 = source.pos.y + offsetY;
    const x2 = target.pos.x + offsetX;
    const y2 = target.pos.y + offsetY;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const cx = midX + (midX - offsetX) * 0.14;
    const cy = midY + (midY - offsetY) * 0.14;

    const isActive = (activeTalents[link.source] || 0) > 0 && (activeTalents[link.target] || 0) > 0;

    return (
      <path 
        key={`link-${index}`}
        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
        className={`talent-link ${isActive ? 'active' : ''}`}
      />
    );
  });

  // --- 渲染逻辑：组标签 ---
  const tags = talentTree?.tags.map((tag: any, index: number) => {
    let activeCount = 0;
    for (const nodeId in talentTree.nodes) {
      if (talentTree.nodes[nodeId].groupId === tag.groupId) {
        if ((activeTalents[nodeId] || 0) > 0) activeCount++;
      }
    }
    const progress = tag.weight > 0 ? activeCount / tag.weight : 0;
    const opacity = 0.1 + progress * 0.7;
    const glowRadius = progress * 60;
    const glowOpacity = progress * 0.8;

    return (
      <div 
        key={`tag-${index}`}
        className="talent-group-tag"
        style={{
          left: `${tag.pos.x + 2500}px`,
          top: `${tag.pos.y + 2500}px`,
          color: `rgba(255, 255, 255, ${opacity})`,
          textShadow: progress > 0 ? `0 0 ${glowRadius}px rgba(255, 255, 255, ${glowOpacity})` : 'none',
          transform: 'translate(-50%, -50%)'
        }}
      >
        {tag.text}
      </div>
    );
  });

  // 视差背景样式
  const starryBgStyle: React.CSSProperties = {
    transform: `translate(${(viewport.x - (window.innerWidth / 2 - 2500)) * 0.1}px, ${(viewport.y - (window.innerHeight / 2 - 2500)) * 0.1}px) scale(${1.05 + (viewport.scale - 1.0) * 0.1})`
  };

  return (
    <div 
      id="talent-panel" 
      className={`talent-panel-immersive distort-enter sect-${window.worldManager?.availableHeroes[hero.id]?.sect || 'chunyang'}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <div className="talent-starry-bg" style={starryBgStyle}></div>
      
      <div className="talent-ui-overlay">
        <div className="talent-points-clean">
          <div className="points-icon">✧</div>
          <div className="points-num">{hero.talentPoints}</div>
          <div className="points-label">星魄</div>
        </div>

        <button className="close-talent-minimal" onClick={handleClose}>
          <span className="close-icon">✕</span>
          <span className="close-text">离 开</span>
        </button>
      </div>

      <div className="talent-star-chart">
        <div 
          id="talent-container" 
          className="talent-node-container"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          <svg id="talent-links-svg" className="talent-links-svg" style={{ width: '5000px', height: '5000px' }}>
            {links}
          </svg>
          
          {talentTree && Object.entries(talentTree.nodes).map(([id, node]: [string, any]) => {
            const unlockStatus = talentManager.checkUnlockStatus(id);
            return (
              <TalentNode 
                key={id}
                id={id}
                nodeData={node}
                currentLevel={activeTalents[id] || 0}
                isLocked={unlockStatus.isLocked}
                unlockReason={unlockStatus.reason}
                onUpgrade={handleUpgrade}
              />
            );
          })}

          {tags}
        </div>
      </div>
    </div>
  );
};
