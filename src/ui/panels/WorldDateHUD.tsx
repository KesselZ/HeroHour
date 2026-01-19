import React from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * 时间日期显示面板 (HUD) - 已迁移至 React
 * 复用原有的 CSS 类名：.world-date-display-container, .world-date-display, .time-progress-outer, .time-progress-circle
 */
export const WorldDateHUD: React.FC = () => {
  const { time, weather } = useGameStore();

  const weatherIcons: Record<string, string> = {
    'none': '☀️',
    'rain': '🌧️',
    'snow': '❄️'
  };

  return (
    <div className="world-date-display-container">
      <div className="world-date-display">
        <span className="weather-icon" title={weather.name}>
          {weatherIcons[weather.type] || '☀️'}
        </span>
        天宝 {time.year} 年 · {time.season}
      </div>
      <div className="time-progress-outer">
        <div 
          className="time-progress-circle" 
          style={{
            background: `conic-gradient(var(--jx3-gold) ${time.progress}%, #e0e0e0 0)`
          }}
        ></div>
      </div>
    </div>
  );
};
