import { LayoutChangeEvent } from 'react-native';
import { useCallback, useState } from 'react';

export function useMeasuredWidth(): [(e: LayoutChangeEvent) => void, number] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - measured) > 0.5 ? measured : prev));
  }, []);

  return [onLayout, width];
}
