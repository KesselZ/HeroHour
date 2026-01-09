/**
 * 建筑全量注册表：定义所有建筑的元数据
 */
export const BUILDING_REGISTRY = {
    'town_hall': { name: '议政厅', category: 'economy', maxLevel: 4, icon: 'main_city', cost: { gold: 500, wood: 100 }, description: '大权统筹：提升每季度的税收金钱产出。', costGrowth: { type: 'exponential', factor: 1.8 } },
    'market': { name: '市场', category: 'economy', maxLevel: 10, icon: 'merchant_guild', cost: { gold: 250, wood: 150 }, description: '互通有无：提高城镇的金钱与木材产出效率。', costGrowth: { type: 'linear', increment: { gold: 250, wood: 150 } } },
    'inn': { name: '悦来客栈', category: 'economy', maxLevel: 3, icon: 'pagoda_library', cost: { gold: 800, wood: 400 }, description: '每级增加全军 10% 的阅历获取速度。', costGrowth: { type: 'exponential', factor: 1.6 } },
    'bank': { name: '大通钱庄', category: 'economy', maxLevel: 2, icon: 'imperial_treasury', cost: { gold: 500, wood: 800 }, description: '提升该城镇 15% 的金钱产出。', costGrowth: { type: 'exponential', factor: 2.5 } },
    'trade_post': { name: '马帮驿站', category: 'economy', maxLevel: 3, icon: 'distillery_v2', cost: { gold: 1000, wood: 600 }, description: '增加城镇木材产出，并降低全军招募成本 5%。', costGrowth: { type: 'linear', increment: { gold: 500, wood: 300 } } },
    
    // 军事建筑
    'barracks': { name: '兵营', category: 'military', maxLevel: 5, icon: 'melee', cost: { gold: 400, wood: 150 }, description: '解锁天策弟子与长歌弟子，随后每级增加全军天策弟子 10% 伤害与生命。', costGrowth: { type: 'linear', increment: { gold: 150, wood: 50 } } },
    'archery_range': { name: '靶场', category: 'military', maxLevel: 5, icon: 'archer', cost: { gold: 500, wood: 250 }, description: '解锁唐门射手，随后每级增加全军长歌弟子与唐门射手 10% 伤害与生命。', requirements: [{ id: 'barracks', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 200, wood: 100 } } },
    
    // 高级兵种建筑
    'medical_pavilion': { name: '万花医馆', category: 'military', maxLevel: 5, icon: 'healer', cost: { gold: 700, wood: 350 }, description: '解锁万花弟子，随后每级增加全军万花弟子 10% 疗效与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 300, wood: 150 } } },
    'martial_shrine': { name: '苍云讲武堂', category: 'military', maxLevel: 5, icon: 'cangyun', cost: { gold: 700, wood: 350 }, description: '解锁苍云将士，随后每级增加全军苍云将士 10% 伤害与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 300, wood: 150 } } },
    'mage_guild': { name: '纯阳道场', category: 'military', maxLevel: 5, icon: 'chunyang', cost: { gold: 600, wood: 300 }, description: '解锁纯阳弟子，随后每级增加全军纯阳弟子 10% 伤害与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 250, wood: 125 } } },
    'stable': { name: '天策马厩', category: 'military', maxLevel: 5, icon: 'tiance', cost: { gold: 1100, wood: 600 }, description: '解锁天策骑兵，随后每级增加全军天策骑兵 10% 伤害与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 500, wood: 300 } } },
    'sword_forge': { name: '藏剑剑庐', category: 'military', maxLevel: 5, icon: 'cangjian', cost: { gold: 800, wood: 400 }, description: '解锁藏剑弟子，随后每级增加全军藏剑弟子 10% 伤害与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 400, wood: 200 } } },
    
    // 纯阳高级兵种建筑
    'cy_array_pavilion': { name: '玄门阵亭', category: 'military', maxLevel: 5, icon: 'altar_v3', cost: { gold: 1200, wood: 600 }, description: '解锁【玄门阵法师】，随后每级增加全军玄门阵法师 10% 伤害与生命。', requirements: [{ id: 'mage_guild', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 600, wood: 300 } } },
    'cy_zixia_shrine': { name: '紫霞圣地', category: 'military', maxLevel: 5, icon: 'library_v3', cost: { gold: 1000, wood: 500 }, description: '解锁【紫霞功真传弟子】，随后每级增加全军紫霞功真传弟子 10% 伤害与生命。', requirements: [{ id: 'mage_guild', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 500, wood: 250 } } },
    'cy_field_shrine': { name: '气场圣殿', category: 'military', maxLevel: 5, icon: 'altar_v3', cost: { gold: 1300, wood: 700 }, description: '解锁【纯阳气场大师】，随后每级增加全军纯阳气场大师 10% 伤害与生命。', requirements: [{ id: 'cy_array_pavilion', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 650, wood: 350 } } },

    // 天策高级兵种建筑
    'tc_halberd_hall': { name: '骁骑营', category: 'military', maxLevel: 5, icon: 'training_yard_v3', cost: { gold: 900, wood: 450 }, description: '解锁【战旗使】与【持戟中郎将】，随后每级增加对应兵种 10% 伤害与生命。', requirements: [{ id: 'stable', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 450, wood: 225 } } },
    'tc_iron_camp': { name: '玄甲营', category: 'military', maxLevel: 5, icon: 'gate_fortress_v3', cost: { gold: 1500, wood: 800 }, description: '解锁【骁骑弩手】，随后每级增加其 10% 伤害与生命。', requirements: [{ id: 'tc_halberd_hall', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 800, wood: 400 } } },

    // 藏剑高级兵种建筑
    'cj_spirit_pavilion': { name: '灵峰剑阁', category: 'military', maxLevel: 5, icon: 'sect_cangjian_v3', cost: { gold: 1100, wood: 550 }, description: '解锁【灵峰侍剑师】，随后每级增加其 10% 伤害与生命。', requirements: [{ id: 'sword_forge', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 550, wood: 275 } } },
    'cj_golden_hall': { name: '黄金剑厅', category: 'military', maxLevel: 5, icon: 'blacksmith_v3', cost: { gold: 900, wood: 450 }, description: '解锁【黄金剑卫】，随后每级增加其 10% 伤害与生命。', requirements: [{ id: 'sword_forge', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 450, wood: 225 } } },

    // 特殊建筑
    'spell_altar': { name: '功法祭坛', category: 'magic', maxLevel: 3, icon: 'spell_altar_v2', cost: { gold: 1500, wood: 800 }, description: '博采众长：每级随机感悟全江湖招式。', costGrowth: { type: 'exponential', factor: 1.8 } },
    'treasure_pavilion': { name: '藏宝阁', category: 'economy', maxLevel: 1, icon: 'treasure_pavilion_v2', cost: { gold: 3000, wood: 1500 }, description: '琳琅满目：极其罕见的珍宝汇聚之地。', costGrowth: { type: 'constant' } },
    'clinic': { name: '医馆', category: 'magic', maxLevel: 3, icon: 'clinic_v3', cost: { gold: 300, wood: 550 }, description: '仁心仁术：战场上死去的士兵每级有 10% 概率伤愈归队，减少损耗。', costGrowth: { type: 'exponential', factor: 1.8 } },

    // 纯阳：招式研习
    'sect_chunyang_basic': { name: '两仪馆', category: 'magic', maxLevel: 2, icon: 'sect_chunyang_v3', cost: { gold: 400, wood: 200 }, description: '纯阳基础：感悟纯阳【初级】招式。', costGrowth: { type: 'constant' } },
    'sect_chunyang_advanced': { name: '太极殿', category: 'magic', maxLevel: 5, icon: 'sect_chunyang_v3', cost: { gold: 800, wood: 500 }, description: '纯阳进阶：感悟纯阳【高级】招式。', requirements: [{ id: 'sect_chunyang_basic', level: 1 }], costGrowth: { type: 'constant' } },
    'sect_chunyang_ultimate': { name: '纯阳宫', category: 'magic', maxLevel: 1, icon: 'sect_chunyang_v3', cost: { gold: 1500, wood: 1200 }, description: '纯阳绝学：感悟纯阳【绝技】招式。', requirements: [{ id: 'sect_chunyang_advanced', level: 1 }], costGrowth: { type: 'constant' } },

    // 天策：招式研习
    'sect_tiance_basic': { name: '演武场', category: 'magic', maxLevel: 2, icon: 'dummy_training', cost: { gold: 400, wood: 200 }, description: '天策基础：感悟天策【初级】招式。', costGrowth: { type: 'constant' } },
    'sect_tiance_advanced': { name: '凌烟阁', category: 'magic', maxLevel: 5, icon: 'dummy_training', cost: { gold: 800, wood: 500 }, description: '天策进阶：感悟天策【高级】招式。', requirements: [{ id: 'sect_tiance_basic', level: 1 }], costGrowth: { type: 'constant' } },
    'sect_tiance_ultimate': { name: '天策府', category: 'magic', maxLevel: 1, icon: 'dummy_training', cost: { gold: 1500, wood: 1200 }, description: '天策绝学：感悟天策【绝技】招式。', requirements: [{ id: 'sect_tiance_advanced', level: 1 }], costGrowth: { type: 'constant' } },

    // 藏剑：招式研习
    'sect_cangjian_basic': { name: '问水亭', category: 'magic', maxLevel: 2, icon: 'sect_cangjian_v3', cost: { gold: 400, wood: 200 }, description: '藏剑基础：感悟藏剑【初级】招式。', costGrowth: { type: 'constant' } },
    'sect_cangjian_advanced': { name: '山外山', category: 'magic', maxLevel: 5, icon: 'sect_cangjian_v3', cost: { gold: 800, wood: 500 }, description: '藏剑进阶：感悟藏剑【高级】招式。', requirements: [{ id: 'sect_cangjian_basic', level: 1 }], costGrowth: { type: 'constant' } },
    'sect_cangjian_ultimate': { name: '藏剑庐', category: 'magic', maxLevel: 1, icon: 'sect_cangjian_v3', cost: { gold: 1500, wood: 1200 }, description: '藏剑绝学：感悟藏剑【绝技】招式。', requirements: [{ id: 'sect_cangjian_advanced', level: 1 }], costGrowth: { type: 'constant' } }
};

/**
 * 门派蓝图：定义每个门派出身的城市所拥有的建筑列表
 */
export const BLUEPRINTS = {
    'chunyang': ['town_hall', 'market', 'inn', 'bank', 'trade_post', 'medical_pavilion', 'barracks', 'archery_range', 'stable', 'sword_forge', 'martial_shrine', 'mage_guild', 'spell_altar', 'sect_chunyang_basic', 'sect_chunyang_advanced', 'sect_chunyang_ultimate', 'clinic', 'cy_array_pavilion', 'cy_zixia_shrine', 'cy_field_shrine'],
    'tiance': ['town_hall', 'market', 'inn', 'bank', 'trade_post', 'barracks', 'archery_range', 'stable', 'sword_forge', 'martial_shrine', 'mage_guild', 'spell_altar', 'sect_tiance_basic', 'sect_tiance_advanced', 'sect_tiance_ultimate', 'medical_pavilion', 'clinic', 'tc_halberd_hall', 'tc_iron_camp'],
    'cangjian': ['town_hall', 'market', 'inn', 'bank', 'trade_post', 'barracks', 'archery_range', 'stable', 'sword_forge', 'martial_shrine', 'mage_guild', 'spell_altar', 'sect_cangjian_basic', 'sect_cangjian_advanced', 'sect_cangjian_ultimate', 'medical_pavilion', 'clinic', 'cj_spirit_pavilion', 'cj_golden_hall']
};

