import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';
import { ASSET_REGISTRY, spriteFactory } from '../../../engine/SpriteFactory.js';

/**
 * 优化后的单位实例化组件
 * 职责：直接从全局 battleScene 读取数据，零 React State 同步
 */
export const UnitInstances: React.FC = () => {
    // 自动获取当前战场上存在的所有单位类型
    const [activeTypes, setActiveTypes] = useState<string[]>([]);

    useFrame(() => {
        // @ts-ignore
        const battle = window.battleScene;
        if (!battle) return;

        const allUnits = [...battle.playerUnits, ...battle.enemyUnits];
        const types = Array.from(new Set(allUnits.filter(u => !u.isDead).map(u => u.type)));
        
        // 只有当战场上有新物种加入时才触发重绘
        if (types.length !== activeTypes.length) {
            setActiveTypes(types);
        }
    });

    return (
        <group>
            {activeTypes.map(type => (
                <TypeInstances key={type} type={type} />
            ))}
        </group>
    );
};

const TypeInstances: React.FC<{ type: string }> = ({ type }) => {
    const config = ASSET_REGISTRY.UNITS[type];
    const texture = useMemo(() => {
        if (!config) return new THREE.Texture();
        const path = ASSET_REGISTRY.SHEETS[config.sheet];
        // @ts-ignore
        const tex = spriteFactory.cache.get(path);
        if (tex) {
            const cloned = tex.clone();
            const { rows, cols, r, c } = config;
            cloned.repeat.set(1 / cols, 1 / rows);
            cloned.offset.set((c - 1) / cols, (rows - r) / rows);
            cloned.needsUpdate = true;
            return cloned;
        }
        return new THREE.Texture();
    }, [type, config]);

    return (
        <Instances range={1000}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial 
                map={texture} 
                transparent 
                alphaTest={0.5} 
                side={THREE.DoubleSide}
            />
            <UnitLoop type={type} config={config} />
        </Instances>
    );
};

const UnitLoop: React.FC<{ type: string; config: any }> = ({ type, config }) => {
    const [unitIds, setUnitIds] = useState<string[]>([]);

    useFrame(() => {
        // @ts-ignore
        const battle = window.battleScene;
        if (!battle) return;

        const allUnits = [...battle.playerUnits, ...battle.enemyUnits];
        const sameTypeUnits = allUnits.filter(u => u.type === type && !u.isDead);
        const ids = sameTypeUnits.map(u => u.id || `${u.type}-${u.index}`);

        if (ids.length !== unitIds.length) {
            setUnitIds(ids);
        }
    });

    return (
        <>
            {unitIds.map((id, index) => (
                <SingleUnitInstance key={id} id={id} type={type} config={config} index={index} />
            ))}
        </>
    );
};

const SingleUnitInstance: React.FC<{ id: string; type: string; config: any, index: number }> = ({ id, type, config }) => {
    const ref = useRef<any>();
    const scale = config?.scale || 1.4;

    useFrame(() => {
        if (!ref.current) return;
        // @ts-ignore
        const battle = window.battleScene;
        if (!battle) return;

        // 找到对应的逻辑对象
        const unit = [...battle.playerUnits, ...battle.enemyUnits].find(u => (u.id || `${u.type}-${u.index}`) === id);
        
        // 注意：这里不再检查 unit.visible，因为逻辑单位在原生场景中是隐藏的
        if (!unit || unit.isDead) {
            ref.current.visible = false;
            return;
        }

        ref.current.visible = true;
        ref.current.position.copy(unit.position);
        
        // 视觉偏移同步
        if (unit.unitSprite) {
            ref.current.position.add(unit.unitSprite.position);
            ref.current.scale.set(unit.unitSprite.scale.x, unit.unitSprite.scale.y, 1);
            ref.current.color.copy(unit.unitSprite.material.color);
        } else {
            ref.current.scale.set(scale, scale, 1);
        }

        // 左右翻转
        const isDefaultRight = config?.defaultFacing === 'right';
        const shouldFlip = unit.side === 'enemy' ? isDefaultRight : !isDefaultRight;
        ref.current.rotation.y = shouldFlip ? Math.PI : 0;
    });

    return <Instance ref={ref} />;
};
