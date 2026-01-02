import * as THREE from 'three';
import { resourcePreloader } from './ResourcePreloader.js';

/**
 * 核心资源注册表
 * 集中管理所有精灵图的路径、网格尺寸、坐标及默认缩放
 */
export const ASSET_REGISTRY = {
    SHEETS: {
        CHARS1: '/assets/characters/character.png',
        CHARS2: '/assets/characters/character2.png',
        CHARS3: '/assets/characters/character3.png',
        ITEMS: '/assets/items/items.png',
        ITEMS2: '/assets/items/items2.png',
        ENEMY: '/assets/enemies/enemy.png',
        ENEMY3: '/assets/enemies/enemy3.png',
        ENEMY4: '/assets/enemies/enemy4.png',
        ENEMY5: '/assets/enemies/enemy5.png',
        SKILL1: '/assets/skills/skill.png',
        SKILL2: '/assets/skills/skill2.png',
        SKILL3: '/assets/skills/skill3.png',
        SKILL4: '/assets/skills/skill4.png',
        SKILL5: '/assets/skills/skill5.png',
        SKILL6: '/assets/skills/skill6.png',
        SKILL7: '/assets/skills/skill7.png',
        SKILL8: '/assets/skills/skill8.png',
        TALENT1: '/assets/talents/talent.png',
        TALENT2: '/assets/talents/talent2.png',
        TALENT3: '/assets/talents/talent3.png',
        TALENT4: '/assets/talents/talent4.png',
        TALENT5: '/assets/talents/talent5.png',
        TALENT6: '/assets/talents/talent6.png',
        TALENT_TIANCE: '/assets/talents/talent_tiance.png',
        TALENT_TIANCE2: '/assets/talents/talent_tiance2.png',
        BUILDING2: '/assets/buildings/building2.png',
        BUILDING3: '/assets/buildings/building3.png',
        CHUNYANG: '/assets/characters/chunyang.png',
        CHUNYANG2: '/assets/characters/chunyang2.png',
        CHUNYANG3: '/assets/characters/chunyang3.png',
        CANGJIAN: '/assets/characters/cangjian.png',
        CANGJIAN2: '/assets/characters/cangjian2.png',
        CANGJIAN3: '/assets/characters/cangjian3.png',
        TIANCE: '/assets/characters/tiance.png',
        TIANCE2: '/assets/characters/tiance2.png',
        TIANCE3: '/assets/characters/tiance3.png',
        TIANCE4: '/assets/characters/tiance4.png'
    },
    UNITS: {
        // --- 技能图标 (Skill Icons) ---
        // skill.png 第一行
        'skill_zhenshanhe':   { name: '镇山河图标', sheet: 'SKILL1', rows: 4, cols: 4, r: 1, c: 1 },
        'skill_fenglaiwushan': { name: '风来吴山图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 4, c: 1 },
        'skill_hanrulei':      { name: '撼如雷图标', sheet: 'SKILL3', rows: 4, cols: 4, r: 4, c: 4 },
        
        // skill2.png 第一行
        'skill_wanjiangui_zong': { name: '五方行尽图标', sheet: 'SKILL2', rows: 4, cols: 4, r: 1, c: 1 },
        'skill_liuhe':           { name: '六合独尊图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 1, c: 2 },
        'skill_quanningyue':     { name: '泉凝月图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 1, c: 1 },
        'skill_shengtaiji':      { name: '生太极图标', sheet: 'SKILL2', rows: 4, cols: 4, r: 1, c: 3 },
        'skill_jijieling':       { name: '集结令图标', sheet: 'SKILL3', rows: 4, cols: 4, r: 2, c: 1 }, 
        'skill_tunriyue':        { name: '吞日月图标', sheet: 'SKILL2', rows: 4, cols: 4, r: 3, c: 4 },
        'skill_sixiang':         { name: '四象轮回图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 2, c: 3 },
        'skill_liangyi':         { name: '两仪化形图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 4, c: 3 },
        'skill_wanshi':          { name: '万世不竭图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 3, c: 3 },
        'skill_huasanqing':      { name: '化三清图标', sheet: 'SKILL8', rows: 4, cols: 4, r: 3, c: 1 },
        'skill_sanqing_huashen': { name: '三清化神图标', sheet: 'SKILL8', rows: 4, cols: 4, r: 3, c: 2 },
        'skill_hegui':           { name: '鹤归孤山图标', sheet: 'SKILL5', rows: 4, cols: 4, r: 2, c: 2 },
        'skill_fengcha':         { name: '峰插云景图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 1, c: 3 },
        'skill_songshe':         { name: '松舍问霞图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 2, c: 3 },
        'skill_yingmingliu':     { name: '莺鸣柳图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 3, c: 3 },
        'skill_mengquan':        { name: '梦泉虎跑图标', sheet: 'SKILL5', rows: 4, cols: 4, r: 4, c: 4 },
        'skill_pinghu':          { name: '平湖断月图标', sheet: 'SKILL5', rows: 4, cols: 4, r: 1, c: 1 },

        // skill4.png 天策系列
        'skill_renchicheng': { name: '任驰骋图标', sheet: 'SKILL4', rows: 4, cols: 4, r: 1, c: 1 },
        'skill_shourushan': { name: '守如山图标', sheet: 'SKILL4', rows: 4, cols: 4, r: 1, c: 2 },
        'skill_zhanbafang': { name: '战八方图标', sheet: 'SKILL4', rows: 4, cols: 4, r: 1, c: 3 },
        'skill_xiaoruhu': { name: '啸如虎图标', sheet: 'SKILL3', rows: 4, cols: 4, r: 4, c: 2 },
        'skill_pochongwei': { name: '破重围图标', sheet: 'SKILL4', rows: 4, cols: 4, r: 3, c: 3 },
        'skill_tu': { name: '突图标', sheet: 'SKILL4', rows: 4, cols: 4, r: 2, c: 1 },

        // --- 主角 ---
        'liwangsheng': { name: '李忘生', sheet: 'CHUNYANG3', rows: 4, cols: 4, r: 3, c: 1, scale: 1.4, defaultFacing: 'right' },
        'lichengen': { name: '李承恩', sheet: 'TIANCE4', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'right' },
        'yeying': { name: '叶英', sheet: 'CANGJIAN', rows: 4, cols: 4, r: 3, c: 3, scale: 1.4, defaultFacing: 'right' },
        
        // --- 环境与建筑 ---
        'main_city': { name: '主城', sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 2, scale: 4.0 }, 
        'gold_pile': { name: '金币堆', sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 4, scale: 1.2 },
        'items': { name: '物品堆', sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 1, scale: 1.2 },
        'tree': { name: '阔叶树', sheet: 'ITEMS', rows: 4, cols: 4, r: 3, c: 1, scale: 2.5 },
        'chest': { name: '宝箱', sheet: 'ITEMS', rows: 4, cols: 4, r: 3, c: 3, scale: 1.2 },
        'boxes': { name: '木箱堆', sheet: 'ITEMS', rows: 4, cols: 4, r: 2, c: 4, scale: 1.5 },
        'mine': { name: '矿洞', sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 3, scale: 3.0 },

        // --- items2.png 系列 ---
        'wood_small': { name: '小堆木材', sheet: 'ITEMS2', rows: 4, cols: 4, r: 1, c: 3, scale: 1.2 },
        'wood_large': { name: '大堆木材', sheet: 'ITEMS2', rows: 4, cols: 4, r: 1, c: 4, scale: 1.5 },
        'house_1': { name: '民居一', sheet: 'ITEMS2', rows: 4, cols: 4, r: 3, c: 1, scale: 3.0 },
        'house_2': { name: '民居二', sheet: 'ITEMS2', rows: 4, cols: 4, r: 3, c: 2, scale: 3.0 },
        'house_3': { name: '民居三', sheet: 'ITEMS2', rows: 4, cols: 4, r: 3, c: 3, scale: 3.0 },
        'gold_mine_world': { name: '金矿', sheet: 'ITEMS2', rows: 4, cols: 4, r: 1, c: 1, scale: 3.5 },
        'wood_pile': { name: '木材堆', sheet: 'ITEMS2', rows: 4, cols: 4, r: 1, c: 4, scale: 1.5 },
        'sawmill_world': { name: '伐木场', sheet: 'BUILDING3', rows: 4, cols: 4, r: 1, c: 1, scale: 3.5 },
        'dummy_training': { name: '演武木人', sheet: 'ITEMS2', rows: 4, cols: 4, r: 2, c: 3, scale: 1.2 },

        // --- building3.png 系列 (扩展建筑库V2) ---
        'sawmill_v3': { name: '伐木场', sheet: 'BUILDING3', rows: 4, cols: 4, r: 1, c: 1, scale: 3.5 },
        'training_yard_v3': { name: '校场', sheet: 'BUILDING3', rows: 4, cols: 4, r: 1, c: 2, scale: 3.5 },
        'sect_chunyang_v3': { name: '两仪阁', sheet: 'BUILDING3', rows: 4, cols: 4, r: 1, c: 3, scale: 3.5 },
        'sect_cangjian_v3': { name: '问水阁', sheet: 'BUILDING3', rows: 4, cols: 4, r: 1, c: 4, scale: 3.5 },
        
        'clinic_v3': { name: '医馆', sheet: 'BUILDING3', rows: 4, cols: 4, r: 2, c: 1, scale: 3.5 },
        'library_v3': { name: '藏经阁', sheet: 'BUILDING3', rows: 4, cols: 4, r: 2, c: 2, scale: 3.5 },
        'bell_tower_v3': { name: '钟楼', sheet: 'BUILDING3', rows: 4, cols: 4, r: 2, c: 3, scale: 3.5 },
        'gate_fortress_v3': { name: '关隘', sheet: 'BUILDING3', rows: 4, cols: 4, r: 2, c: 4, scale: 3.5 },
        
        'tea_pavilion_v3': { name: '茶室', sheet: 'BUILDING3', rows: 4, cols: 4, r: 3, c: 1, scale: 3.5 },
        'watchtower_fire_v3': { name: '烽火台', sheet: 'BUILDING3', rows: 4, cols: 4, r: 3, c: 2, scale: 3.5 },
        'mansion_v3': { name: '官邸', sheet: 'BUILDING3', rows: 4, cols: 4, r: 3, c: 3, scale: 3.5 },
        'storage_v3': { name: '仓库', sheet: 'BUILDING3', rows: 4, cols: 4, r: 3, c: 4, scale: 3.5 },
        
        'altar_v3': { name: '祭坛', sheet: 'BUILDING3', rows: 4, cols: 4, r: 4, c: 1, scale: 3.5 },
        'bridge_v3': { name: '石桥', sheet: 'BUILDING3', rows: 4, cols: 4, r: 4, c: 2, scale: 3.5 },
        'blacksmith_v3': { name: '铁匠铺', sheet: 'BUILDING3', rows: 4, cols: 4, r: 4, c: 3, scale: 3.5 },
        'thatched_hut_v3': { name: '草屋', sheet: 'BUILDING3', rows: 4, cols: 4, r: 4, c: 4, scale: 3.5 },

        // --- 奇穴节点 (Talent Nodes) ---
        // 商道系列 (TALENT1)
        'talent_gold_base': { name: '生财有道', sheet: 'TALENT3', rows: 4, cols: 4, r: 2, c: 2 },
        'talent_loot':      { name: '赏金猎人', sheet: 'TALENT3', rows: 4, cols: 4, r: 3, c: 2 },
        'talent_wood':      { name: '以物易物', sheet: 'TALENT1', rows: 4, cols: 4, r: 1, c: 3 },
        'talent_monopoly':  { name: '资源垄断', sheet: 'TALENT1', rows: 4, cols: 4, r: 2, c: 1 },

        // 武道/演武系列 (TALENT2)
        'talent_spell_power': { name: '功法提升', sheet: 'TALENT2', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_combo':       { name: '连招联动', sheet: 'TALENT2', rows: 4, cols: 4, r: 1, c: 2 },
        'talent_mp':          { name: '内力根基', sheet: 'TALENT2', rows: 4, cols: 4, r: 1, c: 3 },
        'talent_spell_epic':  { name: '功参造化', sheet: 'TALENT2', rows: 4, cols: 4, r: 2, c: 1 },
        'talent_chunyang_duration': { name: '气场时长', sheet: 'TALENT2', rows: 4, cols: 4, r: 2, c: 2 },
        'talent_chunyang_radius':   { name: '气场范围', sheet: 'TALENT2', rows: 4, cols: 4, r: 2, c: 3 },
        'talent_chunyang_huasanqing': { name: '化三清强化', sheet: 'TALENT2', rows: 4, cols: 4, r: 2, c: 4 },

        // 将道/兵流系列 (TALENT3)
        'talent_army_hp':   { name: '军队气血', sheet: 'TALENT3', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_army_def':  { name: '军队防御', sheet: 'TALENT3', rows: 4, cols: 4, r: 1, c: 2 },
        'talent_elite_cost': { name: '精锐减费', sheet: 'TALENT3', rows: 4, cols: 4, r: 1, c: 3 },
        'talent_martyrdom':  { name: '哀兵存续', sheet: 'TALENT3', rows: 4, cols: 4, r: 2, c: 1 },

        // 侠道/游历系列 (TALENT4)
        'talent_world_speed': { name: '地图神行', sheet: 'TALENT4', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_mp_regen':    { name: '内力恢复', sheet: 'TALENT4', rows: 4, cols: 4, r: 1, c: 2 },
        'talent_reveal':      { name: '迷雾揭开', sheet: 'TALENT4', rows: 4, cols: 4, r: 1, c: 3 },

        // 基础属性与爆发 (TALENT5 & TALENT6)
        'talent_power':       { name: '力道提升', sheet: 'TALENT5', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_haste':       { name: '加速调息', sheet: 'TALENT6', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_leadership':  { name: '统御大旗', sheet: 'TALENT5', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_power_epic':  { name: '惊世神力', sheet: 'TALENT1', rows: 4, cols: 4, r: 1, c: 2 },
        'talent_haste_epic':  { name: '迅疾如风', sheet: 'TALENT6', rows: 4, cols: 4, r: 2, c: 1 },

        // 天策专属系列 (TALENT_TIANCE)
        'talent_tiance_sweep':    { name: '横扫图标', sheet: 'TALENT_TIANCE', rows: 4, cols: 4, r: 1, c: 1 },
        'talent_tiance_cavalry':  { name: '骑兵图标', sheet: 'TALENT_TIANCE', rows: 4, cols: 4, r: 1, c: 2 },
        'talent_tiance_tu':       { name: '奔雷枪术', sheet: 'TALENT_TIANCE2', rows: 4, cols: 4, r: 1, c: 3 },
        'talent_tiance_monarch':  { name: '王者之气', sheet: 'TALENT_TIANCE2', rows: 4, cols: 4, r: 3, c: 1 },
        'talent_tiance_bleeding': { name: '龙牙图标', sheet: 'TALENT_TIANCE', rows: 4, cols: 4, r: 1, c: 4 },

        // 藏剑专属
        'talent_cangjian_fengming': { name: '凤鸣图标', sheet: 'SKILL5', rows: 4, cols: 4, r: 3, c: 1 }, 
        'talent_cangjian_shield':   { name: '映波锁澜图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 1, c: 1 }, // 借用泉凝月图标
        'talent_cangjian_burst':    { name: '莺鸣柳浪图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 4, c: 3 }, 
        'talent_cangjian_jump':     { name: '层云图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 4, c: 2 }, 
        
        // --- 核心节点占位符 (如果需要) ---
        'talent_core': { name: '核心', sheet: 'TALENT4', rows: 4, cols: 4, r: 4, c: 4 },

        // --- 职业中心节点图标 (Hero Core Icons) ---
        'core_liwangsheng':   { name: '纯阳核心', sheet: 'TALENT5', rows: 4, cols: 4, r: 2, c: 1 },
        'core_yeying':  { name: '藏剑核心', sheet: 'SKILL6',  rows: 4, cols: 4, r: 3, c: 2 },
        'core_tiance':  { name: '天策核心', sheet: 'SKILL4',  rows: 4, cols: 4, r: 1, c: 4 },

        // --- building2.png 系列 (扩展建筑库) ---
        'sawmill_v2': { name: '伐木工坊', sheet: 'BUILDING3', rows: 4, cols: 4, r: 1, c: 1, scale: 3.0 },
        'gold_mine_v2': { name: '露天金矿', sheet: 'BUILDING2', rows: 4, cols: 4, r: 1, c: 2, scale: 3.0 },
        'spell_altar_v2': { name: '功法祭坛V2', sheet: 'BUILDING2', rows: 4, cols: 4, r: 1, c: 4, scale: 3.0 },
        
        'pagoda_library': { name: '万文阁', sheet: 'BUILDING2', rows: 4, cols: 4, r: 2, c: 1, scale: 3.5 },
        'training_camp': { name: '演武校场', sheet: 'BUILDING2', rows: 4, cols: 4, r: 2, c: 4, scale: 3.5 },
        
        'weapon_forge_v2': { name: '神兵铸坊', sheet: 'BUILDING2', rows: 4, cols: 4, r: 3, c: 1, scale: 3.0 },
        'imperial_treasury': { name: '大唐内库', sheet: 'BUILDING2', rows: 4, cols: 4, r: 3, c: 4, scale: 3.5 },
        
        'merchant_guild': { name: '九州商行', sheet: 'BUILDING2', rows: 4, cols: 4, r: 4, c: 1, scale: 3.0 },
        'treasure_pavilion_v2': { name: '藏宝阁', sheet: 'BUILDING2', rows: 4, cols: 4, r: 4, c: 2, scale: 3.0 },
        'distillery_v2': { name: '杜康酒坊', sheet: 'BUILDING2', rows: 4, cols: 4, r: 4, c: 3, scale: 3.0 },
        'herbalist_garden': { name: '百草园', sheet: 'BUILDING2', rows: 4, cols: 4, r: 4, c: 4, scale: 3.0 },

        // --- 野怪系列 (基于 enemy.png 4x4 网格) ---
        // 第一行：野生动物
        'wild_boar': { name: '野猪', sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 1, scale: 1.3 },
        'wolf':      { name: '野狼', sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 2, scale: 1.3 },
        'tiger':     { name: '猛虎', sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 3, scale: 1.6 },
        'bear':      { name: '黑熊', sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 4, scale: 1.8 },

        // 第二行：山贼与叛军
        'bandit':        { name: '山贼刀匪', sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 1, scale: 1.4, defaultFacing: 'left' },
        'bandit_archer': { name: '山贼弩匪', sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4, defaultFacing: 'right' },
        'rebel_soldier': { name: '叛军甲兵', sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'left' },
        'rebel_axeman':  { name: '叛军斧兵', sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'left' },

        // 第三行：杂物与毒虫
        'snake':    { name: '毒蛇', sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 1, scale: 1.0, defaultFacing: 'right' },
        'bats':     { name: '蝙蝠群', sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 2, scale: 1.2, defaultFacing: 'left' },
        'deer':     { name: '林间小鹿', sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 3, scale: 1.3, defaultFacing: 'right' },
        'pheasant': { name: '山鸡', sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 4, scale: 1.0, defaultFacing: 'right' },

        // 第行：精英与特殊
        'assassin_monk': { name: '苦修刺客', sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4, defaultFacing: 'right' },
        'zombie':        { name: '毒尸傀儡', sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 2, scale: 1.4, defaultFacing: 'right' },
        'heavy_knight':  { name: '铁浮屠重骑', sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 3, scale: 1.6, defaultFacing: 'right' },
        'shadow_ninja':  { name: '隐之影', sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 4, scale: 1.4, defaultFacing: 'right' },

        // --- 天一教 (ENEMY4) ---
        'tianyi_guard': { name: '天一教卫', sheet: 'ENEMY4', rows: 4, cols: 4, r: 2, c: 1, scale: 1.4, defaultFacing: 'right' },
        'tianyi_crossbowman': { name: '天一弩手', sheet: 'ENEMY4', rows: 4, cols: 4, r: 1, c: 1, scale: 1.4, defaultFacing: 'left' },
        'tianyi_apothecary': { name: '天一药师', sheet: 'ENEMY4', rows: 4, cols: 4, r: 1, c: 3, scale: 1.4, defaultFacing: 'left' },
        'tianyi_venom_zombie': { name: '天一毒尸', sheet: 'ENEMY4', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4, defaultFacing: 'left' },
        'tianyi_priest': { name: '天一祭司', sheet: 'ENEMY4', rows: 4, cols: 4, r: 3, c: 1, scale: 1.5, defaultFacing: 'left' },
        'tianyi_abomination': { name: '缝合巨怪', sheet: 'ENEMY4', rows: 4, cols: 4, r: 3, c: 3, scale: 2.2, defaultFacing: 'left' },
        'tianyi_elder': { name: '天一长老', sheet: 'ENEMY4', rows: 4, cols: 4, r: 4, c: 1, scale: 1.6, defaultFacing: 'left' },
        'tianyi_shadow_guard': { name: '天一影卫', sheet: 'ENEMY4', rows: 4, cols: 4, r: 4, c: 2, scale: 1.4, defaultFacing: 'left' },

        // --- 神策军 (ENEMY3) ---
        'shence_infantry': { name: '神策步兵', sheet: 'ENEMY3', rows: 4, cols: 4, r: 1, c: 2, scale: 1.4, defaultFacing: 'left' },
        'shence_shieldguard': { name: '神策盾卫', sheet: 'ENEMY3', rows: 4, cols: 4, r: 1, c: 3, scale: 1.5, defaultFacing: 'left' },
        'shence_crossbowman': { name: '神策弩手', sheet: 'ENEMY3', rows: 4, cols: 4, r: 2, c: 1, scale: 1.4, defaultFacing: 'right' },
        'shence_bannerman': { name: '神策旗手', sheet: 'ENEMY3', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'left' },
        'shence_cavalry': { name: '神策精骑', sheet: 'ENEMY3', rows: 4, cols: 4, r: 3, c: 1, scale: 1.6, defaultFacing: 'left' },
        'shence_overseer': { name: '神策督军', sheet: 'ENEMY3', rows: 4, cols: 4, r: 2, c: 3, scale: 1.6, defaultFacing: 'left' },
        'shence_assassin': { name: '神策暗刺', sheet: 'ENEMY3', rows: 4, cols: 4, r: 3, c: 3, scale: 1.4, defaultFacing: 'left' },
        'shence_iron_pagoda': { name: '铁甲神策', sheet: 'ENEMY3', rows: 4, cols: 4, r: 4, c: 3, scale: 2.0, defaultFacing: 'left' },

        // --- 红衣教 (ENEMY5) ---
        'red_cult_priestess': { name: '红衣祭司', sheet: 'ENEMY5', rows: 4, cols: 4, r: 1, c: 1, scale: 1.4, defaultFacing: 'right' },
        'red_cult_high_priestess': { name: '红衣圣女', sheet: 'ENEMY5', rows: 4, cols: 4, r: 1, c: 4, scale: 1.6, defaultFacing: 'right' },
        'red_cult_enforcer': { name: '红衣武者', sheet: 'ENEMY5', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4, defaultFacing: 'right' },
        'red_cult_swordsman': { name: '红衣剑卫', sheet: 'ENEMY5', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'right' },
        'red_cult_archer': { name: '红衣弩手', sheet: 'ENEMY5', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'right' },
        'red_cult_assassin': { name: '红衣暗刺', sheet: 'ENEMY5', rows: 4, cols: 4, r: 3, c: 2, scale: 1.4, defaultFacing: 'right' },
        'red_cult_firemage': { name: '红衣法师', sheet: 'ENEMY5', rows: 4, cols: 4, r: 3, c: 3, scale: 1.4, defaultFacing: 'right' },
        'red_cult_executioner': { name: '红衣惩戒者', sheet: 'ENEMY5', rows: 4, cols: 4, r: 3, c: 4, scale: 1.5, defaultFacing: 'right' },
        'red_cult_acolyte': { name: '红衣教众', sheet: 'ENEMY5', rows: 4, cols: 4, r: 4, c: 2, scale: 1.4, defaultFacing: 'right' },

        // --- 局内战斗单位 (兵种) ---
        'melee':    { name: '天策弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 1, scale: 1.4, defaultFacing: 'right' },
        'ranged':   { name: '长歌弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4, defaultFacing: 'right' },
        'tiance':   { name: '天策骑兵', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 2, scale: 1.4, defaultFacing: 'right' },
        'chunyang': { name: '纯阳弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 3, scale: 1.4, defaultFacing: 'right' },
        'archer':   { name: '唐门射手', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'left' },
        'healer':   { name: '万花补给', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4, defaultFacing: 'right' },
        'cangjian': { name: '藏剑弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'right' },
        'cangyun':  { name: '苍云将士', sheet: 'CHARS1', rows: 4, cols: 4, r: 3, c: 3, scale: 1.4, defaultFacing: 'right' },

        // --- 藏剑扩充势力单位 ---
        'cj_retainer': { name: '藏剑入门弟子', sheet: 'CANGJIAN', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4, defaultFacing: 'right' },
        'cj_wenshui':  { name: '问水剑客', sheet: 'CANGJIAN3', rows: 4, cols: 4, r: 1, c: 1, scale: 1.4, defaultFacing: 'right' },
        'cj_shanju':   { name: '山居力士', sheet: 'CANGJIAN2', rows: 4, cols: 4, r: 2, c: 3, scale: 1.5, defaultFacing: 'right' },
        'cj_xinjian':  { name: '灵峰侍剑师', sheet: 'CANGJIAN2', rows: 4, cols: 4, r: 3, c: 2, scale: 1.4, defaultFacing: 'right' },
        'cj_golden_guard': { name: '黄金剑卫', sheet: 'CANGJIAN', rows: 4, cols: 4, r: 2, c: 4, scale: 1.5, defaultFacing: 'right' },
        'cj_elder':    { name: '剑庐大长老', sheet: 'CANGJIAN', rows: 4, cols: 4, r: 1, c: 1, scale: 1.6, defaultFacing: 'right' },

        // --- 新增纯阳势力单位 ---
        'cy_twin_blade': { name: '双剑剑宗精锐', sheet: 'CHUNYANG2', rows: 4, cols: 4, r: 1, c: 4, scale: 1.4, defaultFacing: 'right' },
        'cy_sword_array': { name: '玄门阵法师', sheet: 'CHUNYANG', rows: 4, cols: 4, r: 2, c: 4, scale: 1.5, defaultFacing: 'right' },
        'cy_zixia_disciple': { name: '紫霞功真传弟子', sheet: 'CHUNYANG3', rows: 4, cols: 4, r: 3, c: 1, scale: 1.4, defaultFacing: 'right' },
        'cy_taixu_disciple': { name: '太虚剑意真传弟子', sheet: 'CHUNYANG3', rows: 4, cols: 4, r: 2, c: 1, scale: 1.5, defaultFacing: 'right' },

        // --- 天策扩充势力单位 ---
        'tc_crossbow': { name: '天策羽林弩手', sheet: 'TIANCE', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'right' },
        'tc_banner': { name: '天策战旗使', sheet: 'TIANCE', rows: 4, cols: 4, r: 4, c: 2, scale: 1.4, defaultFacing: 'right' },
        'tc_dual_blade': { name: '天策双刃校尉', sheet: 'TIANCE3', rows: 4, cols: 4, r: 4, c: 4, scale: 1.4, defaultFacing: 'right' },
        'tc_halberdier': { name: '持戟中郎将', sheet: 'TIANCE', rows: 4, cols: 4, r: 1, c: 4, scale: 1.5, defaultFacing: 'right' },
        'tc_shield_vanguard': { name: '天策前锋', sheet: 'TIANCE', rows: 4, cols: 4, r: 4, c: 4, scale: 1.5, defaultFacing: 'right' },
        'tc_mounted_crossbow': { name: '骁骑弩手', sheet: 'TIANCE4', rows: 4, cols: 4, r: 2, c: 4, scale: 1.5, defaultFacing: 'right' },
        'tc_heavy_cavalry': { name: '玄甲陷阵骑', sheet: 'TIANCE4', rows: 4, cols: 4, r: 4, c: 3, scale: 1.7, defaultFacing: 'right' }
    }
};

class SpriteFactory {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.cache = new Map();
        this.isLoaded = true;
        this.cols = 4; // 向后兼容旧代码中的硬编码 cols
        this.rows = 4;
    }

    getMaterial(key) {
        const config = ASSET_REGISTRY.UNITS[key];
        if (!config) return new THREE.SpriteMaterial({ color: 0xff00ff });

        const { sheet, rows, cols, r, c } = config;
        const path = ASSET_REGISTRY.SHEETS[sheet];

        if (!this.cache.has(path)) {
            const texture = this.textureLoader.load(path);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace; // 关键：确保像素图颜色不失真、不泛白
            this.cache.set(path, texture);
        }

        const texture = this.cache.get(path).clone();
        texture.repeat.set(1 / cols, 1 / rows);
        texture.offset.set((c - 1) / cols, (rows - r) / rows);

        return new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true, 
            alphaTest: 0.5, // 提高阈值，消除半透明像素，让边缘锐利
            depthWrite: true // 开启深度写入，让角色看起来更厚实，解决相互遮挡时的透明感
        });
    }

    createUnitSprite(key, anchorY = 0.5) {
        const config = ASSET_REGISTRY.UNITS[key];
        const material = this.getMaterial(key);
        const sprite = new THREE.Sprite(material);
        const s = config ? config.scale : 1.4;
        sprite.scale.set(s, s, 1);
        // 恢复默认：除非指定，否则使用中心锚点 (0.5)
        sprite.center.set(0.5, anchorY); 
        return sprite;
    }

    /**
     * 创建一个 3D 网格对象 (用于建筑，固定垂直于地面，防止漂浮感)
     */
    createWorldMesh(key) {
        const config = ASSET_REGISTRY.UNITS[key];
        if (!config) return new THREE.Group();

        // 提取纹理和材质信息
        const spriteMat = this.getMaterial(key);
        const meshMat = new THREE.MeshStandardMaterial({
            map: spriteMat.map,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide // 双面可见
        });

        // 创建平面几何体
        const geometry = new THREE.PlaneGeometry(1, 1);
        // 关键：将几何体的中心平移到中心底部，这样 Mesh 的 position.y = 0 时，建筑正好踩在地上
        geometry.translate(0, 0.5, 0);

        const mesh = new THREE.Mesh(geometry, meshMat);
        const s = config.scale || 1.4;
        mesh.scale.set(s, s, 1);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    getIconStyle(key) {
        const config = ASSET_REGISTRY.UNITS[key];
        if (!config) return {};

        const { sheet, rows, cols, r, c } = config;
        const path = ASSET_REGISTRY.SHEETS[sheet];

        const xPercent = cols > 1 ? ((c - 1) / (cols - 1)) * 100 : 0;
        const yPercent = rows > 1 ? ((r - 1) / (rows - 1)) * 100 : 0;

        return {
            backgroundImage: `url('${path}')`,
            backgroundPosition: `${xPercent}% ${yPercent}%`,
            backgroundSize: `${cols * 100}% ${rows * 100}%`,
            imageRendering: 'pixelated',
            backgroundRepeat: 'no-repeat'
        };
    }

    /**
     * 预加载资源注册表中的所有贴图集
     * 现在会检查全局预加载器是否已经加载过资源
     */
    async load() {
        const paths = Object.values(ASSET_REGISTRY.SHEETS);
        const promises = paths.map(path => {
            if (this.cache.has(path)) return Promise.resolve(this.cache.get(path));

            // 检查全局预加载器是否已经加载过这个资源
            if (resourcePreloader.isImageLoaded(path)) {
                // 如果已经预加载过，直接创建纹理
                return new Promise((resolve) => {
                    this.textureLoader.load(path,
                        (texture) => {
                            texture.magFilter = THREE.NearestFilter;
                            texture.minFilter = THREE.NearestFilter;
                            texture.colorSpace = THREE.SRGBColorSpace;
                            this.cache.set(path, texture);
                            resolve(texture);
                        }
                    );
                });
            } else {
                // 正常加载流程
                return new Promise((resolve, reject) => {
                    this.textureLoader.load(path,
                        (texture) => {
                            texture.magFilter = THREE.NearestFilter;
                            texture.minFilter = THREE.NearestFilter;
                            texture.colorSpace = THREE.SRGBColorSpace;
                            this.cache.set(path, texture);
                            resolve(texture);
                        },
                        undefined,
                        (err) => {
                            console.error(`贴图加载失败: ${path}`, err);
                            reject(err);
                        }
                    );
                });
            }
        });

        try {
            await Promise.all(promises);
            this.isLoaded = true;
            console.log('%c[资源加载] %c所有贴图加载完成 (来自全局预加载)', 'color: #5b8a8a; font-weight: bold', 'color: #4CAF50');
        } catch (error) {
            console.error('资源预加载过程中出错:', error);
        }
    }

    /**
     * 关键：适配 Soldier.js 中对 unitConfig[type].row 和 .col 的访问
     */
    get unitConfig() {
        const legacyConfig = {};
        for (const key in ASSET_REGISTRY.UNITS) {
            const cfg = ASSET_REGISTRY.UNITS[key];
            legacyConfig[key] = {
                ...cfg,
                row: cfg.r, // 映射 r -> row
                col: cfg.c  // 映射 c -> col
            };
        }
        return legacyConfig;
    }
}

export const spriteFactory = new SpriteFactory();
