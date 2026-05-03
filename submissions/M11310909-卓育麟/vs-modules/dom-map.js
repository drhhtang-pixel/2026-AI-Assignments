(function () {
    const sectionAliasMap = {
        'section-progress': 'section-review-progress',
        'section-review-progress': 'section-review-progress',
        'section-allocation': 'section-allocation-115',
        'section-allocation-115': 'section-allocation-115',
        'section-compare': 'section-ministry-compare',
        'section-ministry-compare': 'section-ministry-compare',
        'section-ministry-detail': 'section-ministry-detail',
        'section-search': 'section-search',
        'section-plan-search-home': 'section-plan-search-home',
        'section-agency': 'section-agency-review-home',
        'section-agency-review-home': 'section-agency-review-home'
    };

    function resolveSectionId(sectionId) {
        if (!sectionId) return '';
        return sectionAliasMap[sectionId] || sectionId;
    }

    window.DomMap = {
        sectionAliasMap,
        resolveSectionId
    };
})();
