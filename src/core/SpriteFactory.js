import * as THREE from 'three';

/**
 * 精灵图工厂
 * 负责解析新的 character.png 并提取指定的侠客
 */
class SpriteFactory {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.spriteSheet = null;
        this.isLoaded = false;
        
        // 4x4 网格配置
        this.rows = 4;
        this.cols = 4;
        
        // 侠客配置表：统一管理行列位置与初始面向
        this.unitConfig = {
            'melee': { row: 1, col: 1, defaultFacing: 'right' },
            'ranged': { row: 4, col: 1, defaultFacing: 'right' },
            'tiance': { row: 1, col: 2, defaultFacing: 'right' }, // 天策骑兵
            'chunyang': { row: 1, col: 3, defaultFacing: 'left' }, // 纯阳：修正面向为 left
            'archer': { row: 2, col: 4, defaultFacing: 'left' }, // 射手
            'healer': { row: 2, col: 2, defaultFacing: 'right' },
            'cangjian': { row: 2, col: 3, defaultFacing: 'right' },
            'cangyun': { row: 3, col: 3, defaultFacing: 'right' } // 苍云
        };
    }

    load() {
        return new Promise((resolve) => {
            // 切换到新的精灵图：character.png
            this.textureLoader.load('/assets/character.png', (texture) => {
                // 关键：保持像素感，不再有平滑/抗锯齿
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                
                // 设置纹理重复模式
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                
                this.spriteSheet = texture;
                this.isLoaded = true;
                console.log("新精灵图 character.png 加载完成 (无 Margin 模式)");
                resolve();
            });
        });
    }

    /**
     * 获取指定行列的材质
     * @param {number} row 行 (1-4)
     * @param {number} col 列 (1-4)
     */
    getMaterial(row, col) {
        if (!this.isLoaded) return new THREE.MeshStandardMaterial({ color: 0xff00ff });

        // 复制纹理以应用不同的 offset，确保每个 Sprite 独立
        const texture = this.spriteSheet.clone();
        texture.needsUpdate = true;

        // 计算缩放比例 (1/4)
        texture.repeat.set(1 / this.cols, 1 / this.rows);

        // 计算偏移量 (UV 原点在左下角)
        const offsetX = (col - 1) / this.cols;
        const offsetY = (this.rows - row) / this.rows;

        texture.offset.set(offsetX, offsetY);

        return new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1 // 针对无 margin 图片，alphaTest 设低一点确保边缘完整
        });
    }

    /**
     * 创建一个侠客 Sprite
     * @param {string} type 'melee' | 'ranged'
     */
    createUnitSprite(type) {
        const config = this.unitConfig[type] || this.unitConfig['melee'];
        const material = this.getMaterial(config.row, config.col);

        const sprite = new THREE.Sprite(material);
        // 调整缩放，使像素侠客在场景中比例协调
        sprite.scale.set(1.4, 1.4, 1); 
        return sprite;
    }
}

export const spriteFactory = new SpriteFactory();

