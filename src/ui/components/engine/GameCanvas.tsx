import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGameStore } from '../../../store/gameStore';
import { UnitInstances } from './UnitInstances';
import { ProjectileInstances } from './ProjectileInstances';
import * as THREE from 'three';

/**
 * GameCanvas - R3F 渲染引擎入口 (高性能透明叠加版)
 */
export const GameCanvas: React.FC = () => {
    const currentPhase = useGameStore(s => s.currentPhase);

    return (
        <div style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 5, // 位于旧 Canvas (zIndex 0) 之上，UI (zIndex 10+) 之下
            pointerEvents: 'none', // 核心：点击穿透，让底层旧 Canvas 处理交互
            visibility: (currentPhase === 'battle' || currentPhase === 'world') ? 'visible' : 'hidden',
            backgroundColor: 'transparent' // 核心：完全透明，显示底层的山脉地面
        }}>
            <Canvas
                shadows
                orthographic
                // 初始参数不重要，因为每帧都会同步
                camera={{ zoom: 35, position: [0, 50, 50] }}
                gl={{ 
                    antialias: false, 
                    alpha: true, // 开启透明
                    powerPreference: "high-performance" 
                }}
                onCreated={({ gl }) => {
                    gl.setClearColor(0x000000, 0); // 确保背景透明
                }}
            >
                <Suspense fallback={null}>
                    <ambientLight intensity={1.5} />
                    <directionalLight position={[10, 20, 10]} intensity={1.5} />

                    {currentPhase === 'battle' && <BattleView />}
                </Suspense>
            </Canvas>
        </div>
    );
};

const BattleView: React.FC = () => {
    useFrame(({ camera }) => {
        // --- 核心：硬同步相机 ---
        // @ts-ignore
        const oldCamera = window.battleScene?.camera;
        if (oldCamera) {
            camera.position.copy(oldCamera.position);
            camera.quaternion.copy(oldCamera.quaternion);
            // @ts-ignore
            if (camera.zoom !== oldCamera.zoom) {
                // @ts-ignore
                camera.zoom = oldCamera.zoom;
                // @ts-ignore
                camera.updateProjectionMatrix();
            }
        }
    });

    return (
        <group>
            <UnitInstances />
            <ProjectileInstances />
        </group>
    );
};
