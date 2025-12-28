import * as THREE from 'three';

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
        SKILL1: '/assets/skills/skill.png',
        SKILL2: '/assets/skills/skill2.png',
        SKILL3: '/assets/skills/skill3.png',
        SKILL4: '/assets/skills/skill4.png',
        SKILL5: '/assets/skills/skill5.png',
        SKILL6: '/assets/skills/skill6.png',
        SKILL7: '/assets/skills/skill7.png',
        SKILL8: '/assets/skills/skill8.png',
        BUILDING2: '/assets/buildings/building2.png',
        BUILDING3: '/assets/buildings/building3.png'
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
        'skill_shengtaiji':      { name: '生太极图标', sheet: 'SKILL2', rows: 4, cols: 4, r: 1, c: 3 },
        'skill_jijieling':       { name: '集结令图标', sheet: 'SKILL3', rows: 4, cols: 4, r: 2, c: 1 }, 
        'skill_tunriyue':        { name: '吞日月图标', sheet: 'SKILL2', rows: 4, cols: 4, r: 3, c: 4 },
        'skill_sixiang':         { name: '四象轮回图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 2, c: 3 },
        'skill_liangyi':         { name: '两仪化形图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 4, c: 3 },
        'skill_wanshi':          { name: '万世不竭图标', sheet: 'SKILL7', rows: 4, cols: 4, r: 3, c: 3 },
        'skill_huasanqing':      { name: '化三清图标', sheet: 'SKILL8', rows: 4, cols: 4, r: 3, c: 1 },
        'skill_hegui':           { name: '鹤归孤山图标', sheet: 'SKILL5', rows: 4, cols: 4, r: 2, c: 2 },
        'skill_fengcha':         { name: '峰插云景图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 1, c: 3 },
        'skill_songshe':         { name: '松舍问霞图标', sheet: 'SKILL6', rows: 4, cols: 4, r: 2, c: 3 },
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
        'qijin': { name: '祁进', sheet: 'CHARS3', rows: 4, cols: 4, r: 3, c: 4, scale: 1.4, defaultFacing: 'left' },
        'lichengen': { name: '李承恩', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 2, scale: 1.4, defaultFacing: 'right' },
        'yeying': { name: '叶英', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'right' },
        
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
        'bandit':        { name: '山贼刀匪', sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 1, scale: 1.4, defaultFacing: 'right' },
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

        // --- 局内战斗单位 (兵种) ---
        'melee':    { name: '天策弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 1, scale: 1.4, defaultFacing: 'right' },
        'ranged':   { name: '长歌弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4, defaultFacing: 'right' },
        'tiance':   { name: '天策骑兵', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 2, scale: 1.4, defaultFacing: 'right' },
        'chunyang': { name: '纯阳弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 3, scale: 1.4, defaultFacing: 'right' },
        'archer':   { name: '唐门射手', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'left' },
        'healer':   { name: '万花补给', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4, defaultFacing: 'right' },
        'cangjian': { name: '藏剑弟子', sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'right' },
        'cangyun':  { name: '苍云将士', sheet: 'CHARS1', rows: 4, cols: 4, r: 3, c: 3, scale: 1.4, defaultFacing: 'right' }
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
     */
    async load() {
        const paths = Object.values(ASSET_REGISTRY.SHEETS);
        const promises = paths.map(path => {
            if (this.cache.has(path)) return Promise.resolve(this.cache.get(path));
            
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
        });

        try {
            await Promise.all(promises);
            this.isLoaded = true;
            console.log('%c[资源加载] %c所有贴图加载完成', 'color: #5b8a8a; font-weight: bold', 'color: #fff');
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
