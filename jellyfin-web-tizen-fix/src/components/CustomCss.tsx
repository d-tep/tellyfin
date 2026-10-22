import React, { type FC } from 'react';

// Tellyfin owns its theme; server/user CSS must not replace its TV safeguards.
const CustomCss: FC = () => (
    <link rel='stylesheet' href='ui/tellyfin-theme.css' data-tellyfin-theme />
);

export default CustomCss;
