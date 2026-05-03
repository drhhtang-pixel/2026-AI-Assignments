(function () {
    function syncSearchInputs(keyword) {
        const normalized = (keyword || '').trim();
        const homeInput = document.querySelector(".js-search-home-input");
        const budgetInput = document.querySelector(".js-search-budget-input");
        if (homeInput && homeInput.value !== normalized) homeInput.value = normalized;
        if (budgetInput && budgetInput.value !== normalized) budgetInput.value = normalized;
    }

    function updateHomeSearchCtaVisibility(resultCount, perPage) {
        const cta = document.querySelector(".js-home-search-cta");
        if (!cta) return;
        cta.style.display = resultCount > perPage ? 'block' : 'none';
    }

    window.DashboardRenderers = {
        syncSearchInputs,
        updateHomeSearchCtaVisibility
    };
})();
