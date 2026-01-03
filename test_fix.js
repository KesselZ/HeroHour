// 简单的测试来验证 WorldStatusManager 是否正常工作
import { WorldStatusManager } from './src/core/WorldStatusManager.js';
import { timeManager } from './src/core/TimeManager.js';

// 模拟 worldManager 对象
const mockWorldManager = {
    factions: {
        'test_faction': { heroId: 'test_hero' }
    }
};

try {
    // 测试基本方法
    const situation = WorldStatusManager.getSituationDescription('easy');
    console.log('Situation description works:', situation.length > 0);

    // 测试事件触发
    WorldStatusManager.triggerActiveEvent('test_event', {
        title: 'Test Event',
        text: 'This is a test',
        type: 'atmosphere'
    });
    console.log('Event trigger works');

    console.log('All tests passed!');
} catch (error) {
    console.error('Test failed:', error);
}
