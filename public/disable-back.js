(function() {
    // 1. Add a new "dummy" state to the browser's history when the page loads.
    // This creates a state that the user has to go "back" through.
    history.pushState(null, document.title, location.href);

    // 2. Add an event listener that fires when the user tries to go back.
    window.addEventListener('popstate', function (event) {
        // 3. When the user clicks "back", we immediately push the same state again,
        // effectively canceling their action and keeping them on the current page.
        history.pushState(null, document.title, location.href);
    });
})();