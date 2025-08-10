document.addEventListener('DOMContentLoaded', () => {
    const stageTitle = document.getElementById('stage-title');
    const progressBar = document.getElementById('progress-bar');

    // Get the current page's path to determine the stage
    const path = window.location.pathname;

    if (path.includes('typing.html')) {
        stageTitle.textContent = 'Stage 1 of 3: Typing Test';
        progressBar.style.width = '33%';
    } else if (path.includes('letter.html')) {
        stageTitle.textContent = 'Stage 2 of 3: Letter Test';
        progressBar.style.width = '66%';
    } else if (path.includes('excel.html')) {
        stageTitle.textContent = 'Stage 3 of 3: Excel Test';
        progressBar.style.width = '100%';
    }
});