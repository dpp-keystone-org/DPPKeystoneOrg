export function loadHeader(containerId, pathToRoot = '') {
    const prefix = pathToRoot ? pathToRoot + '/' : '';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <header style="display: flex; align-items: center;">
            <a href="${prefix === '' ? '.' : prefix}/" style="text-decoration: none; display: flex; align-items: center; color: inherit;">
                <img src="${prefix}branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 80px; margin-right: 20px;">
                <div>
                    <h1 style="margin-bottom: 0; font-size: 2.2em;" data-i18n-key="dpp-keystone">DPP Keystone</h1>
                    <p style="margin-top: 0.5em; font-size: 1.1em; color: var(--text-light);" data-i18n-key="harmonizing-data-for-the-digital">Harmonizing Data for the Digital Product Passport</p>
                </div>
            </a>
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
    `;
}
