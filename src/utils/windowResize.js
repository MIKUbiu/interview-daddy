/**
 * Utility function to resize the window for a specific view
 * @param {string} viewName - The name of the view (customize, help, history, advanced, main, assistant, onboarding)
 * @param {string} layoutMode - The layout mode (normal or compact) - defaults to reading from localStorage
 */
export async function resizeLayout(viewName) {
    try {
        // Get current layout mode from localStorage
        const layoutMode = localStorage.getItem('layoutMode') || 'normal';

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('resize-for-view', viewName, layoutMode);
            if (result.success) {
                console.log(`Window resized for ${viewName} view`);
            } else {
                console.error('Failed to resize window:', result.error);
            }
        }
    } catch (error) {
        console.error('Error resizing window:', error);
    }
}

/**
 * Utility function to get the current view name from a view component
 * This can be overridden by passing a specific viewName to resizeLayout
 * @param {string} tagName - The tag name of the custom element (e.g., 'customize-view')
 * @returns {string} - The view name for resizing
 */
export function getViewNameFromTag(tagName) {
    const viewMap = {
        'customize-view': 'customize',
        'help-view': 'help',
        'history-view': 'history',
        'advanced-view': 'advanced',
        'main-view': 'main',
        'assistant-view': 'assistant',
        'onboarding-view': 'onboarding',
    };

    return viewMap[tagName] || 'main';
}
