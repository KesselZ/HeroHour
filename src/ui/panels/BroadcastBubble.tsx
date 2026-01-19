import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../../store/worldStore';

/**
 * 播报气泡组件 (BroadcastBubble) - 已迁移至 React
 */
export const BroadcastBubble: React.FC = () => {
  const { eventHistory } = useWorldStore();
  const [activeBubbles, setActiveBubbles] = useState<any[]>([]);

  useEffect(() => {
    const handleBroadcast = (e: any) => {
      const event = e.detail;
      const id = Date.now();
      setActiveBubbles(prev => [...prev, { ...event, id }]);
      
      setTimeout(() => {
        setActiveBubbles(prev => prev.map(b => b.id === id ? { ...b, fade: true } : b));
        setTimeout(() => {
          setActiveBubbles(prev => prev.filter(b => b.id !== id));
        }, 500);
      }, 4000);
    };

    window.addEventListener('world-broadcast', handleBroadcast);
    return () => window.removeEventListener('world-broadcast', handleBroadcast);
  }, []);

  return (
    <div id="broadcast-bubble-container">
      {activeBubbles.map(bubble => (
        <div 
          key={bubble.id} 
          className={`broadcast-bubble ${bubble.fade ? 'fade-out' : ''}`}
        >
          <span className={`event-tag ${bubble.type}`}>{bubble.title}</span>
          <div className="event-text">{bubble.text}</div>
        </div>
      ))}
    </div>
  );
};
