/**
 * WorldStatusManager: 管理江湖局势的动态描述文字
 * 职责：追踪江湖大事，并根据难度、时间及玩家行为生成动态描述
 */
export class WorldStatusManager {
    // 基础难度描述
    static DIFFICULTY_DESCRIPTIONS = {
        'easy': "如今世道尚算平稳，虽有零星山贼作乱，但各大门派根基稳固。叛军势力尚未成气候，正是英雄潜心闭关、积蓄实力的好时机。",
        'hard': "乱世风云渐起，边境守军告急，各地叛军正如火如荼地招兵买马、更替甲胄。江湖中传言四起，各方势力皆在暗中加强戒备，切不可掉以轻心。",
        'hell': "神州陆沉，狼烟四起！叛军铁骑已如洪流般席卷各州郡，甲胄之声彻夜不绝。阁下的名声已引起了各路强敌的极度忌惮，杀机四伏，稍有不慎便是万劫不复。"
    };

    // 存储已触发的江湖大事
    static worldEvents = new Set();

    // 江湖大事对应的文案追加
    static EVENT_EXTENSIONS = {
        'defeated_rebel_leader': " 随着叛军首领落马，各州郡的压力稍有缓解，但残余势力仍在暗中窥伺。",
        'captured_main_city': " 阁下收复重镇之举震动朝野，百姓夹道欢迎，江湖威望已达巅峰！",
        'first_winter': " 严冬将至，大雪封山，传闻北方势力正在囤积粮草，局势愈发扑朔迷离。"
    };

    /**
     * 触发江湖大事 (未来你可以一行调用这个)
     * @param {string} eventId 事件 ID
     */
    static triggerEvent(eventId) {
        if (this.EVENT_EXTENSIONS[eventId]) {
            this.worldEvents.add(eventId);
            console.log(`%c[江湖大事记] 触发事件: ${eventId}`, "color: #d4af37; font-weight: bold");
        }
    }

    /**
     * 获取当前的江湖局势描述
     * @param {string} difficulty 难度 ID
     * @param {number} year 当前年份
     * @param {string} season 当前季节
     * @returns {string} 局势描述文案
     */
    static getSituationDescription(difficulty, year, season) {
        let desc = this.DIFFICULTY_DESCRIPTIONS[difficulty] || this.DIFFICULTY_DESCRIPTIONS['easy'];
        
        // 自动追加已发生的事件文案
        this.worldEvents.forEach(eventId => {
            desc += this.EVENT_EXTENSIONS[eventId] || "";
        });

        // 也可以保留基于时间/季节的自动逻辑
        if (year >= 5 && !this.worldEvents.has('time_passed_long')) {
            desc += " 战事已延绵数载，双方皆显疲态，决定性的转折或许就在当下。";
        }
        
        return desc;
    }
}
