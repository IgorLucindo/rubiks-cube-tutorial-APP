export function initToggleMenu(virtualCube) {
    const menuBtn = document.getElementById('debugMenuBtn');
    const menu = document.getElementById('debugMenu');
    const forceBtn = document.getElementById('forceCubeBtn');
    const autoBtn = document.getElementById('autoSolveBtn');

    if (menuBtn && menu) {
        const toggle = () => {
            const isOpen = menu.classList.toggle('open');
            menuBtn.classList.toggle('open');
            menuBtn.setAttribute('aria-expanded', String(isOpen));
            menu.setAttribute('aria-hidden', String(!isOpen));
        };

        menuBtn.addEventListener('click', toggle);

        // Close menu when clicking/touching outside
        const closeMenu = (e) => {
            if (!menu.classList.contains('open')) return;
            if (menu.contains(e.target) || menuBtn.contains(e.target)) return;
            
            menu.classList.remove('open');
            menuBtn.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
        };

        window.addEventListener('mousedown', closeMenu);
        window.addEventListener('touchstart', closeMenu);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu.classList.contains('open')) {
                menu.classList.remove('open');
                menuBtn.classList.remove('open');
                menuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (forceBtn) forceBtn.addEventListener('click', () => {
        virtualCube.forceUnsolvedState();
        menu.classList.remove('open');
        menuBtn.classList.remove('open');
    });

    if (autoBtn) autoBtn.addEventListener('click', () => {
        virtualCube.autoSolve();
        menu.classList.remove('open');
        menuBtn.classList.remove('open');
    });
}