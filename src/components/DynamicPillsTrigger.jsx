import React, { useRef, useState, useLayoutEffect } from 'react';
import Icon from './Icon';

export default function DynamicPillsTrigger({ selectedItems, placeholder, onRemove, onToggle, isOpen }) {
  const containerRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(selectedItems.length);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth - 40; // leave space for chevron
      let currentWidth = 0;
      let count = 0;
      const children = Array.from(container.children).filter(c => c.hasAttribute('data-pill'));
      
      for (let i = 0; i < children.length; i++) {
        const itemWidth = children[i].getBoundingClientRect().width + 6; // gap
        if (currentWidth + itemWidth > containerWidth && i > 0) {
          // If adding this exceeds and it's not the first one, check if we have space for "+X"
          // We'll just break here.
          break;
        }
        currentWidth += itemWidth;
        count++;
      }
      // If we didn't fit all, ensure we have space for the +N pill
      if (count < children.length && count > 0) {
        // subtract 1 if the +N pill (approx 60px) doesn't fit with current count
        if (currentWidth + 60 > containerWidth && count > 1) {
          count--;
        }
      }
      setVisibleCount(Math.max(1, count));
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [selectedItems]);

  if (selectedItems.length === 0) {
    return (
      <div className="flex w-full items-center justify-between gap-2 px-3 py-1.5 min-h-[36px]">
        <span className="text-slate-400 text-sm truncate">{placeholder}</span>
        <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>
    );
  }

  const visible = selectedItems.slice(0, visibleCount);
  const hiddenCount = selectedItems.length - visibleCount;

  return (
    <div className="flex w-full items-center justify-between gap-2 px-1.5 py-1 min-h-[36px] overflow-hidden" ref={containerRef}>
      <div className="flex items-center gap-1.5 overflow-hidden w-full whitespace-nowrap">
        {/* Render ALL items invisibly to measure them, but visually hide the ones past visibleCount */}
        {selectedItems.map((item, idx) => (
          <span
            key={item.id}
            data-pill
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium max-w-[70%] shrink-0 transition-opacity
              ${idx < visibleCount ? 'bg-brand-100 text-brand-700' : 'absolute opacity-0 pointer-events-none'}`}
          >
            <span className="truncate">{item.name}</span>
            {onRemove && idx < visibleCount && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                className="shrink-0 cursor-pointer hover:text-red-600 transition leading-none ml-0.5"
              >
                ×
              </span>
            )}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
            +{hiddenCount} more
          </span>
        )}
      </div>
      <Icon name="chevron" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform mr-1.5 ${isOpen ? 'rotate-90' : ''}`} />
    </div>
  );
}
