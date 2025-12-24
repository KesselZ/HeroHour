import * as THREE from 'three';

/**
 * 核心资源注册表
 * 集中管理所有精灵图的路径、网格尺寸、坐标及默认缩放
 */
export const ASSET_REGISTRY = {
    SHEETS: {
        CHARS1: '/assets/character.png',
        CHARS2: '/assets/character2.png',
        CHARS3: '/assets/character3.png',
        ITEMS: '/assets/items.png',
        ENEMY: '/assets/enemy.png' // 新增野怪图集
    },
    UNITS: {
        // 主角
        'qijin': { sheet: 'CHARS3', rows: 4, cols: 4, r: 3, c: 4, scale: 1.4, defaultFacing: 'left' },
        'lichengen': { sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 2, scale: 1.4, defaultFacing: 'right' },
        
        // 环境与建筑
        'main_city': { sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 2, scale: 4.0 }, 
        'gold_pile': { sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 4, scale: 1.2 },
        'items': { sheet: 'ITEMS', rows: 4, cols: 4, r: 1, c: 1, scale: 1.2 },

        // --- 野怪系列 (基于 enemy.png 4x4 网格) ---
        // 第一行：野生动物
        'wild_boar': { sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 1, scale: 1.3 },
        'wolf':      { sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 2, scale: 1.3 },
        'tiger':     { sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 3, scale: 1.6 },
        'bear':      { sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 4, scale: 1.8 },

        // 第二行：山贼与叛军
        'bandit':        { sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 1, scale: 1.4 },
        'bandit_archer': { sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4 },
        'rebel_soldier': { sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4 },
        'rebel_axeman':  { sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4 },

        // 第三行：杂物与毒虫
        'snake':    { sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 1, scale: 1.0 },
        'bats':     { sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 2, scale: 1.2 },
        'deer':     { sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 3, scale: 1.3 },
        'pheasant': { sheet: 'ENEMY', rows: 4, cols: 4, r: 3, c: 4, scale: 1.0 },

        // 第四行：精英与特殊
        'assassin_monk': { sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4 },
        'zombie':        { sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 2, scale: 1.4 },
        'heavy_knight':  { sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 3, scale: 1.6 },
        'shadow_ninja':  { sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 4, scale: 1.4 },

        // 旧映射兼容重定向 (用于平滑过渡)
        'wild_beast':   { sheet: 'ENEMY', rows: 4, cols: 4, r: 1, c: 3, scale: 1.6 }, // 指向老虎
        'rebel_flag':   { sheet: 'ENEMY', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4 }, // 指向叛军甲兵
        'sword_master': { sheet: 'ENEMY', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4 }, // 指向刺客武僧

        // 兵种 (局内战斗单位)
        'melee': { sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 1, scale: 1.4, defaultFacing: 'right' },
        'ranged': { sheet: 'CHARS1', rows: 4, cols: 4, r: 4, c: 1, scale: 1.4, defaultFacing: 'right' },
        'tiance': { sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 2, scale: 1.4, defaultFacing: 'right' },
        'chunyang': { sheet: 'CHARS1', rows: 4, cols: 4, r: 1, c: 3, scale: 1.4, defaultFacing: 'right' },
        'archer': { sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 4, scale: 1.4, defaultFacing: 'left' },
        'healer': { sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 2, scale: 1.4, defaultFacing: 'right' },
        'cangjian': { sheet: 'CHARS1', rows: 4, cols: 4, r: 2, c: 3, scale: 1.4, defaultFacing: 'right' },
        'cangyun': { sheet: 'CHARS1', rows: 4, cols: 4, r: 3, c: 3, scale: 1.4, defaultFacing: 'right' }
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
        texture.needsUpdate = true;
        texture.repeat.set(1 / cols, 1 / rows);
        texture.offset.set((c - 1) / cols, (rows - r) / rows);

        return new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true, 
            alphaTest: 0.5, // 提高阈值，消除半透明像素，让边缘锐利
            depthWrite: true // 开启深度写入，让角色看起来更厚实，解决相互遮挡时的透明感
        });
    }

    createUnitSprite(key) {
        const config = ASSET_REGISTRY.UNITS[key];
        const material = this.getMaterial(key);
        const sprite = new THREE.Sprite(material);
        const s = config ? config.scale : 1.4;
        sprite.scale.set(s, s, 1);
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

    load() { return Promise.resolve(); }

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
