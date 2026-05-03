(function () {
    function applyDataContract(pageId, rows) {
        if (!window.DataContract || typeof window.DataContract.validateRows !== 'function') {
            return { ok: true, errors: [] };
        }
        const result = window.DataContract.validateRows(pageId, rows);
        if (!result.ok) {
            console.warn(`[${pageId}] Data contract warning:`, result.errors.join('; '));
        }
        return result;
    }

    window.DataLoaderModule = {
        applyDataContract
    };
})();
