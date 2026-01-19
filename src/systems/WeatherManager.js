import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

/**
 * WeatherManager: 负责主世界天气的视觉表现 (雨、雪等)
 * 采用粒子系统实现，并动态跟随摄像机，实现全图覆盖的假象
 */
export class WeatherManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.lastCameraPos = new THREE.Vector3(); // 记录上一帧摄像机位置
        
        this.type = 'none'; // 'none', 'rain', 'snow'
        this.particleSystem = null;
        this.particleGeometry = null;
        this.particleMaterial = null;
        
        this.particleCount = 4000; // 显著增加数量，支持更大范围
        this.range = 80; // 范围扩大到 80
        this.height = 30; // 高度增加到 30
        this.viewOffset = 15; // 视野中心偏移量：乌云向相机前方平移 15 个单位

        // 渐变控制 (当前活跃系统)
        this.currentOpacity = 0;
        this.targetOpacity = 0;
        this.fadeSpeed = 0.5; // 每秒透明度变化量
        this.isStopping = false;

        // 核心新增：遗留系统控制 (用于交叉淡化)
        this.oldSystem = null;
        this.oldMaterial = null;
        this.oldGeometry = null;
        this.oldOpacity = 0;
        this.oldType = 'none';
    }

    init(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.lastCameraPos.copy(camera.position);
        this.syncToStore();
    }

    syncToStore() {
        const nameMap = {
            'none': '晴',
            'rain': this.rainIntensity === 'light' ? '细雨' : '大雨',
            'snow': '瑞雪'
        };
        useGameStore.getState().updateWeather({
            type: this.type,
            intensity: this.rainIntensity || 'medium',
            name: nameMap[this.type] || '晴'
        });
    }

    /**
     * 开始下雨
     */
    setRain(intensity = 'medium') {
        // 如果已经是下雨且强度一致，则不重新创建
        if (this.type === 'rain' && this.rainIntensity === intensity && !this.isStopping) return;

        this.prepareTransition();
        this.type = 'rain';
        this.rainIntensity = intensity; 
        this.isStopping = false;
        
        this.syncToStore();
        
        let count = this.particleCount;
        let maxOpacity = 0.6; 
        let size = 0.25;   
        
        if (intensity === 'light') {
            count = Math.floor(this.particleCount * 0.4);
            maxOpacity = 0.45; 
            size = 0.2;
        }
        
        this.targetOpacity = maxOpacity;
        this.currentOpacity = 0; // 从 0 开始渐入

        const vertices = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * this.range;
            const y = Math.random() * this.height;
            const z = (Math.random() - 0.5) * this.range;
            vertices.push(x, y, z);
        }

        this.particleGeometry = new THREE.BufferGeometry();
        this.particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        this.particleMaterial = new THREE.PointsMaterial({
            color: 0x7799ff, 
            size: size,
            transparent: true,
            opacity: 0, 
            depthWrite: false,
            blending: THREE.NormalBlending
        });

        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.particleSystem);
    }

    /**
     * 开始下雪
     */
    setSnow() {
        if (this.type === 'snow' && !this.isStopping) return;

        this.prepareTransition();
        this.type = 'snow';
        this.isStopping = false;
        this.targetOpacity = 0.8;
        this.currentOpacity = 0;

        this.syncToStore();

        const vertices = [];
        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * this.range;
            const y = Math.random() * this.height;
            const z = (Math.random() - 0.5) * this.range;
            vertices.push(x, y, z);
        }

        this.particleGeometry = new THREE.BufferGeometry();
        this.particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        this.particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.particleSystem);
    }

    /**
     * 交叉淡化准备：将当前系统移入 oldSystem
     */
    prepareTransition() {
        if (this.particleSystem) {
            // 清理掉还在消失的更老的系统
            this.cleanupOld();
            
            this.oldSystem = this.particleSystem;
            this.oldMaterial = this.particleMaterial;
            this.oldGeometry = this.particleGeometry;
            this.oldOpacity = this.currentOpacity;
            this.oldType = this.type;
            this.oldRainIntensity = this.rainIntensity;

            this.particleSystem = null;
            this.particleMaterial = null;
            this.particleGeometry = null;
        }
    }

    /**
     * 停止所有天气 (带渐变)
     */
    stop() {
        this.targetOpacity = 0;
        this.isStopping = true;
        this.syncToStore();
    }

    cleanup() {
        this.cleanupOld();
        if (this.particleSystem) {
            this.scene.remove(this.particleSystem);
            this.particleGeometry.dispose();
            this.particleMaterial.dispose();
            this.particleSystem = null;
            this.type = 'none';
            this.syncToStore();
        }
    }

    cleanupOld() {
        if (this.oldSystem) {
            this.scene.remove(this.oldSystem);
            this.oldGeometry.dispose();
            this.oldMaterial.dispose();
            this.oldSystem = null;
            this.oldType = 'none';
        }
    }

    update(deltaTime) {
        if (!this.camera) return;

        // 1. 更新活跃系统渐变
        if (this.particleSystem && this.currentOpacity !== this.targetOpacity) {
            const step = this.fadeSpeed * deltaTime;
            if (this.currentOpacity < this.targetOpacity) {
                this.currentOpacity = Math.min(this.targetOpacity, this.currentOpacity + step);
            } else {
                this.currentOpacity = Math.max(this.targetOpacity, this.currentOpacity - step);
            }
            this.particleMaterial.opacity = this.currentOpacity;

            if (this.isStopping && this.currentOpacity <= 0) {
                this.cleanup();
            }
        }

        // 2. 更新遗留系统渐出
        if (this.oldSystem) {
            this.oldOpacity -= this.fadeSpeed * deltaTime;
            this.oldMaterial.opacity = Math.max(0, this.oldOpacity);
            if (this.oldOpacity <= 0) {
                this.cleanupOld();
            }
        }

        if (!this.particleSystem && !this.oldSystem) return;

        // 3. 计算摄像机位移增量
        const deltaCamX = this.camera.position.x - this.lastCameraPos.x;
        const deltaCamZ = this.camera.position.z - this.lastCameraPos.z;
        this.lastCameraPos.copy(this.camera.position);

        const forwardX = Math.sin(this.camera.rotation.y);
        const forwardZ = -Math.cos(this.camera.rotation.y);
        
        // 4. 更新活跃系统粒子
        if (this.particleSystem) {
            this._updateSystem(this.particleSystem, this.particleGeometry, this.type, this.rainIntensity, deltaCamX, deltaCamZ, forwardX, forwardZ, deltaTime);
        }

        // 5. 更新遗留系统粒子
        if (this.oldSystem) {
            this._updateSystem(this.oldSystem, this.oldGeometry, this.oldType, this.oldRainIntensity, deltaCamX, deltaCamZ, forwardX, forwardZ, deltaTime);
        }
    }

    /**
     * 内部粒子更新逻辑
     */
    _updateSystem(system, geometry, type, rainIntensity, deltaCamX, deltaCamZ, forwardX, forwardZ, deltaTime) {
        system.position.x = this.camera.position.x + forwardX * this.viewOffset;
        system.position.z = this.camera.position.z + forwardZ * this.viewOffset;

        const positions = geometry.attributes.position.array;
        const halfRange = this.range / 2;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] -= deltaCamX;
            positions[i + 2] -= deltaCamZ;

            if (positions[i] > halfRange) positions[i] -= this.range;
            if (positions[i] < -halfRange) positions[i] += this.range;
            if (positions[i + 2] > halfRange) positions[i + 2] -= this.range;
            if (positions[i + 2] < -halfRange) positions[i + 2] += this.range;

            if (type === 'rain') {
                let fallSpeed = 28;
                if (rainIntensity === 'light') fallSpeed = 18;
                positions[i + 1] -= fallSpeed * deltaTime;
                positions[i] += 1.5 * deltaTime;
            } else if (type === 'snow') {
                positions[i + 1] -= 3.5 * deltaTime;
                positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.6 * deltaTime;
            }

            if (positions[i + 1] < 0) {
                positions[i + 1] = this.height;
            }
        }
        geometry.attributes.position.needsUpdate = true;
    }
}

export const weatherManager = new WeatherManager();

