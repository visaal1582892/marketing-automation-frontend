import React from 'react';

export default function StoreIdDisplay({ storeId, className = "text-slate-700" }) {
  if (!storeId) {
    return <span className="text-slate-300 italic text-xs">None</span>;
  }
  
  const arr = storeId.split(',');
  if (arr.length > 2) {
    return (
      <span className={`${className} cursor-default`} title={storeId}>
        {arr.slice(0, 2).join(',')},...
      </span>
    );
  }
  
  return (
    <span className={className} title={storeId}>
      {storeId}
    </span>
  );
}
