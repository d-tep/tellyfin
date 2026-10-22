import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('hooks/useUserSettings', () => ({
    useUserSettings: () => { throw new Error('Tellyfin must not read user CSS'); }
}));
vi.mock('apps/dashboard/features/branding/api/useBrandingOptions', () => ({
    useBrandingOptions: () => { throw new Error('Tellyfin must not read server CSS'); }
}));

import CustomCss from './CustomCss';

describe('Tellyfin theme isolation', () => {
    it('loads only the packaged theme without reading server or user CSS', () => {
        const markup = renderToStaticMarkup(<CustomCss />);
        expect(markup).toContain('href="ui/tellyfin-theme.css"');
        expect(markup).toContain('data-tellyfin-theme="true"');
        expect(markup).not.toContain('<style');
        expect(markup).not.toContain('https:');
    });
});
