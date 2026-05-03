(function () {
    const requiredFields = {
        'page-a': ['計畫編號', '所屬部會', '主管機關', '計畫名稱', '預算金額'],
        'page-b': ['計畫編號', '主管機關', '刪減金額', '凍結金額'],
        'page-c': ['委員姓名', '黨籍', '刪減案數', '凍結案數', '主決議數'],
        'page-d': ['日期', '事項']
    };

    function validateRows(pageId, rows) {
        const errors = [];
        const fields = requiredFields[pageId] || [];

        if (!Array.isArray(rows) || rows.length === 0) {
            return { ok: false, errors: [`${pageId}: no rows`] };
        }

        fields.forEach((field) => {
            const missing = rows.every((row) => !Object.prototype.hasOwnProperty.call(row, field));
            if (missing) errors.push(`${pageId}: missing field "${field}"`);
        });

        return { ok: errors.length === 0, errors };
    }

    window.DataContract = {
        requiredFields,
        validateRows
    };
})();
