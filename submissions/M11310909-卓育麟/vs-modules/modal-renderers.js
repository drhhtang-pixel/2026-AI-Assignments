(function () {
    function showModal(modalId) {
        const element = document.getElementById(modalId);
        if (element) element.style.display = 'flex';
    }

    function hideModal(modalId) {
        const element = document.getElementById(modalId);
        if (element) element.style.display = 'none';
    }

    function resetModalScroll(modalSelector) {
        const body = document.querySelector(modalSelector);
        if (body) body.scrollTop = 0;
    }

    window.ModalRenderers = {
        showModal,
        hideModal,
        resetModalScroll
    };
})();
