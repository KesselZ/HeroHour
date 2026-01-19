import { useModifierStore } from '../store/modifierStore';
import { modifierManager } from '../systems/ModifierManager';
import { useMemo } from 'react';

/**
 * useModifiedValue: 响应式数值修正 Hook
 * 
 * @param unit 目标单位 (hero, city, soldier 等)
 * @param statName 属性名称 (如 'attackDamage', 'gold_income')
 * @param baseValue 基础数值
 * @returns 修正后的最终数值
 * 
 * 软件工程优势：
 * 1. 响应式：当底层 ModifierManager 中的数据发生变化时，使用该 Hook 的 React 组件会自动重绘。
 * 2. 复用性：直接复用底层引擎的高性能计算逻辑，保持数值模型在全项目唯一。
 */
export function useModifiedValue(unit: any, statName: string, baseValue: number): number {
  // 订阅 store 的变化，但我们不需要具体的值，只需要它触发重绘
  const modifiers = useModifierStore((state) => state.modifiers);

  return useMemo(() => {
    // 每次 modifiers 数组引用发生变化时，重新计算
    return modifierManager.getModifiedValue(unit, statName, baseValue);
  }, [modifiers, unit, statName, baseValue]);
}
