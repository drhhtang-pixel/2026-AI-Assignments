(function () {
    function tokenize(keyword) {
        return (keyword || '')
            .toLowerCase()
            .replace(/\s+and\s+/g, ' ')
            .split(/\s+/)
            .filter((k) => k.trim() !== '');
    }

    function normalizeSearchText(row) {
        const text = (
            (row['計畫名稱'] || '') +
            (row['工作內容'] || '') +
            (row['主管機關'] || '') +
            (row['分支計畫'] || '')
        ).toLowerCase();

        return text.replace(/(\d+\.|\(\d+\)|<\d+>|（\d+）)/g, '');
    }

    function filterBudgetPlans(data, keyword, parseMoney) {
        const tokens = tokenize(keyword);
        if (!tokens.length) return [];

        return (data || []).filter((row) => {
            const amount = parseMoney(row['預算金額']);
            const planId = (row['計畫編號'] || '').trim();
            const planName = row['計畫名稱'] || '';
            const isAgencySummary = planId.includes('000000');
            const isGeneralCut = planName.includes('統刪');

            if (amount === 0 && !row['刪減金額']) return false;
            if (isAgencySummary || isGeneralCut) return false;

            const normalized = normalizeSearchText(row);
            return tokens.every((token) => normalized.includes(token));
        });
    }

    window.SearchEngine = {
        tokenize,
        normalizeSearchText,
        filterBudgetPlans
    };
})();
