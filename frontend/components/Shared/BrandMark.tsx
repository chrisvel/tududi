import React from 'react';
import { getAssetPath } from '../../config/paths';

// LTD-PATCH(T-301): Use the approved Path to Today artwork in every compact logo.
const BrandMark: React.FC = () => (
    <img
        src={getAssetPath('brand-mark.png')}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
        aria-hidden="true"
    />
);
export default BrandMark;
