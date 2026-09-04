import React from 'react';

export default function StoreIdDisplay({ storeId, customStoreIds, stores, className = "text-slate-700" }) {
  const posStoreIds = Array.isArray(stores) && stores.length > 0
    ? stores.map(s => s.storeId).filter(Boolean).join(',')
    : storeId;

  const hasPosStores = Boolean(posStoreIds);
  const hasCustomStores = Boolean(customStoreIds);

  if (!hasPosStores && !hasCustomStores) {
    return <span className="text-slate-300 italic text-xs">None</span>;
  }

  const renderTruncated = (text) => {
    if (!text) return null;
    const arr = String(text).split(',');
    if (arr.length > 2) {
      return (
        <span className="cursor-default" title={text}>
          {arr.slice(0, 2).join(',')},...
        </span>
      );
    }
    return <span title={text}>{text}</span>;
  };

  return (
    <div className={`inline-flex flex-col text-xs leading-tight ${className}`}>
      {hasPosStores && (
        <span className="font-medium text-slate-700">
          {renderTruncated(posStoreIds)}
        </span>
      )}
      {hasCustomStores && (
        <span className="text-[11px] text-amber-700 font-normal truncate max-w-[160px]" title={`Custom Stores: ${customStoreIds}`}>
          {hasPosStores ? `Custom: ${customStoreIds}` : customStoreIds}
        </span>
      )}
    </div>
  );
}
