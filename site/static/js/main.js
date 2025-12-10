// Dark mode toggle functionality
const themeToggle = document.getElementById('theme-toggle');

// Check for saved theme preference or use system preference
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const savedTheme = localStorage.getItem('theme');

// Initialize theme based on preference
function initializeTheme() {
    const shouldUseDark = savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches);

    if (shouldUseDark) {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
        document.querySelector('.theme-switch-label i').classList.remove('fa-moon');
        document.querySelector('.theme-switch-label i').classList.add('fa-sun');
    } else {
        document.body.removeAttribute('data-theme');
        themeToggle.checked = false;
        document.querySelector('.theme-switch-label i').classList.remove('fa-sun');
        document.querySelector('.theme-switch-label i').classList.add('fa-moon');
    }
}

// Initialize theme on page load
initializeTheme();

// Theme toggle event listener
themeToggle.addEventListener('change', function() {
    if (this.checked) {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        document.querySelector('.theme-switch-label i').classList.remove('fa-moon');
        document.querySelector('.theme-switch-label i').classList.add('fa-sun');
    } else {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        document.querySelector('.theme-switch-label i').classList.remove('fa-sun');
        document.querySelector('.theme-switch-label i').classList.add('fa-moon');
    }
});

// Listen for system theme changes
prefersDarkScheme.addEventListener('change', function() {
    // Only update if user hasn't set a manual preference
    if (!localStorage.getItem('theme')) {
        initializeTheme();
    }
});

// Fetch GitHub stars
async function fetchGitHubStars() {
    try {
        const response = await fetch('https://api.github.com/repos/chrisvel/tududi');
        const data = await response.json();
        const stars = data.stargazers_count;

        document.getElementById('github-stars').textContent = stars.toLocaleString();
    } catch (error) {
        console.log('GitHub API error:', error);
        document.getElementById('github-stars').textContent = '100+';
    }
}

// Fetch stars when page loads
fetchGitHubStars();

// Mobile menu toggle functionality
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');

    const menuIcon = document.querySelector('.mobile-menu-toggle i');
    if (navLinks.classList.contains('active')) {
        menuIcon.classList.remove('fa-bars');
        menuIcon.classList.add('fa-times');
    } else {
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
    }
}

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        const navLinks = document.querySelector('.nav-links');
        const menuIcon = document.querySelector('.mobile-menu-toggle i');
        navLinks.classList.remove('active');
        menuIcon.classList.remove('fa-times');
        menuIcon.classList.add('fa-bars');
    });
});
