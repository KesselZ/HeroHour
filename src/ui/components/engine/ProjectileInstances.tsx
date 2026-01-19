import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';

/**
 * 弹道实例化渲染层
 */
export const ProjectileInstances: React.FC = () => {
    const [types, setTypes] = useState<string[]>(['arrow', 'wave', 'fireball', 'spit', 'lob', 'pill', 'heal', 'air_sword']);

    return (
        <group>
            {types.map(type => (
                <ProjectileTypeGroup key={type} type={type} />
            ))}
        </group>
    );
};

const ProjectileTypeGroup: React.FC<{ type: string }> = ({ type }) => {
    const [count, setCount] = useState(0);
    const projectilesRef = useRef<any[]>([]);

    useFrame(() => {
        // @ts-ignore
        const battle = window.battleScene;
        if (!battle || !battle.projectileManager) return;

        const currentProjectiles = battle.projectileManager.projectiles.filter((p: any) => p.config.type === type || (!p.config.type && type === 'arrow'));
        projectilesRef.current = currentProjectiles;
        
        if (currentProjectiles.length !== count) {
            setCount(currentProjectiles.length);
        }
    });

    // 为不同弹道分配几何体
    const geometry = useMemo(() => {
        if (type === 'arrow') return new THREE.BoxGeometry(0.1, 0.1, 0.6);
        if (type === 'fireball') return new THREE.SphereGeometry(0.3, 8, 8);
        return new THREE.SphereGeometry(0.15, 8, 8);
    }, [type]);

    return (
        <Instances range={500} geometry={geometry}>
            <meshBasicMaterial transparent opacity={0.9} />
            {Array.from({ length: count }).map((_, i) => (
                <SingleProjectileInstance key={i} index={i} projectilesRef={projectilesRef} />
            ))}
        </Instances>
    );
};

const SingleProjectileInstance: React.FC<{ index: number; projectilesRef: any }> = ({ index, projectilesRef }) => {
    const ref = useRef<any>();

    useFrame(() => {
        const p = projectilesRef.current[index];
        if (!p || !ref.current) {
            if (ref.current) ref.current.visible = false;
            return;
        }

        ref.current.visible = true;
        ref.current.position.copy(p.position);
        ref.current.quaternion.copy(p.quaternion);
        
        // 同步颜色
        if (p.config.color) {
            ref.current.color.setHex(p.config.color);
        }
    });

    return <Instance ref={ref} />;
};

import { useMemo } from 'react';

