(function () {
    const STORAGE_KEY = 'budget-dashboard-ui-state-v1';

    function readState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeState(partial) {
        const next = Object.assign({}, readState(), partial);
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore storage failures
        }
    }

    function savePage(pageId) {
        writeState({ activePage: pageId });
    }

    function saveSearchState(keyword, page) {
        writeState({ searchKeyword: keyword || '', searchPage: page || 1 });
    }

    function restoreState() {
        return readState();
    }

    function resolveSectionId(sectionId) {
        if (window.DomMap && typeof window.DomMap.resolveSectionId === 'function') {
            return window.DomMap.resolveSectionId(sectionId);
        }
        return sectionId;
    }

    function scrollToSection(sectionId) {
        const resolvedId = resolveSectionId(sectionId);
        const element = document.getElementById(resolvedId);
        if (!element) return false;
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    window.NavigationState = {
        savePage,
        saveSearchState,
        restoreState,
        resolveSectionId,
        scrollToSection
    };
})();
