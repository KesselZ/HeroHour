import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useHeroStore } from '../../store/heroStore';
import { useUIStore } from '../../store/uiStore';
import { spriteFactory } from '../../engine/SpriteFactory';
import { audioManager } from '../../engine/AudioManager';
import { useModifiedValue } from '../../hooks/useModifiedValue';

declare global {
  interface Window {
    worldManager: any;
    uiManager: any;
    worldScene: any;
  }
}

/**
 * 城镇管理面板 - 子组件：单位槽位
 */
const UnitSlot: React.FC<{
  type: string;
  count?: number;
  onClick?: () => void;
  isLocked?: boolean;
}> = ({ type, count, onClick, isLocked }) => {
  const iconStyle = spriteFactory.getIconStyle(type) as React.CSSProperties;
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slotRef.current && window.worldScene) {
      window.worldScene.bindUnitTooltip(slotRef.current, type);
    }
  }, [type]);

  return (
    <div 
      className={`unit-slot ${isLocked ? 'is-locked' : ''}`} 
      onClick={onClick}
      ref={slotRef}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="slot-icon" style={iconStyle}></div>
      {count !== undefined && <span className="slot-count">x{count}</span>}
    </div>
  );
};

/**
 * 城镇管理面板 - 子组件：建筑节点 (营造图风格)
 */
const BuildingNode: React.FC<{
  building: any;
  onUpgrade: (id: string) => void;
  canAfford: boolean;
}> = ({ building: b, onUpgrade, canAfford }) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [justUpgraded, setJustUpgraded] = React.useState(false);
  const prevLevelRef = useRef(b.level);
  
  const isMax = b.level >= b.maxLevel;
  const iconStyle = spriteFactory.getIconStyle(b.icon) as React.CSSProperties;
  const progress = (b.level / b.maxLevel) * 100;

  // 监听等级变化，触发“建筑完成”动画
  useEffect(() => {
    if (b.level > prevLevelRef.current) {
      setJustUpgraded(true);
      const timer = setTimeout(() => setJustUpgraded(false), 600);
      prevLevelRef.current = b.level;
      return () => clearTimeout(timer);
    }
    prevLevelRef.current = b.level;
  }, [b.level]);

  useEffect(() => {
    if (nodeRef.current && window.uiManager) {
      window.uiManager.bindTooltip(nodeRef.current, () => {
        return {
          name: b.name,
          description: b.description,
          level: b.level,
          maxLevel: b.maxLevel,
          cost: b.cost
        };
      });
    }
  }, [b]);

  return (
    <div 
      ref={nodeRef}
      className={`building-node-v4 ${isMax ? 'is-max' : ''} ${!canAfford ? 'cannot-afford' : ''} ${justUpgraded ? 'just-upgraded' : ''}`}
      onClick={() => !isMax && onUpgrade(b.id)}
    >
      <div className="node-icon-wrapper">
        <div className="node-icon" style={iconStyle}></div>
      </div>
      <div className="node-body">
        <div className="node-name">{b.name}</div>
        <div className="node-level-bar">
          <div className="node-level-progress" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="node-footer">
          <span className="node-lv-text">Lv.{b.level}</span>
          {!isMax && (
            <span className="node-cost-mini">
              {b.cost.gold > 0 && `💰${b.cost.gold}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 区域切换标签
 */
const DistrictTab: React.FC<{
  id: string;
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}> = ({ id, label, icon, active, onClick }) => (
  <div className={`district-tab ${active ? 'active' : ''}`} onClick={onClick} data-id={id}>
    <span className="district-tab-icon">{icon}</span>
    <span className="district-tab-label">{label}</span>
  </div>
);

/**
 * 城镇管理面板 (TownManagementPanel)
 * 职责：处理建筑升级、资源产出显示、征兵与驻守管理
 */
export const TownManagementPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { city, resources } = useGameStore();
  const { hero } = useHeroStore();
  const [activeDistrict, setActiveDistrict] = React.useState<'economy' | 'military' | 'magic'>('economy');
  const isVisible = activePanel === 'townManagement';

  // --- 响应式数值：利用 useModifiedValue 使产出随增益实时变动 ---
  const cityObj = window.worldManager?.cities[city.id];
  const reactiveGoldIncome = useModifiedValue(cityObj, 'final_gold_income', city.income.gold);
  const reactiveWoodIncome = useModifiedValue(cityObj, 'final_wood_income', city.income.wood);

  useEffect(() => {
    if (isVisible) {
      console.log('[TownManagementPanel] Opening city:', city.id);
      // 在移动端隐藏 HUD
      if (window.uiManager?.isMobile) window.uiManager.setHUDVisibility(false);
    } else if (window.uiManager?.isMobile) {
      // 如果没有其他全屏面板打开，则恢复 HUD
      const heroPanel = document.getElementById('hero-stats-panel');
      if (!heroPanel || heroPanel.classList.contains('hidden')) {
        window.uiManager.setHUDVisibility(true);
      }
    }
  }, [isVisible, city.id]);

  const handleUpgrade = (buildingId: string) => {
    if (cityObj && cityObj.upgradeBuilding(buildingId)) {
      // @ts-ignore
      audioManager.play('ui_click');
    } else {
      // @ts-ignore
      audioManager.play('ui_invalid');
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore
    audioManager.play('ui_click', { volume: 0.4 });
    closePanel();
  };

  const handleRecruit = (type: string) => {
    if (window.worldManager?.recruitUnit(type, city.id)) {
      // @ts-ignore
      audioManager.play('ui_click', { volume: 0.5 });
      window.worldManager.syncCityToStore(city.id);
    } else {
      // @ts-ignore
      audioManager.play('ui_invalid', { volume: 0.8 });
    }
  };

  const handleTransferToHero = (type: string) => {
    if (window.worldManager?.transferToHero(type, 1, city.id)) {
      // @ts-ignore
      audioManager.play('ui_click', { volume: 0.5 });
      window.worldManager.syncCityToStore(city.id);
    }
  };

  const handleTransferToCity = (type: string) => {
    if (window.worldManager?.transferToCity(type, 1, city.id)) {
      // @ts-ignore
      audioManager.play('ui_click', { volume: 0.5 });
      window.worldManager.syncCityToStore(city.id);
    }
  };

  const handleCollectAll = () => {
    if (window.worldManager?.collectAllFromCity(city.id)) {
      // @ts-ignore
      audioManager.play('ui_click', { volume: 0.8 });
      window.worldManager.syncCityToStore(city.id);
    }
  };

  const handleDepositAll = () => {
    if (window.worldManager?.depositAllToCity(city.id)) {
      // @ts-ignore
      audioManager.play('ui_click', { volume: 0.8 });
      window.worldManager.syncCityToStore(city.id);
    }
  };

  const renderConstructionLayout = () => {
    const districtInfo = {
      economy: { title: '经济', desc: '经略百业', icon: '💰' },
      military: { title: '军事', desc: '内修军政', icon: '⚔️' },
      magic: { title: '宗门', desc: '玄门绝学', icon: '☯️' }
    };

    const districts: ('economy' | 'military' | 'magic')[] = ['economy', 'military', 'magic'];
    const activeIndex = districts.indexOf(activeDistrict);

    return (
      <div className="town-construction-layout">
        <div className="district-sidebar">
          {/* 滑动指示器 */}
          <div 
            className="district-active-indicator" 
            style={{ transform: `translateY(${activeIndex * (110 + 4)}px)` }}
          ></div>
          
          <DistrictTab id="economy" label="经济" icon="💰" active={activeDistrict === 'economy'} onClick={() => setActiveDistrict('economy')} />
          <DistrictTab id="military" label="军事" icon="⚔️" active={activeDistrict === 'military'} onClick={() => setActiveDistrict('military')} />
          <DistrictTab id="magic" label="宗门" icon="☯️" active={activeDistrict === 'magic'} onClick={() => setActiveDistrict('magic')} />
        </div>
        
        <div className="district-viewport">
          <div className="district-content-wrapper" style={{ transform: `translateX(-${activeIndex * 33.333}%)` }}>
            {districts.map(distId => {
              const buildings = city.buildings[distId] || [];
              const info = districtInfo[distId];
              return (
                <div key={distId} className={`district-pane pane-${distId}`}>
                  <div className="district-header-v5-mini">
                    <span className="mini-icon">{info.icon}</span>
                    <span className="mini-title">{info.title}建设</span>
                    <span className="mini-desc">{info.desc}</span>
                  </div>
                  
                  <div className="blueprint-scroll-area v5">
                    {buildings.map((b: any) => {
                      const canAfford = resources.gold >= b.cost.gold && resources.wood >= b.cost.wood;
                      return (
                        <BuildingNode 
                          key={b.id} 
                          building={b} 
                          onUpgrade={handleUpgrade}
                          canAfford={canAfford}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const isPhysicalVisit = city.isPhysicalVisit;

  return (
    <div 
      id="town-management-panel" 
      className={`menu-container town-panel-v3 ${isVisible ? '' : 'hidden'}`}
      style={{
        zIndex: 1000,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div className="menu-decoration-top"></div>
      <button 
        className="close-btn-v3" 
        title="关闭" 
        onClick={handleClose}
      >
        ×
      </button>
      
      <div className="town-header-top-v3">
        <div className="town-income-v3">
          季度产出: 💰<span>{Math.floor(reactiveGoldIncome)}</span> 🪵<span>{Math.floor(reactiveWoodIncome)}</span>
        </div>
        <h2 className="town-title-v3">{city.name}</h2>
        <button 
          className="teleport-btn-v3" 
          disabled={!isPhysicalVisit}
          style={{ opacity: isPhysicalVisit ? 1 : 0.3 }}
          onClick={() => isPhysicalVisit && window.uiManager?.toggleTeleportPanel(true)}
        >
          神行千里
        </button>
      </div>

      <div className="town-main-content">
        <div className="town-construction-section">
          {renderConstructionLayout()}
        </div>
        
        <div className="town-recruit-section">
          <div id="town-recruit-list" className="recruit-list-v3">
            {city.recruits && city.recruits.length > 0 ? (
              city.recruits.map(r => (
                <div key={r.type} className="recruit-item">
                  <UnitSlot type={r.type} />
                  <div className="unit-info">
                    <span className="unit-name">{r.name}</span>
                    <span className="unit-cost">💰{r.cost}</span>
                  </div>
                  <button 
                    className="wuxia-btn wuxia-btn-small"
                    onClick={() => handleRecruit(r.type)}
                  >
                    招募
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-hint" style={{ color: '#a68b44', opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                — 暂无兵源可募 —
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="town-army-section">
        <div className="army-container garrison">
          <div className="army-label">城防驻军</div>
          <div className="army-slots-v3">
            {Object.entries(city.garrison).map(([type, count]) => (
              count > 0 && (
                <UnitSlot 
                  key={type} 
                  type={type} 
                  count={count} 
                  onClick={() => isPhysicalVisit ? handleTransferToHero(type) : window.worldManager?.showNotification("必须亲临城市才能领兵！")}
                />
              )
            ))}
          </div>
        </div>
        <div className="army-transfer-actions">
          <button 
            className="transfer-btn" 
            title="全部领取至队伍"
            onClick={handleCollectAll}
            disabled={!isPhysicalVisit}
            style={{ opacity: isPhysicalVisit ? 1 : 0.3 }}
          >
            ↓
          </button>
          <button 
            className="transfer-btn" 
            title="队伍全部驻守"
            onClick={handleDepositAll}
            disabled={!isPhysicalVisit}
            style={{ opacity: isPhysicalVisit ? 1 : 0.3 }}
          >
            ↑
          </button>
        </div>
        <div className="army-container hero-army">
          <div className="army-label">
            远征将士 
            <span style={{ 
              color: hero.stats.currentLeadership > hero.stats.leadership ? '#ff4444' : '#c4ae7a',
              marginLeft: '8px',
              fontSize: '0.8em'
            }}>
              ({hero.stats.currentLeadership}/{hero.stats.leadership})
            </span>
          </div>
          <div className="army-slots-v3">
            {Object.entries(hero.stats.army).map(([type, count]) => (
              count > 0 && (
                <UnitSlot 
                  key={type} 
                  type={type} 
                  count={count} 
                  onClick={() => isPhysicalVisit ? handleTransferToCity(type) : window.worldManager?.showNotification("必须亲临城市才能调兵！")}
                />
              )
            ))}
          </div>
        </div>
      </div>
      
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
